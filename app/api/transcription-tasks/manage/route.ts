import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/db"
import { transcriptionTasks } from "@/db/schema"
import { eq, and, inArray } from "drizzle-orm"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { action, statuses } = body

    if (action === "clear-all") {
      // Clear all logs (completed and failed tasks) for the user
      const result = await db
        .delete(transcriptionTasks)
        .where(
          and(
            eq(transcriptionTasks.userId, session.user.id),
            inArray(transcriptionTasks.status, ["completed", "failed"])
          )
        )

      return NextResponse.json({
        success: true,
        message: "All completed and failed tasks cleared",
      })
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    )
  } catch (error) {
    console.error("Error managing transcription tasks:", error)
    return NextResponse.json(
      { error: "Failed to manage tasks" },
      { status: 500 }
    )
  }
}
