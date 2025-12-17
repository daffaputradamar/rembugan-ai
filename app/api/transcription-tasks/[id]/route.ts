import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/db"
import { transcriptionTasks } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { SpeechClient } from "@google-cloud/speech"

// Lazy initialization of Speech client
let speechClient: SpeechClient | null = null

function getSpeechClient(): SpeechClient {
  if (!speechClient) {
    const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS

    if (credentialsJson) {
      const parsedCredentials = JSON.parse(credentialsJson)
      speechClient = new SpeechClient({ credentials: parsedCredentials })
    } else if (credentials) {
      speechClient = new SpeechClient()
    } else {
      throw new Error(
        "Google Cloud credentials not configured. Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_CREDENTIALS_JSON environment variable."
      )
    }
  }
  return speechClient
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: taskId } = await params

    // Fetch task
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

    // If task is already completed or failed, return current state
    if (task.status === "completed" || task.status === "failed") {
      return NextResponse.json({ task })
    }

    // If task has no operation name, something went wrong
    if (!task.operationName) {
      await db
        .update(transcriptionTasks)
        .set({ 
          status: "failed", 
          error: "No operation name found",
          completedAt: new Date()
        })
        .where(eq(transcriptionTasks.id, taskId))
      
      return NextResponse.json({ 
        error: "Invalid task state",
        task: { ...task, status: "failed" }
      }, { status: 500 })
    }

    // Poll Google operation
    try {
      const client = getSpeechClient()
      const operation = await client.checkLongRunningRecognizeProgress(task.operationName)

      if (operation.done) {
        if (operation.error) {
          // Operation failed
          await db
            .update(transcriptionTasks)
            .set({
              status: "failed",
              error: operation.error.message || "Transcription failed",
              completedAt: new Date(),
            })
            .where(eq(transcriptionTasks.id, taskId))

          return NextResponse.json({
            task: {
              ...task,
              status: "failed",
              error: operation.error.message,
            },
          })
        }

        // Operation completed successfully
        const response = operation.result as any
        console.log("Total results:", response?.results?.length);
        if (!response?.results || response.results.length === 0) {
            
          await db
            .update(transcriptionTasks)
            .set({
              status: "failed",
              error: "No transcription results",
              completedAt: new Date(),
            })
            .where(eq(transcriptionTasks.id, taskId))

          return NextResponse.json({
            task: {
              ...task,
              status: "failed",
              error: "No transcription results",
            },
          })
        }

        // Format results with proper speaker diarization
        const allWords: Array<{ word: string; speakerTag?: number; startTime?: number }> = []
        
        for (const result of response.results) {
          if (result.alternatives?.[0]?.words) {
            for (const wordInfo of result.alternatives[0].words) {
              const seconds = Number(wordInfo.startTime?.seconds || 0)
              const nanos = Number(wordInfo.startTime?.nanos || 0)
              const tag = wordInfo.speakerTag

              // Skip untagged (0) to avoid duplication
              if (!tag || tag <= 0) continue

              allWords.push({
                word: wordInfo.word,
                speakerTag: tag,
                startTime: seconds + nanos / 1_000_000_000,
              })
            }
          }
        }

        // Sort by time to avoid out-of-order segments
        allWords.sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0))

        const uniqueTags = [...new Set(allWords.map(w => w.speakerTag))]
        console.log("Total words collected (tagged >0):", allWords.length)
        console.log("First 5 words:", allWords.slice(0, 5))
        console.log("Unique speaker tags:", uniqueTags)

        let transcript = ""
        if (allWords.length > 0) {
          // Group by speaker
          const segments: Array<{ speaker: number; text: string }> = []
          let currentSpeaker = allWords[0].speakerTag ?? 1
          let currentText = ""

          for (const { word, speakerTag } of allWords) {
            const speaker = speakerTag ?? currentSpeaker
            if (speaker !== currentSpeaker && currentText.trim()) {
              segments.push({ speaker: currentSpeaker ?? 1, text: currentText.trim() })
              currentText = ""
              currentSpeaker = speaker ?? 1
            }
            currentText += word + " "
          }

          if (currentText.trim()) {
            segments.push({ speaker: currentSpeaker ?? 1, text: currentText.trim() })
          }

          console.log("Total segments:", segments.length)
          console.log("Segments by speaker:", segments.reduce((acc, s) => {
            acc[s.speaker] = (acc[s.speaker] || 0) + 1
            return acc
          }, {} as Record<number, number>))

          // If diarization produced only one segment or one tag, fallback to full transcript
          if (segments.length <= 1 || uniqueTags.length <= 1) {
            transcript = response.results
              .map((r: any) => r.alternatives?.[0]?.transcript || "")
              .join(" \n")
          } else {
            transcript = segments
              .map(seg => `Speaker ${seg.speaker}: ${seg.text}`)
              .join("\n\n")
          }
        } else {
          // Fallback: just concatenate all text
          transcript = response.results
            .map((r: any) => r.alternatives?.[0]?.transcript || "")
            .join(" ")
        }

        const wordCount = transcript.split(/\s+/).length

        // Update task
        await db
          .update(transcriptionTasks)
          .set({
            status: "completed",
            result: transcript,
            wordCount,
            completedAt: new Date(),
          })
          .where(eq(transcriptionTasks.id, taskId))

        return NextResponse.json({
          task: {
            ...task,
            status: "completed",
            result: transcript,
            wordCount,
          },
        })
      } else {
        // Still processing
        return NextResponse.json({
          task: {
            ...task,
            status: "processing",
          },
        })
      }
    } catch (operationError) {
      console.error("Error checking operation:", operationError)
      
      // Mark as failed
      await db
        .update(transcriptionTasks)
        .set({
          status: "failed",
          error: operationError instanceof Error ? operationError.message : "Unknown error",
          completedAt: new Date(),
        })
        .where(eq(transcriptionTasks.id, taskId))

      return NextResponse.json({
        error: "Failed to check transcription status",
        task: {
          ...task,
          status: "failed",
        },
      }, { status: 500 })
    }
  } catch (error) {
    console.error("Error fetching transcription task:", error)
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    )
  }
}

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

    // Fetch task to verify ownership
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

    // Delete the task from database
    await db
      .delete(transcriptionTasks)
      .where(eq(transcriptionTasks.id, taskId))

    return NextResponse.json({
      message: "Task deleted successfully",
      taskId,
    })
  } catch (error) {
    console.error("Error deleting transcription task:", error)
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    )
  }
}
