import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/db"
import { tasks, templates } from "@/db/schema"
import { eq, and } from "drizzle-orm"

// GET /api/tasks/[id] - Get task details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const [task] = await db
      .select({
        id: tasks.id,
        name: tasks.name,
        status: tasks.status,
        transcript: tasks.transcript,
        templateId: tasks.templateId,
        templateName: templates.name,
        templateMarkdown: templates.markdown,
        result: tasks.result,
        error: tasks.error,
        progress: tasks.progress,
        progressMessage: tasks.progressMessage,
        userId: tasks.userId,
        createdAt: tasks.createdAt,
        startedAt: tasks.startedAt,
        completedAt: tasks.completedAt,
      })
      .from(tasks)
      .leftJoin(templates, eq(tasks.templateId, templates.id))
      .where(and(eq(tasks.id, id), eq(tasks.userId, session.user.id)))
      .limit(1)

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error("Error fetching task:", error)
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    )
  }
}

// DELETE /api/tasks/[id] - Delete a task
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Only delete if owned by user
    const result = await db
      .delete(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, session.user.id)))
      .returning({ id: tasks.id })

    if (result.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    return NextResponse.json({ message: "Task deleted" })
  } catch (error) {
    console.error("Error deleting task:", error)
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    )
  }
}

// PATCH /api/tasks/[id] - Update task result
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    if (!body.result || typeof body.result !== "string") {
      return NextResponse.json(
        { error: "Invalid result field" },
        { status: 400 }
      )
    }

    // Update only if owned by user
    const result = await db
      .update(tasks)
      .set({ result: body.result })
      .where(and(eq(tasks.id, id), eq(tasks.userId, session.user.id)))
      .returning()

    if (result.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Return updated task with template info
    const [updated] = await db
      .select({
        id: tasks.id,
        name: tasks.name,
        status: tasks.status,
        transcript: tasks.transcript,
        templateId: tasks.templateId,
        templateName: templates.name,
        templateMarkdown: templates.markdown,
        result: tasks.result,
        error: tasks.error,
        progress: tasks.progress,
        progressMessage: tasks.progressMessage,
        userId: tasks.userId,
        createdAt: tasks.createdAt,
        startedAt: tasks.startedAt,
        completedAt: tasks.completedAt,
      })
      .from(tasks)
      .leftJoin(templates, eq(tasks.templateId, templates.id))
      .where(eq(tasks.id, id))
      .limit(1)

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating task:", error)
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    )
  }
}
