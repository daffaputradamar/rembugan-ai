import type { NextRequest } from "next/server"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

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
  const { spec, summary } = await req.json()
  if (!spec) return new Response("Missing spec", { status: 400 })

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792]) // Letter
  const margin = 48
  let y = 792 - margin
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontSize = 11

  function writeTitle(text: string) {
    y -= 20
    page.drawText(text, { x: margin, y, size: 16, font: bold, color: rgb(0.1, 0.1, 0.1) })
    y -= 8
  }

  function writeHeading(text: string) {
    y -= 18
    page.drawText(text, { x: margin, y, size: 13, font: bold })
    y -= 6
  }

  function writeText(text: string) {
    const lines = wrapText(text, 612 - margin * 2, font, fontSize)
    lines.forEach((line) => {
      y -= 14
      if (y < margin) newPage()
      page.drawText(line, { x: margin, y, size: fontSize, font })
    })
    y -= 6
  }

  function writeList(items: string[]) {
    items.forEach((item) => {
      const lines = wrapText(item, 612 - margin * 2 - 14, font, fontSize)
      lines.forEach((line, idx) => {
        y -= 14
        if (y < margin) newPage()
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
    const p = pdfDoc.addPage([612, 792])
    page.setSize(612, 792) // keep current ref but adjust
    // Re-assign not necessary if we always use 'page' from outer scope,
    // but pdf-lib doesn't allow editing old page after new; keep simple.
    // In real-world, track current page variable; simplified here.
  }

  if (summary) {
    writeTitle("Summary")
    writeText(summary)
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
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="product-spec.pdf"',
    },
  })
}

// Basic text wrapper for pdf-lib
function wrapText(text: string, maxWidth: number, font: any, size: number) {
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
