import type { NextRequest } from "next/server"
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx"

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

  const summaryText = summary ?? ""
  const summaryBlocks = parseMarkdownToBlocks(summaryText)

  const doc = new Document({
    sections: [
      {
        children: [
          ...renderSummary(summaryBlocks, summaryText),
          new Paragraph({ text: "Product Specification", heading: HeadingLevel.HEADING_1 }),
          ...(spec.productOverview
            ? [
                new Paragraph({
                  text: "Product Overview",
                  heading: HeadingLevel.HEADING_2,
                }),
                ...splitLines(stripInlineMarkdown(spec.productOverview)),
              ]
            : []),
          ...listSection("Objectives", spec.objectives),
          ...listSection("Key Features", spec.keyFeatures),
          ...listSection("Functional Requirements", spec.functionalRequirements),
          ...listSection("Non-functional Requirements", spec.nonFunctionalRequirements),
          ...listSection("User Stories", spec.userStories),
          ...listSection("Constraints / Risks", spec.constraintsRisks),
          ...listSection("Open Questions", spec.openQuestions),
          ...listSection("UI/UX Requirements", spec.uiUxRequirements),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const arrayBuffer = await blob.arrayBuffer()
  return new Response(arrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'attachment; filename="product-spec.docx"',
    },
  })
}

function splitLines(text: string) {
  return (text || "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => new Paragraph({ children: [new TextRun(stripInlineMarkdown(line))] }))
}

function listSection(title: string, items: string[]) {
  if (!items || items.length === 0) return []
  const children = [
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_2 }),
    ...items.map(
      (i) =>
        new Paragraph({
          text: stripInlineMarkdown(i),
          bullet: { level: 0 },
        }),
    ),
  ]
  return children
}

function renderSummary(blocks: MarkdownBlock[], fallback: string) {
  const sanitizedFallback = stripInlineMarkdown(fallback)
  if (blocks.length === 0 && !sanitizedFallback) return []
  const children: Paragraph[] = [new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_1 })]
  const source: MarkdownBlock[] = blocks.length > 0 ? blocks : [{ type: "paragraph", text: sanitizedFallback }]
  source.forEach((block) => {
    switch (block.type) {
      case "heading":
        children.push(new Paragraph({ text: block.text, heading: mapHeadingLevel(block.level) }))
        break
      case "list":
        block.items.forEach((item) => {
          children.push(
            new Paragraph({
              text: item,
              bullet: { level: 0 },
            }),
          )
        })
        break
      case "paragraph":
      default:
        children.push(new Paragraph({ children: [new TextRun(block.text)] }))
        break
    }
  })

  return children
}

function mapHeadingLevel(level: number) {
  const mapping = [
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
  ]
  return mapping[Math.min(Math.max(level, 1), mapping.length) - 1] ?? HeadingLevel.HEADING_2
}
