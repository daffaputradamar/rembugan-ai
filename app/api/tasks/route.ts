import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/db"
import { tasks, templates } from "@/db/schema"
import { eq, desc, and, gte, lte, sql } from "drizzle-orm"
import { processTask } from "./worker/route"

// GET /api/tasks - List user's tasks
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const limit = parseInt(searchParams.get("limit") || "50")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    // Build where conditions
    const conditions = [eq(tasks.userId, session.user.id)]

    // Add status filter
    if (status && status !== "all") {
      conditions.push(sql`${tasks.status} = ${status}`)
    }

    // Add date range filter
    if (startDate) {
      conditions.push(gte(tasks.createdAt, new Date(startDate)))
    }
    if (endDate) {
      conditions.push(lte(tasks.createdAt, new Date(endDate)))
    }

    const results = await db
      .select({
        id: tasks.id,
        name: tasks.name,
        status: tasks.status,
        templateId: tasks.templateId,
        templateName: templates.name,
        progress: tasks.progress,
        progressMessage: tasks.progressMessage,
        error: tasks.error,
        createdAt: tasks.createdAt,
        startedAt: tasks.startedAt,
        completedAt: tasks.completedAt,
      })
      .from(tasks)
      .leftJoin(templates, eq(tasks.templateId, templates.id))
      .where(and(...conditions))
      .orderBy(desc(tasks.createdAt))
      .limit(limit)

    return NextResponse.json(results)
  } catch (error) {
    console.error("Error fetching tasks:", error)
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    )
  }
}

// POST /api/tasks - Create a new task (queue for background processing)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { name, transcript, templateId } = body

    if (!transcript?.trim()) {
      return NextResponse.json(
        { error: "Transcript is required" },
        { status: 400 }
      )
    }

    // Verify template exists and user has access
    if (templateId) {
      const template = await db
        .select()
        .from(templates)
        .where(eq(templates.id, templateId))
        .limit(1)
      
      if (template.length === 0) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        )
      }
    }

    // Create task with pending status
    const [newTask] = await db
      .insert(tasks)
      .values({
        name: name || `Task ${new Date().toLocaleString('id-ID')}`,
        transcript: transcript.trim(),
        templateId: templateId || null,
        userId: session.user.id,
        status: "pending",
        progress: 0,
      })
      .returning()

    // Trigger background processing (non-blocking)
    // Don't await this - let it process in the background
    processTask(newTask.id).catch(err => {
      console.error(`Background processing failed for task ${newTask.id}:`, err)
    })

    return NextResponse.json({
      id: newTask.id,
      name: newTask.name,
      status: newTask.status,
      message: "Task created and queued for processing",
    }, { status: 201 })
  } catch (error) {
    console.error("Error creating task:", error)
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    )
  }
}
