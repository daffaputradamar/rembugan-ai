import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/db"
import { transcriptionTasks } from "@/db/schema"
import { eq, and, inArray } from "drizzle-orm"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: taskId } = await params

    // Check if task belongs to user
    const [task] = await db
      .select()
      .from(transcriptionTasks)
      .where(
        and(
          eq(transcriptionTasks.id, taskId),
          eq(transcriptionTasks.userId, session.user.id)
        )
      )

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Delete the task
    await db.delete(transcriptionTasks).where(eq(transcriptionTasks.id, taskId))

    return NextResponse.json({ success: true, message: "Task deleted" })
  } catch (error) {
    console.error("Error deleting transcription task:", error)
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    )
  }
}
