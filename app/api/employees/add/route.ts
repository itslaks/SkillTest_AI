import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/rbac'

export async function POST(request: NextRequest) {
  try {
    // Verify manager authentication
    const { userId } = await requireManager()
    
    const employees = await request.json()
    
    if (!Array.isArray(employees) || employees.length === 0) {
      return NextResponse.json(
        { error: 'Invalid employee data provided' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const results = []
    const errors = []

    for (const emp of employees) {
      const { email, full_name, employee_id, department, domain } = emp

      if (!email || !full_name) {
        errors.push(`Missing required fields for ${email || 'unknown employee'}`)
        continue
      }

      try {
        // Check if employee already exists
        const { data: existing } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('email', email)
          .single()

        if (existing) {
          errors.push(`Employee with email ${email} already exists`)
          continue
        }

        // Create auth user first
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          password: generateTempPassword(),
          email_confirm: true,
          user_metadata: {
            role: 'employee',
            full_name
          }
        })

        if (authError) {
          errors.push(`Auth error for ${email}: ${authError.message}`)
          continue
        }

        // Create profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            email: email,
            full_name: full_name,
            employee_id: employee_id || null,
            department: department || null,
            domain: domain || 'General',
            role: 'employee'
          })
          .select()
          .single()

        if (profileError) {
          // Clean up auth user if profile creation fails
          await supabase.auth.admin.deleteUser(authData.user.id)
          errors.push(`Profile error for ${email}: ${profileError.message}`)
          continue
        }

        results.push(profile)
      } catch (error: any) {
        errors.push(`Error processing ${email}: ${error.message}`)
      }
    }

    if (results.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { error: `Failed to add employees: ${errors.join(', ')}` },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      added: results.length,
      errors: errors.length > 0 ? errors : undefined,
      employees: results
    })

  } catch (error: any) {
    console.error('Error adding employees:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password + '!'
}
