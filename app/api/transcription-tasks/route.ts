import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/db"
import { transcriptionTasks } from "@/db/schema"
import { eq, desc } from "drizzle-orm"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    let query = db
      .select()
      .from(transcriptionTasks)
      .where(eq(transcriptionTasks.userId, session.user.id))
      .$dynamic()

    if (status) {
      query = query.where(eq(transcriptionTasks.status, status as any))
    }

    const tasks = await query.orderBy(desc(transcriptionTasks.createdAt))

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error("Error fetching transcription tasks:", error)
    return NextResponse.json(
      { error: "Failed to fetch transcription tasks" },
      { status: 500 }
    )
  }
}
