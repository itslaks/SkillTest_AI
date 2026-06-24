/**
 * Centralized RBAC utility. Single source of truth for role checks.
 */

import { createAdminClient, createClient } from "@/lib/supabase/server"
import type { UserRole } from "@/lib/types/database"
import { redirect } from "next/navigation"
import { NextResponse } from "next/server"
import { AUTHENTICATED_RATE_LIMIT, checkUserRateLimit, rateLimitResponse } from "@/lib/security/rate-limit"

export type RBACRole = UserRole

export async function getCurrentUserRole(): Promise<{ userId: string; role: RBACRole; approvalStatus: string | null } | null> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return null

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, approval_status")
    .eq("id", user.id)
    .single()

  const role = (profile?.role || user.user_metadata?.role || "employee") as RBACRole
  const approvalStatus = profile?.approval_status || null

  if (profile && !profile.role && user.user_metadata?.role) {
    await adminClient.from("profiles").update({ role: user.user_metadata.role }).eq("id", user.id)
  }

  return { userId: user.id, role, approvalStatus }
}

export async function requireRole(...allowedRoles: RBACRole[]): Promise<{ userId: string; role: RBACRole }> {
  const supabase = await createClient()
  const result = await getCurrentUserRole()
  if (!result) redirect("/auth/login")
  if (result.role === "trainer" && result.approvalStatus !== "approved") {
    await supabase.auth.signOut()
    redirect(result.approvalStatus === "rejected" ? "/auth/login?approval=rejected" : "/auth/pending-approval")
  }
  if (!allowedRoles.includes(result.role)) redirect(result.role === "employee" ? "/employee" : "/manager")
  return result
}

export async function requireManager(): Promise<{ userId: string; role: RBACRole }> {
  return requireRole("training_coordinator", "manager", "admin")
}

export async function requireTrainingStaff(): Promise<{ userId: string; role: RBACRole }> {
  return requireRole("trainer", "training_coordinator", "manager", "admin")
}

export async function requireAdmin(): Promise<{ userId: string; role: RBACRole }> {
  return requireRole("admin")
}

export async function requireEmployee(): Promise<{ userId: string; role: RBACRole }> {
  return requireRole("employee", "manager", "admin")
}

export function isManager(role: string | null | undefined): boolean {
  return role === "training_coordinator" || role === "manager" || role === "admin"
}

export function isTrainingStaff(role: string | null | undefined): boolean {
  return role === "trainer" || isManager(role)
}

export async function requireManagerForApi(): Promise<{ userId: string; role: RBACRole } | NextResponse> {
  const result = await getCurrentUserRole()
  if (!result) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!isManager(result.role)) return NextResponse.json({ error: "Forbidden: manager role required" }, { status: 403 })
  // User-based rate limit on all authenticated API access (OWASP API4:2023).
  const rate = checkUserRateLimit(result.userId, AUTHENTICATED_RATE_LIMIT)
  if (!rate.allowed) return rateLimitResponse(rate)
  return result
}

export async function requireAdminForApi(): Promise<{ userId: string; role: RBACRole } | NextResponse> {
  const result = await getCurrentUserRole()
  if (!result) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (result.role !== "admin") return NextResponse.json({ error: "Forbidden: admin role required" }, { status: 403 })
  const rate = checkUserRateLimit(result.userId, AUTHENTICATED_RATE_LIMIT)
  if (!rate.allowed) return rateLimitResponse(rate)
  return result
}

export async function requireTrainingStaffForApi(): Promise<{ userId: string; role: RBACRole } | NextResponse> {
  const result = await getCurrentUserRole()
  if (!result) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!isTrainingStaff(result.role)) return NextResponse.json({ error: "Forbidden: training staff role required" }, { status: 403 })
  // User-based rate limit on all authenticated API access (OWASP API4:2023).
  const rate = checkUserRateLimit(result.userId, AUTHENTICATED_RATE_LIMIT)
  if (!rate.allowed) return rateLimitResponse(rate)
  return result
}
