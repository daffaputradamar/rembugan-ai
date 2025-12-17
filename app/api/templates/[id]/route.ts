import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/db"
import { templates, templateUsers, templateRoles, users } from "@/db/schema"
import { eq } from "drizzle-orm"
import { canAccessTemplate, canModifyTemplate } from "@/lib/auth"

// GET /api/templates/[id] - Get a single template
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    const user = session?.user

    const [template] = await db
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
      .where(eq(templates.id, id))

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    // Get allowed users and roles for custom visibility
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

    // Check access
    const canAccess = canAccessTemplate(user || null, {
      visibility: template.visibility || "public",
      divisionId: template.divisionId,
      departmentId: template.departmentId,
      userId: template.userId,
      allowedUserIds,
      allowedRoleIds,
    })

    if (!canAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    return NextResponse.json({
      ...template,
      allowedUserIds,
      roleIds: allowedRoleIds,
      isOwner: user?.id === template.userId,
      canModify: canModifyTemplate(user || null, template),
    })
  } catch (error) {
    console.error("Error fetching template:", error)
    return NextResponse.json(
      { error: "Failed to fetch template" },
      { status: 500 }
    )
  }
}

// PUT /api/templates/[id] - Update a template
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [existingTemplate] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, id))

    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    // Check if user can modify
    if (!canModifyTemplate(session.user, existingTemplate)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const body = await req.json()
    const {
      name,
      description,
      markdown,
      rawText,
      fileName,
      visibility,
      divisionId,
      departmentId,
      allowedUserIds,
      roleIds,
    } = body

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

    // Update the template
    const [updatedTemplate] = await db
      .update(templates)
      .set({
        name: name ?? existingTemplate.name,
        description: description ?? existingTemplate.description,
        markdown: markdown ?? existingTemplate.markdown,
        rawText: rawText ?? existingTemplate.rawText,
        fileName: fileName ?? existingTemplate.fileName,
        visibility: visibility ?? existingTemplate.visibility,
        divisionId:
          visibility === "division" || visibility === "custom"
            ? divisionId
            : visibility === "department"
              ? divisionId
              : visibility === existingTemplate.visibility
                ? existingTemplate.divisionId
                : null,
        departmentId:
          visibility === "department" || visibility === "custom"
            ? departmentId
            : visibility === existingTemplate.visibility
              ? existingTemplate.departmentId
              : null,
        updatedAt: new Date(),
      })
      .where(eq(templates.id, id))
      .returning()

    // Update allowed users for custom visibility
    if (visibility === "custom" && allowedUserIds !== undefined) {
      // Remove existing allowed users
      await db
        .delete(templateUsers)
        .where(eq(templateUsers.templateId, id))

      // Add new allowed users
      if (allowedUserIds.length > 0) {
        await db.insert(templateUsers).values(
          allowedUserIds.map((userId: string) => ({
            templateId: id,
            userId,
          }))
        )
      }
    }

    // Update allowed roles for custom visibility
    if (visibility === "custom" && roleIds !== undefined) {
      // Remove existing allowed roles
      await db
        .delete(templateRoles)
        .where(eq(templateRoles.templateId, id))

      // Add new allowed roles
      if (roleIds.length > 0) {
        await db.insert(templateRoles).values(
          roleIds.map((roleId: number) => ({
            templateId: id,
            roleId,
          }))
        )
      }
    } else if (visibility !== "custom") {
      // If visibility changed from custom, remove all roles
      await db
        .delete(templateRoles)
        .where(eq(templateRoles.templateId, id))
    }

    return NextResponse.json(updatedTemplate)
  } catch (error) {
    console.error("Error updating template:", error)
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    )
  }
}

// DELETE /api/templates/[id] - Delete a template (soft delete)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [existingTemplate] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, id))

    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    // Check if user can modify (and template is not system)
    if (!canModifyTemplate(session.user, existingTemplate)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Soft delete - set isActive to false
    await db
      .update(templates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(templates.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting template:", error)
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    )
  }
}
