import type { NextRequest } from "next/server"
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib"

import { parseMarkdownToBlocks, stripInlineMarkdown, type MarkdownBlock } from "@/lib/markdown"
import type { SpecData } from "@/components/spec-editor"
import { specToMarkdown } from "@/lib/spec-markdown"

export async function POST(req: NextRequest) {
  const { spec, summary } = (await req.json()) as { spec: SpecData; summary?: string }
  if (!spec) return new Response("Missing spec", { status: 400 })

  // Convert spec to markdown first
  const markdown = specToMarkdown(spec, summary)
  const blocks = parseMarkdownToBlocks(markdown)

  const pdfDoc = await PDFDocument.create()
  const pageSize: [number, number] = [612, 792]
  let page = pdfDoc.addPage(pageSize)
  const margin = 48
  let y = pageSize[1] - margin
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const courier = await pdfDoc.embedFont(StandardFonts.Courier)
  const fontSize = 11

  function writeText(text: string, useBold = false) {
    const sanitized = stripInlineMarkdown(text)
    if (!sanitized) return
    const lines = wrapText(sanitized, pageSize[0] - margin * 2, font, fontSize)
    lines.forEach((line) => {
      ensureLine(14)
      page.drawText(line, { x: margin, y, size: fontSize, font: useBold ? bold : font })
    })
    y -= 6
  }

  function writeList(items: string[]) {
    items
      .map((item) => stripInlineMarkdown(item))
      .filter((item) => item.length > 0)
      .forEach((item) => {
        const lines = wrapText(item, pageSize[0] - margin * 2 - 14, font, fontSize)
        lines.forEach((line, idx) => {
          ensureLine(14)
          page.drawText((idx === 0 ? "• " : "  ") + line, {
            x: margin,
            y,
            size: fontSize,
            font,
          })
        })
      })
    y -= 4
  }

  function writeMonospace(text: string) {
    if (!text) return
    const lines = text.split(/\r?\n/)
    lines.forEach((line) => {
      ensureLine(12)
      page.drawText(line, {
        x: margin,
        y,
        size: 9,
        font: courier,
        color: rgb(0.2, 0.2, 0.2),
      })
    })
    y -= 6
  }

  function newPage() {
    page = pdfDoc.addPage(pageSize)
    y = pageSize[1] - margin
  }

  function ensureLine(lineHeight: number) {
    if (y - lineHeight < margin) {
      newPage()
    }
    y -= lineHeight
  }

  blocks.forEach((block) => {
    switch (block.type) {
      case "heading": {
        const size = block.level <= 1 ? 16 : block.level === 2 ? 13 : 11
        ensureLine(size + 6)
        page.drawText(block.text, { x: margin, y, size, font: bold, color: rgb(0.1, 0.1, 0.1) })
        y -= 6
        break
      }
      case "list":
        writeList(block.items)
        break
      case "code":
        writeMonospace(block.text)
        break
      case "paragraph":
      default:
        if (block.text.trim()) {
          writeText(block.text)
        }
        break
    }
  })

  const bytes = await pdfDoc.save()
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return new Response(arrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="product-spec.pdf"',
    },
  })
}

// Basic text wrapper for pdf-lib
function wrapText(text: string, maxWidth: number, font: PDFFont, size: number) {
  const words = (text || "").split(/\s+/)
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    const width = font.widthOfTextAtSize(test, size)
    if (width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}
