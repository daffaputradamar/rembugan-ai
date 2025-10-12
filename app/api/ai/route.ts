import type { NextRequest } from "next/server"
import { generateObject, generateText } from "ai"
import { google } from "@ai-sdk/google"
import { z } from "zod"


// Note: Next.js handles provider configuration via the AI Gateway. You only pass a model string.
const MODEL = google("gemini-2.5-flash")

const systemPreamble = `
You are an expert product manager and technical writer.
Return concise, clear results grounded in the provided transcript.
Respond exclusively in Bahasa Indonesia.
`

const summarizePrompt = (text: string) => `
${systemPreamble}

Task: Summarize the following meeting transcript into a concise, human-readable summary in Bahasa Indonesia.
- Tangkap ide utama, keputusan, pemangku kepentingan, dan tantangan.
- Usahakan tetap di bawah 200 kata jika memungkinkan.

Transcript:
"""
${text}
"""
`

const specPrompt = (text: string) => `
${systemPreamble}

Tugas: Dari transkrip rapat berikut, lengkapi data produk dengan Bahasa Indonesia yang ringkas dan jelas.
- "summary": ringkasan <= 150 kata.
- "spec.productOverview": konteks produk.
- "spec.*": isi daftar poin (boleh kosong jika tidak relevan).

Transcript:
"""
${text}
"""
`

const listField = (description: string) => z.array(z.string().min(1).describe(description)).describe(description)

const specSchema = z.object({
  summary: z
    .string()
    .min(1)
    .max(800)
    .describe("Ringkasan rapat dalam Bahasa Indonesia, maksimum 150 kata."),
  spec: z.object({
    productOverview: z
      .string()
      .min(1)
      .describe("Gambaran singkat produk dan latar belakangnya."),
    objectives: listField("Daftar tujuan utama yang ingin dicapai."),
    keyFeatures: listField("Fitur kunci yang disorot dalam diskusi."),
    functionalRequirements: listField("Kebutuhan fungsional sistem."),
    nonFunctionalRequirements: listField("Kebutuhan non-fungsional seperti performa atau keamanan."),
    userStories: listField("User story dalam format Bahasa Indonesia."),
    constraintsRisks: listField("Keterbatasan atau risiko yang harus diperhatikan."),
    openQuestions: listField("Pertanyaan terbuka yang belum terjawab."),
    uiUxRequirements: listField("Kebutuhan antarmuka atau pengalaman pengguna."),
  }),
})

type SpecResult = z.infer<typeof specSchema>

export async function POST(req: NextRequest) {
  const { text, mode } = await req.json()
  if (!text || !mode) {
    return new Response(JSON.stringify({ error: "Missing text or mode" }), { status: 400 })
  }

  try {
    if (mode === "summarize") {
      const { text: out } = await generateText({
        model: MODEL,
        prompt: summarizePrompt(text),
      })
      return new Response(JSON.stringify({ summary: out?.trim() || "" }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    if (mode === "spec") {
      const result = await generateObject({
        model: MODEL,
        schema: specSchema,
        prompt: specPrompt(text),
      })

      const data: SpecResult = result.object
      const { summary, spec } = data

      return new Response(JSON.stringify({ summary, spec }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ error: "Unsupported mode" }), { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "AI error"
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
}
