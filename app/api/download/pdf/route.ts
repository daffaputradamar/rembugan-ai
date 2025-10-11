import type { NextRequest } from "next/server"
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib"

import { parseMarkdownToBlocks, stripInlineMarkdown, type MarkdownBlock } from "@/lib/markdown"

type SpecData = {
  productOverview: string
  objectives: string[]
  keyFeatures: string[]
  functionalRequirements: string[]
  nonFunctionalRequirements: string[]
  userStories: string[]
  constraintsRisks: string[]
  openQuestions: string[]
  uiUxRequirements: string[]
}

export async function POST(req: NextRequest) {
  const { spec, summary } = (await req.json()) as { spec: SpecData; summary?: string }
  if (!spec) return new Response("Missing spec", { status: 400 })

  const pdfDoc = await PDFDocument.create()
  const pageSize: [number, number] = [612, 792]
  let page = pdfDoc.addPage(pageSize)
  const margin = 48
  let y = pageSize[1] - margin
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontSize = 11

  function writeTitle(text: string) {
    ensureLine(20)
    page.drawText(text, { x: margin, y, size: 16, font: bold, color: rgb(0.1, 0.1, 0.1) })
    y -= 8
  }

  function writeHeading(text: string) {
    ensureLine(18)
    page.drawText(text, { x: margin, y, size: 13, font: bold })
    y -= 6
  }

  function writeText(text: string) {
    const sanitized = stripInlineMarkdown(text)
    if (!sanitized) return
    const lines = wrapText(sanitized, pageSize[0] - margin * 2, font, fontSize)
    lines.forEach((line) => {
      ensureLine(14)
      page.drawText(line, { x: margin, y, size: fontSize, font })
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

  function writeMarkdownBlocks(blocks: MarkdownBlock[]) {
    blocks.forEach((block) => {
      switch (block.type) {
        case "heading": {
          const size = block.level <= 1 ? 13 : block.level === 2 ? 12 : 11
          ensureLine(18)
          page.drawText(block.text, { x: margin, y, size, font: bold })
          y -= 4
          break
        }
        case "list":
          writeList(block.items)
          break
        case "paragraph":
        default:
          writeText(block.text)
          break
      }
    })
  }

  const summaryText = summary ?? ""
  const summaryBlocks = parseMarkdownToBlocks(summaryText)
  if (summaryText) {
    writeTitle("Summary")
    if (summaryBlocks.length) {
      writeMarkdownBlocks(summaryBlocks)
    } else {
      writeText(summaryText)
    }
  }

  writeTitle("Product Specification")

  if (spec.productOverview) {
    writeHeading("Product Overview")
    writeText(spec.productOverview)
  }

  section("Objectives", spec.objectives)
  section("Key Features", spec.keyFeatures)
  section("Functional Requirements", spec.functionalRequirements)
  section("Non-functional Requirements", spec.nonFunctionalRequirements)
  section("User Stories", spec.userStories)
  section("Constraints / Risks", spec.constraintsRisks)
  section("Open Questions", spec.openQuestions)
  section("UI/UX Requirements", spec.uiUxRequirements)

  function section(title: string, items: string[]) {
    if (!items || items.length === 0) return
    writeHeading(title)
    writeList(items)
  }

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
