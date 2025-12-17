import type { NextRequest } from "next/server"
import * as mammoth from "mammoth"
import { generateText } from "@/lib/llm"

// Helper function to extract text from PDF using pdf-parse
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import to avoid issues with pdf-parse on edge runtime
    const pdfParseModule = await import("pdf-parse")
    // Handle both ESM and CJS exports
    const parseFn = (pdfParseModule as unknown as { default?: (buf: Buffer) => Promise<{ text: string }> }).default ?? pdfParseModule
    const data = await (parseFn as (buf: Buffer) => Promise<{ text: string }>)(buffer)
    return data.text || ""
  } catch (error) {
    console.error("PDF parsing error:", error)
    throw new Error("Failed to extract text from PDF")
  }
}

// Helper function to convert document text to markdown template
async function convertToMarkdownTemplate(rawText: string, fileName: string): Promise<string> {
  const prompt = `
You are an expert document analyst. Convert the following document text into a clean, reusable Markdown template.

Instructions:
1. Analyze the document structure and identify all sections, headings, tables, and formatting
2. Preserve the exact structure and hierarchy of the document
3. Convert tables to proper Markdown table syntax
4. Replace specific content values with placeholder tokens in the format {{PLACEHOLDER_NAME}}
5. Keep section headings, labels, and structural elements intact
6. Add comments in HTML format (<!-- comment -->) to explain what type of content should go in each section
7. Ensure the template is clean, well-formatted, and ready for use as a meeting minutes/document template
8. If the document has numbered sections, preserve the numbering
9. If there are any bullet points or lists, preserve them in Markdown format

The template should be in Bahasa Indonesia if the original document is in Indonesian.

Source file: ${fileName}

Document text:
"""
${rawText}
"""

Output only the Markdown template without any additional explanation.
`

  const markdownTemplate = await generateText(prompt, {
    systemPrompt: "You are an expert document analyst specializing in converting documents to reusable Markdown templates.",
    temperature: 0.3,
  })

  return markdownTemplate?.trim() || rawText
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const convertToTemplate = formData.get("convertToTemplate") === "true"

  if (!file) {
    return new Response(JSON.stringify({ error: "No file provided" }), { status: 400 })
  }

  const name = file.name.toLowerCase()
  const buf = Buffer.from(await file.arrayBuffer())

  try {
    let rawText = ""

    if (name.endsWith(".txt")) {
      rawText = buf.toString("utf8")
    } else if (name.endsWith(".docx") || name.endsWith(".doc")) {
      const result = await mammoth.extractRawText({ buffer: buf })
      rawText = result.value || ""
    } else if (name.endsWith(".pdf")) {
      rawText = await extractTextFromPDF(buf)
    } else {
      return new Response(
        JSON.stringify({ error: "Unsupported file type. Please upload .txt, .docx, or .pdf files." }),
        { status: 415 }
      )
    }

    if (!rawText.trim()) {
      return new Response(
        JSON.stringify({ error: "Could not extract text from the uploaded file." }),
        { status: 400 }
      )
    }

    // Convert to markdown template if requested
    let markdown = rawText
    if (convertToTemplate) {
      markdown = await convertToMarkdownTemplate(rawText, file.name)
    }

    return new Response(
      JSON.stringify({
        text: rawText,
        markdown,
        fileName: file.name,
        convertedToTemplate: convertToTemplate,
      }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Parse error"
    console.error("Template upload error:", err)
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
}
