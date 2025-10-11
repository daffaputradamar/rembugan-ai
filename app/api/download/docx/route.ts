import type { NextRequest } from "next/server"
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx"

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

  const doc = new Document({
    sections: [
      {
        children: [
          ...(summary
            ? [
                new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_1 }),
                ...summary.split("\n").map((line) => new Paragraph({ children: [new TextRun(line)] })),
              ]
            : []),
          new Paragraph({ text: "Product Specification", heading: HeadingLevel.HEADING_1 }),
          ...(spec.productOverview
            ? [
                new Paragraph({
                  text: "Product Overview",
                  heading: HeadingLevel.HEADING_2,
                }),
                ...splitLines(spec.productOverview),
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
  return new Response(Buffer.from(arrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'attachment; filename="product-spec.docx"',
    },
  })
}

function splitLines(text: string) {
  return (text || "").split("\n").map((line) => new Paragraph({ children: [new TextRun(line)] }))
}

function listSection(title: string, items: string[]) {
  if (!items || items.length === 0) return []
  const children = [
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_2 }),
    ...items.map(
      (i) =>
        new Paragraph({
          text: i,
          bullet: { level: 0 },
        }),
    ),
  ]
  return children
}
