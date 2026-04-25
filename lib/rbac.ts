/**
 * Centralized RBAC utility. Single source of truth for role checks.
 */

import { createAdminClient, createClient } from "@/lib/supabase/server"
import type { UserRole } from "@/lib/types/database"
import { redirect } from "next/navigation"
import { NextResponse } from "next/server"

export type RBACRole = UserRole

export async function getCurrentUserRole(): Promise<{ userId: string; role: RBACRole } | null> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return null

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const role = (profile?.role || user.user_metadata?.role || "employee") as RBACRole

  if (profile && !profile.role && user.user_metadata?.role) {
    await adminClient.from("profiles").update({ role: user.user_metadata.role }).eq("id", user.id)
  }

  return { userId: user.id, role }
}

export async function requireRole(...allowedRoles: RBACRole[]): Promise<{ userId: string; role: RBACRole }> {
  const result = await getCurrentUserRole()
  if (!result) redirect("/auth/login")
  if (!allowedRoles.includes(result.role)) redirect(result.role === "employee" ? "/employee" : "/manager")
  return result
}

export async function requireManager(): Promise<{ userId: string; role: RBACRole }> {
  return requireRole("manager", "admin")
}

export async function requireEmployee(): Promise<{ userId: string; role: RBACRole }> {
  return requireRole("employee", "manager", "admin")
}

export function isManager(role: string | null | undefined): boolean {
  return role === "manager" || role === "admin"
}

export async function requireManagerForApi(): Promise<{ userId: string; role: RBACRole } | NextResponse> {
  const result = await getCurrentUserRole()
  if (!result) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!isManager(result.role)) return NextResponse.json({ error: "Forbidden: manager role required" }, { status: 403 })
  return result
}
