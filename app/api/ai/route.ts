import type { NextRequest } from "next/server"
import { generateText } from "ai"
import { google } from '@ai-sdk/google';


// Note: Next.js handles provider configuration via the AI Gateway. You only pass a model string.
const MODEL =  google('gemini-2.5-flash');

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

Task: From the following meeting transcript, produce:
1) A short summary (<= 150 words) written in Bahasa Indonesia
2) A structured Product Specification in strict JSON with these keys:
{
  "productOverview": string,
  "objectives": string[],
  "keyFeatures": string[],
  "functionalRequirements": string[],
  "nonFunctionalRequirements": string[],
  "userStories": string[],
  "constraintsRisks": string[],
  "openQuestions": string[],
  "uiUxRequirements": string[]
}

Rules:
- Return ONLY valid JSON in a top-level object with keys "summary" and "spec".
- "spec" must match the schema above.
- No markdown, no comments.
- Semua nilai string dan elemen array harus menggunakan Bahasa Indonesia yang alami.

Transcript:
"""
${text}
"""
`

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
      const { text: out } = await generateText({
        model: MODEL,
        prompt: specPrompt(text),
      })

      console.log("Spec output:", out);
      
      let summary = ""
      let spec: any = null
      try {
        const parsed = JSON.parse(out || "{}")
        summary = parsed.summary || ""
        spec = parsed.spec || null
      } catch {
        // Fallback: try to salvage JSON if model added extra text
        const match = out?.match(/\{[\s\S]*\}/)
        if (match) {
          try {
            const parsed = JSON.parse(match[0])
            summary = parsed.summary || ""
            spec = parsed.spec || null
          } catch {}
        }
      }

      if (!spec) {
        return new Response(JSON.stringify({ error: "Model did not return valid spec JSON." }), { status: 502 })
      }

      return new Response(JSON.stringify({ summary, spec }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ error: "Unsupported mode" }), { status: 400 })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "AI error" }), { status: 500 })
  }
}
