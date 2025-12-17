import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { SpeechClient, protos } from "@google-cloud/speech"
import { Storage } from "@google-cloud/storage"
import { db } from "@/db"
import { transcriptionTasks } from "@/db/schema"
import { eq } from "drizzle-orm"

// Audio encoding mapping
const ENCODING_MAP: Record<string, protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding> = {
  ".wav": protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.LINEAR16,
  ".mp3": protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.MP3,
  ".flac": protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.FLAC,
  ".ogg": protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.OGG_OPUS,
  ".webm": protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.WEBM_OPUS,
  ".m4a": protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.MP3,
}

// Sample rate hints for common formats
const SAMPLE_RATE_MAP: Record<string, number> = {
  ".wav": 16000,
  ".mp3": 16000,
  ".flac": 16000,
  ".ogg": 16000,
  ".webm": 48000,
  ".m4a": 16000,
}

// Clients (lazy)
let speechClient: SpeechClient | null = null
let storageClient: Storage | null = null

function getSpeechClient(): SpeechClient {
  if (!speechClient) {
    const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS

    if (credentialsJson) {
      speechClient = new SpeechClient({ credentials: JSON.parse(credentialsJson) })
    } else if (credentialsPath) {
      speechClient = new SpeechClient()
    } else {
      throw new Error("Google Cloud credentials not configured. Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_CREDENTIALS_JSON.")
    }
  }
  return speechClient
}

function getStorageClient(): Storage {
  if (!storageClient) {
    const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS

    if (credentialsJson) {
      storageClient = new Storage({ credentials: JSON.parse(credentialsJson) })
    } else if (credentialsPath) {
      storageClient = new Storage()
    } else {
      throw new Error("Google Cloud credentials not configured")
    }
  }
  return storageClient
}

async function uploadToGCS(buffer: Buffer, fileName: string, bucketName: string): Promise<string> {
  const storage = getStorageClient()
  const bucket = storage.bucket(bucketName)
  const uniqueFileName = `audio-transcripts/${Date.now()}-${fileName}`
  const file = bucket.file(uniqueFileName)

  await file.save(buffer, {
    metadata: { contentType: "audio/mpeg" },
  })

  return `gs://${bucketName}/${uniqueFileName}`
}

function buildConfig(ext: string, languageCode: string): protos.google.cloud.speech.v1.IRecognitionConfig {
  const encoding =
    ENCODING_MAP[ext] ||
    protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.ENCODING_UNSPECIFIED
  const sampleRateHertz = SAMPLE_RATE_MAP[ext] || 16000

  return {
    encoding,
    sampleRateHertz,
    languageCode,
    enableAutomaticPunctuation: true,
    enableWordTimeOffsets: true,
    model: "latest_long",
    useEnhanced: true,
    diarizationConfig: {
      enableSpeakerDiarization: true,
      minSpeakerCount: 2,
      maxSpeakerCount: 10,
    },
  }
}

function formatResults(
  results:
    | protos.google.cloud.speech.v1.ISpeechRecognitionResult[]
    | protos.google.cloud.speech.v1.SpeechRecognitionResult[]
    | null
    | undefined
) {
  if (!results || results.length === 0) {
    console.log("formatResults input empty", {
      hasResults: !!results,
      resultCount: results?.length ?? 0,
    })
    return { transcript: "", wordCount: 0 }
  }

  console.log("formatResults input", {
    resultCount: results.length,
    firstResult: results[0],
    hasAlternatives: !!results[0]?.alternatives,
    alternativeCount: results[0]?.alternatives?.length || 0,
    firstAlternative: results[0]?.alternatives?.[0],
  })

  let transcript = ""
  const transcriptParts: string[] = []
  const allWords: Array<{ word: string; speaker: number }> = []
  
  for (const result of results) {
    const alternative = result.alternatives?.[0]
    if (!alternative) continue

    if (alternative.words && alternative.words.length > 0) {
      for (const wordInfo of alternative.words) {
        allWords.push({
          word: wordInfo.word || "",
          speaker: wordInfo.speakerTag || 1,
        })
      }
    }

    if (alternative.transcript) {
      transcriptParts.push(alternative.transcript)
    }
  }

  // If diarization exists, group by speaker
  if (allWords.length > 0) {
    let currentSpeaker = allWords[0].speaker
    let currentText = ""

    for (const { word, speaker } of allWords) {
      if (speaker !== currentSpeaker) {
        if (currentText.trim()) {
          transcript += `Speaker ${currentSpeaker}: ${currentText.trim()}\n\n`
        }
        currentSpeaker = speaker
        currentText = word + " "
      } else {
        currentText += word + " "
      }
    }

    if (currentText.trim()) {
      transcript += `Speaker ${currentSpeaker}: ${currentText.trim()}\n`
    }
  }

  // Fallback: join transcripts if no diarization text built
  if (!transcript.trim() && transcriptParts.length > 0) {
    transcript = transcriptParts.join("\n").trim()
  }

  const wordCount = transcript.split(/\s+/).filter(Boolean).length
  return { transcript: transcript.trim(), wordCount }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const fileName = file.name.toLowerCase()
    const ext = fileName.substring(fileName.lastIndexOf("."))

    const supportedFormats = [".wav", ".mp3", ".flac", ".ogg", ".webm", ".m4a"]
    if (!supportedFormats.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported audio format. Supported formats: ${supportedFormats.join(", ")}` },
        { status: 400 }
      )
    }

    const asyncParam = formData.get("async")?.toString()
    const modeParam = formData.get("mode")?.toString()
    let useAsync = asyncParam === "true" || modeParam === "async"
    let useGCS = false

    const maxSyncSize = 500 * 1024
    const maxInlineSize = 1 * 1024 * 1024
    const maxGCSSize = 100 * 1024 * 1024

    if (file.size > maxGCSSize) {
      return NextResponse.json(
        {
          error: "Audio file too large",
          details: "Maximum file size is 100MB. Please split your recording into smaller segments.",
        },
        { status: 400 }
      )
    }

    if (file.size > maxInlineSize) {
      useGCS = true
      useAsync = true
    } else if (file.size > maxSyncSize) {
      useAsync = true
    }

    const languageCode = formData.get("language")?.toString() || "id-ID"

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const config = buildConfig(ext, languageCode)
    const client = getSpeechClient()

    console.log("Audio file info:", {
      fileName,
      fileSize: file.size,
      bufferSize: buffer.length,
      ext,
      languageCode,
      encoding: config.encoding,
      sampleRateHertz: config.sampleRateHertz,
      useGCS,
      useAsync,
    })

    let audio: protos.google.cloud.speech.v1.IRecognitionAudio

    if (useGCS) {
      const bucketName = process.env.GCS_BUCKET_NAME || process.env.GOOGLE_CLOUD_BUCKET
      if (!bucketName) {
        return NextResponse.json(
          {
            error: "GCS bucket not configured",
            details: "Large audio files require Google Cloud Storage. Set GCS_BUCKET_NAME environment variable.",
          },
          { status: 500 }
        )
      }

      try {
        const gcsUri = await uploadToGCS(buffer, fileName, bucketName)
        audio = { uri: gcsUri }

        const [task] = await db
          .insert(transcriptionTasks)
          .values({
            fileName,
            fileSize: file.size,
            status: "processing",
            gcsUri,
            language: languageCode,
            userId: session.user.id,
            startedAt: new Date(),
          })
          .returning()

        const [operation] = await client.longRunningRecognize({ config, audio })

        await db
          .update(transcriptionTasks)
          .set({ operationName: operation.name })
          .where(eq(transcriptionTasks.id, task.id))

        return NextResponse.json({ taskId: task.id, status: "processing", fileName })
      } catch (gcsError) {
        console.error("GCS upload error:", gcsError)
        return NextResponse.json(
          {
            error: "Failed to upload audio to cloud storage",
            details: gcsError instanceof Error ? gcsError.message : "Unknown error",
          },
          { status: 500 }
        )
      }
    } else {
      const audioBytes = buffer.toString("base64")
      audio = { content: audioBytes }
    }

    if (useAsync) {
      const [task] = await db
        .insert(transcriptionTasks)
        .values({
          fileName,
          fileSize: file.size,
          status: "processing",
          language: languageCode,
          userId: session.user.id,
          startedAt: new Date(),
        })
        .returning()

      const [operation] = await client.longRunningRecognize({ config, audio })

      await db
        .update(transcriptionTasks)
        .set({ operationName: operation.name })
        .where(eq(transcriptionTasks.id, task.id))

      return NextResponse.json({ taskId: task.id, status: "processing", fileName })
    }

    // Sync path
    const [response] = await client.recognize({ config, audio })
    console.log("Transcription response:", {
      hasResults: !!response.results,
      resultCount: response.results?.length || 0,
      results: response.results,
    })

    if (!response.results || response.results.length === 0) {
      return NextResponse.json(
        { error: "No transcription results. Audio may be empty or unclear." },
        { status: 400 }
      )
    }

    const { transcript, wordCount } = formatResults(response.results)
    console.log("After formatResults:", { transcript, wordCount, isEmpty: !transcript?.trim() })

    let finalTranscript = transcript
    let finalWordCount = wordCount

    if (!finalTranscript || finalTranscript.trim().length === 0) {
      const fallback = (response.results || [])
        .map((r) => r.alternatives?.[0]?.transcript || "")
        .filter(Boolean)
        .join("\n")

      if (fallback.trim().length > 0) {
        finalTranscript = fallback.trim()
        finalWordCount = finalTranscript.split(/\s+/).filter(Boolean).length
        console.log("Using fallback transcript", { finalWordCount })
      }
    }

    if (!finalTranscript || finalTranscript.trim().length === 0) {
      console.error("Transcript is empty after formatting and fallback. Results:", response.results)
      return NextResponse.json(
        {
          error: "No transcription text extracted. The audio may be unclear, silent, or in an unsupported format.",
        },
        { status: 400 }
      )
    }

    const [task] = await db
      .insert(transcriptionTasks)
      .values({
        fileName,
        fileSize: file.size,
        status: "completed",
        language: languageCode,
        result: finalTranscript,
        wordCount: finalWordCount,
        userId: session.user.id,
        startedAt: new Date(),
        completedAt: new Date(),
      })
      .returning()

    return NextResponse.json({
      taskId: task.id,
      status: "completed",
      transcript: finalTranscript,
      fileName,
    })
  } catch (error) {
    console.error("Error transcribing audio:", error)

    if (error instanceof Error) {
      if (error.message.includes("credentials")) {
        return NextResponse.json(
          { error: "Google Cloud Speech API credentials not configured" },
          { status: 500 }
        )
      }
      if (error.message.includes("quota")) {
        return NextResponse.json(
          { error: "API quota exceeded. Please try again later." },
          { status: 429 }
        )
      }
      if (error.message.includes("duration limit") || error.message.includes("GCS URI")) {
        return NextResponse.json(
          {
            error: "Audio file too long",
            details: "Your audio exceeds the ~1 minute limit for inline transcription. Please split into shorter clips.",
          },
          { status: 400 }
        )
      }
      if (error.message.includes("Sync input too long")) {
        return NextResponse.json(
          {
            error: "Audio too long for sync transcription",
            details: "Processing asynchronously... This should not happen. Please try again.",
          },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({ error: "Failed to transcribe audio. Please try again." }, { status: 500 })
  }
}

// Poll long-running transcription result
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const operationName = searchParams.get("operation") || searchParams.get("op")
    const language = searchParams.get("language") || "id-ID"

    if (!operationName) {
      return NextResponse.json({ error: "Missing operation id" }, { status: 400 })
    }

    const client = getSpeechClient()
    const checked = await client.checkLongRunningRecognizeProgress(operationName)

    if (!checked.latestResponse?.done) {
      return NextResponse.json({ done: false, operationName })
    }

    const [response] = await checked.promise()
    const { transcript, wordCount } = formatResults(response.results || [])
    return NextResponse.json({ done: true, operationName, text: transcript, language, wordCount })
  } catch (error) {
    console.error("Error checking transcription status:", error)
    return NextResponse.json({ error: "Failed to check operation" }, { status: 500 })
  }
}
