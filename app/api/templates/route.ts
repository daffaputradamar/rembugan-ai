import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/db"
import { templates, templateUsers, templateRoles, users } from "@/db/schema"
import { eq, or, and, inArray, sql } from "drizzle-orm"
import { canAccessTemplate, canModifyTemplate } from "@/lib/auth"

// GET /api/templates - List templates accessible to user
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const user = session?.user

    const { searchParams } = new URL(req.url)
    const visibility = searchParams.get("visibility")
    const onlyMine = searchParams.get("mine") === "true"

    // Build the base query
    let query = db
      .select({
        id: templates.id,
        name: templates.name,
        description: templates.description,
        markdown: templates.markdown,
        rawText: templates.rawText,
        fileName: templates.fileName,
        visibility: templates.visibility,
        divisionId: templates.divisionId,
        departmentId: templates.departmentId,
        isSystem: templates.isSystem,
        isActive: templates.isActive,
        userId: templates.userId,
        createdAt: templates.createdAt,
        updatedAt: templates.updatedAt,
        ownerName: users.name,
        ownerEmail: users.email,
      })
      .from(templates)
      .leftJoin(users, eq(templates.userId, users.id))
      .where(eq(templates.isActive, true))

    const results = await query

    // Filter templates based on access permissions
    const accessibleTemplates = []
    for (const template of results) {
      // Get allowed user IDs for custom visibility
      let allowedUserIds: string[] = []
      let allowedRoleIds: number[] = []
      
      if (template.visibility === "custom") {
        const allowedUsers = await db
          .select({ userId: templateUsers.userId })
          .from(templateUsers)
          .where(eq(templateUsers.templateId, template.id))
        allowedUserIds = allowedUsers.map((u) => u.userId)
        
        const allowedRoles = await db
          .select({ roleId: templateRoles.roleId })
          .from(templateRoles)
          .where(eq(templateRoles.templateId, template.id))
        allowedRoleIds = allowedRoles.map((r) => r.roleId)
      }

      const canAccess = canAccessTemplate(user || null, {
        visibility: template.visibility || "public",
        divisionId: template.divisionId,
        departmentId: template.departmentId,
        userId: template.userId,
        allowedUserIds,
        allowedRoleIds,
      })

      if (canAccess) {
        // Apply additional filters
        if (visibility && template.visibility !== visibility) continue
        if (onlyMine && (!user || template.userId !== user.id)) continue

        accessibleTemplates.push({
          ...template,
          roleIds: allowedRoleIds,
          isOwner: user?.id === template.userId,
          canModify: canModifyTemplate(user || null, template),
        })
      }
    }

    return NextResponse.json(accessibleTemplates)
  } catch (error) {
    console.error("Error fetching templates:", error)
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    )
  }
}

// POST /api/templates - Create a new template
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const {
      name,
      description,
      markdown,
      rawText,
      fileName,
      visibility = "public",
      divisionId,
      departmentId,
      allowedUserIds = [],
      roleIds = [],
    } = body

    if (!name || !markdown) {
      return NextResponse.json(
        { error: "Name and markdown are required" },
        { status: 400 }
      )
    }

    // Validate visibility settings
    if (visibility === "division" && !divisionId) {
      return NextResponse.json(
        { error: "Division ID is required for division visibility" },
        { status: 400 }
      )
    }

    if (visibility === "department" && !departmentId) {
      return NextResponse.json(
        { error: "Department ID is required for department visibility" },
        { status: 400 }
      )
    }

    // Check if user has access to the specified division/department
    if (visibility === "division" && divisionId && !session.user.isAdmin) {
      if (!session.user.divisionIds.includes(divisionId)) {
        return NextResponse.json(
          { error: "You don't have access to this division" },
          { status: 403 }
        )
      }
    }

    if (visibility === "department" && departmentId && !session.user.isAdmin) {
      if (!session.user.departmentIds.includes(departmentId)) {
        return NextResponse.json(
          { error: "You don't have access to this department" },
          { status: 403 }
        )
      }
    }

    // Create the template
    const [newTemplate] = await db
      .insert(templates)
      .values({
        name,
        description,
        markdown,
        rawText,
        fileName,
        visibility,
        divisionId:
          visibility === "division" || visibility === "department" || visibility === "custom"
            ? divisionId
            : null,
        departmentId: visibility === "department" || visibility === "custom" ? departmentId : null,
        userId: session.user.id,
      })
      .returning()

    // Add allowed users for custom visibility
    if (visibility === "custom" && allowedUserIds.length > 0) {
      await db.insert(templateUsers).values(
        allowedUserIds.map((userId: string) => ({
          templateId: newTemplate.id,
          userId,
        }))
      )
    }

    // Add allowed roles for custom visibility
    if (visibility === "custom" && roleIds.length > 0) {
      await db.insert(templateRoles).values(
        roleIds.map((roleId: number) => ({
          templateId: newTemplate.id,
          roleId,
        }))
      )
    }

    return NextResponse.json(newTemplate, { status: 201 })
  } catch (error) {
    console.error("Error creating template:", error)
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    )
  }
}
