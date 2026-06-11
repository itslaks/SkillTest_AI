import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireManagerForApi } from '@/lib/rbac'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireManagerForApi()
    if (auth instanceof NextResponse) return auth
    const { id: employeeId } = await params
    const body = await request.json()

    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : ''
    const employeeIdValue = typeof body.employee_id === 'string' ? body.employee_id.trim() : ''
    const department = typeof body.department === 'string' ? body.department.trim() : ''
    const domain = typeof body.domain === 'string' ? body.domain.trim() : ''

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 })
    }

    if (!fullName) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: employee, error: fetchError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', employeeId)
      .single()

    if (fetchError || !employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    if (employee.role === 'manager' || employee.role === 'admin') {
      return NextResponse.json({ error: 'Cannot edit managers or administrators here' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        employee_id: employeeIdValue || null,
        department: department || null,
        domain: domain || 'General',
        updated_at: new Date().toISOString(),
      })
      .eq('id', employeeId)
      .select('id, email, full_name, employee_id, department, domain')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, employee: data })
  } catch (error) {
    console.error('Error updating employee:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify manager authentication
    const auth = await requireManagerForApi()
    if (auth instanceof NextResponse) return auth
    const { id: employeeId } = await params

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // First, get employee details for validation
    const { data: employee, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', employeeId)
      .single()

    if (fetchError || !employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Prevent deletion of managers/admins
    if (employee.role === 'manager' || employee.role === 'admin') {
      return NextResponse.json(
        { error: 'Cannot delete managers or administrators' },
        { status: 403 }
      )
    }

    // Delete from auth.users (this will cascade to profiles due to foreign key)
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(employeeId)

    if (authDeleteError) {
      return NextResponse.json(
        { error: `Failed to remove employee: ${authDeleteError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Employee ${employee.full_name} has been successfully removed`
    })

  } catch (error: any) {
    console.error('Error deleting employee:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
