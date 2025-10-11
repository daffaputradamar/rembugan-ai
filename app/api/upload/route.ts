import type { NextRequest } from "next/server"
import * as mammoth from "mammoth"

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) {
    return new Response(JSON.stringify({ error: "No file provided" }), { status: 400 })
  }

  const name = file.name.toLowerCase()
  const buf = Buffer.from(await file.arrayBuffer())

  try {
    if (name.endsWith(".txt")) {
      return new Response(JSON.stringify({ text: buf.toString("utf8") }), {
        headers: { "Content-Type": "application/json" },
      })
    }
    if (name.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer: buf })
      return new Response(JSON.stringify({ text: result.value || "" }), {
        headers: { "Content-Type": "application/json" },
      })
    }
    return new Response(JSON.stringify({ error: "Unsupported file type" }), { status: 415 })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Parse error" }), { status: 500 })
  }
}
