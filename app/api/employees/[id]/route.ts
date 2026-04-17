import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/rbac'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify manager authentication
    const { userId } = await requireManager()
    const { id: employeeId } = await params

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

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
