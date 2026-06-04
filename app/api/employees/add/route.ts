import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireManagerForApi } from '@/lib/rbac'
import { createEmployeeWithSetupEmail } from '@/lib/employee-onboarding'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireManagerForApi()
    if (auth instanceof NextResponse) return auth
    
    const employees = await request.json()
    
    if (!Array.isArray(employees) || employees.length === 0) {
      return NextResponse.json(
        { error: 'Invalid employee data provided' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const results = []
    const errors = []

    for (const emp of employees) {
      const { email, full_name, employee_id, department, domain } = emp

      if (!email || !full_name || !employee_id || !domain) {
        errors.push(`Missing required fields for ${email || 'unknown employee'}: email, full name, employee ID, and domain are required`)
        continue
      }

      try {
        const { profile, warning } = await createEmployeeWithSetupEmail(supabase, {
          email,
          fullName: full_name,
          employeeId: employee_id,
          department: department || null,
          domain,
        })

        if (warning) {
          errors.push(`Employee ${email}: ${warning}`)
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
