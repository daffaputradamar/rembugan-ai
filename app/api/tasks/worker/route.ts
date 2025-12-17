import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { tasks, templates } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { generateText } from "@/lib/llm"

// POST /api/tasks/worker - Process a task (called internally or by cron)
// Note: This endpoint doesn't require authentication as it's an internal worker
// that processes tasks already created by authenticated users
export async function POST(req: NextRequest) {
  try {
    console.log('[Worker] POST endpoint called')
    const body = await req.json()
    const { taskId } = body
    console.log('[Worker] Processing task:', taskId)

    // If taskId provided, process that specific task
    // Otherwise, pick up the oldest pending task
    let taskToProcess: string | null = taskId || null

    if (!taskToProcess) {
      // Find oldest pending task
      const [pendingTask] = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(eq(tasks.status, "pending"))
        .orderBy(tasks.createdAt)
        .limit(1)

      taskToProcess = pendingTask?.id || null
      console.log('[Worker] Found pending task:', taskToProcess)
    }

    if (!taskToProcess) {
      console.log('[Worker] No pending tasks')
      return NextResponse.json({ message: "No pending tasks" })
    }

    // Process the task
    console.log('[Worker] Starting to process task:', taskToProcess)
    const result = await processTask(taskToProcess)
    console.log('[Worker] Task processed:', result)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error("[Worker] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Worker failed" },
      { status: 500 }
    )
  }
}

// GET /api/tasks/worker - Process all pending tasks (cron endpoint)
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret if needed
    const authHeader = req.headers.get("authorization")
    // if (authHeader !== `Bearer ${WORKER_SECRET}`) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    // }

    // Find all pending tasks
    const pendingTasks = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.status, "pending"))
      .orderBy(tasks.createdAt)
      .limit(5) // Process up to 5 at a time

    const results = []
    for (const task of pendingTasks) {
      try {
        const result = await processTask(task.id)
        results.push({ id: task.id, ...result })
      } catch (error) {
        results.push({ 
          id: task.id, 
          error: error instanceof Error ? error.message : "Unknown error" 
        })
      }
    }

    return NextResponse.json({ processed: results.length, results })
  } catch (error) {
    console.error("Worker cron error:", error)
    return NextResponse.json(
      { error: "Worker cron failed" },
      { status: 500 }
    )
  }
}

// Main task processing function
export async function processTask(taskId: string) {
  console.log('[processTask] Starting for task:', taskId)
  
  try {
    // Mark as processing
    await db
      .update(tasks)
      .set({
        status: "processing",
        startedAt: new Date(),
        progress: 10,
        progressMessage: "Starting processing...",
      })
      .where(eq(tasks.id, taskId))
    
    console.log('[processTask] Marked as processing')

    // Get task details
    const [task] = await db
      .select({
        id: tasks.id,
        transcript: tasks.transcript,
        templateId: tasks.templateId,
      })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1)

    if (!task) {
      throw new Error("Task not found")
    }
    
    console.log('[processTask] Got task details, transcript length:', task.transcript.length)

    // Get template if specified
    let templateMarkdown = getDefaultTemplate()
    if (task.templateId) {
      const [template] = await db
        .select({ markdown: templates.markdown })
        .from(templates)
        .where(eq(templates.id, task.templateId))
        .limit(1)

      if (template?.markdown) {
        templateMarkdown = template.markdown
      }
    }

    // Update progress
    await db
      .update(tasks)
      .set({
        progress: 30,
        progressMessage: "Analyzing transcript...",
      })
      .where(eq(tasks.id, taskId))

    // Generate document
    const prompt = buildPrompt(task.transcript, templateMarkdown)
    
    await db
      .update(tasks)
      .set({
        progress: 50,
        progressMessage: "Generating document...",
      })
      .where(eq(tasks.id, taskId))

    console.log('[processTask] Calling LLM...')
    const result = await generateText(prompt, {
      systemPrompt: "You are an expert document generator. Generate professional documents based on meeting transcripts. Output in Bahasa Indonesia. Use markdown formatting.",
      temperature: 0.3,
      maxInputChars: 250000
    })
    
    console.log('[processTask] LLM completed, result length:', result?.length || 0)

    // Update progress
    await db
      .update(tasks)
      .set({
        progress: 90,
        progressMessage: "Finalizing...",
      })
      .where(eq(tasks.id, taskId))

    // Mark as completed
    await db
      .update(tasks)
      .set({
        status: "completed",
        result: result || "No output generated",
        completedAt: new Date(),
        progress: 100,
        progressMessage: "Completed",
      })
      .where(eq(tasks.id, taskId))

    return { status: "completed", taskId }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    
    // Mark as failed
    await db
      .update(tasks)
      .set({
        status: "failed",
        error: errorMessage,
        completedAt: new Date(),
        progress: 0,
        progressMessage: "Failed",
      })
      .where(eq(tasks.id, taskId))

    return { status: "failed", taskId, error: errorMessage }
  }
}

// Build prompt from transcript and template
function buildPrompt(transcript: string, template: string): string {
  return `Buat dokumen berdasarkan transkrip rapat berikut.

Format output yang diinginkan:
${template}

Transkrip Rapat:
"""
${transcript}
"""

PENTING:
- Output dalam format markdown sesuai template di atas
- Gunakan Bahasa Indonesia
- Jika informasi tidak tersedia, tulis "Tidak disebutkan"
- Jangan menambahkan informasi yang tidak ada di transkrip`
}

// Default MoM template
function getDefaultTemplate(): string {
  return `# Minutes of Meeting

## Informasi Rapat
- **Project:** [nama project]
- **Meeting Title:** [judul meeting]
- **Date:** [tanggal]
- **Time:** [waktu]
- **Location:** [lokasi]
- **Facilitator:** [nama]
- **Note Taker:** [nama]

## 📌 Meeting Objective
[1-2 kalimat tujuan rapat]

## 🧑‍💻 Attendees
| Name | Role |
|------|------|
| [nama] | [role] |

## 📄 Discussion Summary
| Topic | Key Points | Decision |
|-------|------------|----------|
| [topik] | [poin] | [keputusan] |

## ✅ Action Items
| No | Action | PIC | Due Date |
|----|--------|-----|----------|
| 1 | [action] | [nama] | [tanggal] |

## ❓ Open Questions
| No | Question | Owner |
|----|----------|-------|
| 1 | [pertanyaan] | [nama] |

## ⚠️ Risks & Issues
| No | Risk/Issue | Impact | Mitigation |
|----|------------|--------|------------|
| 1 | [risiko] | [dampak] | [mitigasi] |

## 📅 Next Meeting
- **Date:** [tanggal]
- **Agenda:** [agenda]
- **Expected Outcome:** [hasil yang diharapkan]`
}
