import { auth } from "@/auth"
import { redirect } from "next/navigation"
import type { Template } from "@/db/schema"

export type SessionUser = {
  id: string
  npk?: string
  email: string
  name?: string
  isAdmin: boolean
  roles: string[]
  roleIds?: number[]
  divisionIds: number[]
  departmentIds: number[]
  divisionNames: string[]
  departmentNames: string[]
  status: "PENDING" | "APPROVED" | "REJECTED"
}

/**
 * Get the current session (server-side)
 */
export async function getSession() {
  return await auth()
}

/**
 * Get the current user from session (server-side)
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession()
  return session?.user || null
}

/**
 * Require authentication - redirects to login if not authenticated
 */
export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession()
  if (!session?.user) {
    redirect("/login")
  }
  return session.user
}

/**
 * Require admin role - redirects if not admin
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth()
  if (!user.isAdmin) {
    redirect("/unauthorized")
  }
  return user
}

/**
 * Check if user has access to a specific division
 */
export function hasAccessToDivision(
  user: { divisionIds: number[]; isAdmin: boolean },
  divisionId: number
): boolean {
  if (user.isAdmin) return true
  return user.divisionIds.includes(divisionId)
}

/**
 * Check if user has access to a specific department
 */
export function hasAccessToDepartment(
  user: { departmentIds: number[]; isAdmin: boolean },
  departmentId: number
): boolean {
  if (user.isAdmin) return true
  return user.departmentIds.includes(departmentId)
}

/**
 * Check if user has a specific role
 */
export function hasRole(user: { roles: string[] }, role: string): boolean {
  return user.roles.includes(role)
}

/**
 * Check if user can access a template based on visibility
 */
export function canAccessTemplate(
  user: SessionUser | null,
  template: {
    visibility: string
    divisionId?: number | null
    departmentId?: number | null
    userId: string
    allowedUserIds?: string[]
    allowedRoleIds?: number[]
  }
): boolean {
  // Public templates are accessible to everyone
  if (template.visibility === "public") return true

  // If no user, only public templates are accessible
  if (!user) return false

  // Owner can always access their own templates
  if (template.userId === user.id) return true

  // Admins can access everything
  if (user.isAdmin) return true

  // Division-level templates: user must be in the division
  if (template.visibility === "division" && template.divisionId) {
    return user.divisionIds.includes(template.divisionId)
  }

  // Department-level templates: user must be in the department
  if (template.visibility === "department" && template.departmentId) {
    return user.departmentIds.includes(template.departmentId)
  }

  // Custom visibility: check allowed users and roles
  if (template.visibility === "custom") {
    // Check if user is in allowed users list
    if (template.allowedUserIds?.includes(user.id)) {
      return true
    }
    
    // Check if user has any of the allowed roles
    if (template.allowedRoleIds && template.allowedRoleIds.length > 0) {
      const userRoleIds = user.roleIds || []
      if (template.allowedRoleIds.some(roleId => userRoleIds.includes(roleId))) {
        return true
      }
    }
  }

  return false
}

/**
 * Check if user can edit/delete a template
 */
export function canModifyTemplate(
  user: SessionUser | null,
  template: { userId: string; isSystem?: boolean }
): boolean {
  if (!user) return false
  
  // System templates cannot be modified by anyone except admins
  if (template.isSystem && !user.isAdmin) return false
  
  // Admins can modify any template
  if (user.isAdmin) return true
  
  // Owner can modify their own templates
  return template.userId === user.id
}
