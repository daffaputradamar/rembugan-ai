import type { NextRequest } from "next/server"
import { generateText } from "ai"

// Note: Next.js handles provider configuration via the AI Gateway. You only pass a model string.
const MODEL = "openai/gpt-5-mini"

const systemPreamble = `
You are an expert product manager and technical writer. 
Return concise, clear results grounded in the provided transcript.
`

const summarizePrompt = (text: string) => `
${systemPreamble}

Task: Summarize the following meeting transcript into a concise, human-readable summary.
- Capture key ideas, decisions, stakeholders, and pain points.
- Keep it under 200 words unless necessary.

Transcript:
"""
${text}
"""
`

const specPrompt = (text: string) => `
${systemPreamble}

Task: From the following meeting transcript, produce:
1) A short summary (<= 150 words)
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
