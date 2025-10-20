import type { NextRequest } from "next/server"
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx"

import { parseMarkdownToBlocks, stripInlineMarkdown, type MarkdownBlock } from "@/lib/markdown"
import type { SpecData } from "@/components/spec-editor"
import { specToMarkdown } from "@/lib/spec-markdown"

export async function POST(req: NextRequest) {
  const { spec, summary } = (await req.json()) as { spec: SpecData; summary?: string }
  if (!spec) return new Response("Missing spec", { status: 400 })

  // Convert spec to markdown first
  const markdown = specToMarkdown(spec, summary)
  const blocks = parseMarkdownToBlocks(markdown)

  const children: Paragraph[] = []
  
  blocks.forEach((block) => {
    switch (block.type) {
      case "heading":
        children.push(new Paragraph({ text: block.text, heading: mapHeadingLevel(block.level) }))
        break
      case "list":
        block.items.forEach((item) => {
          children.push(
            new Paragraph({
              text: stripInlineMarkdown(item),
              bullet: { level: 0 },
            }),
          )
        })
        break
      case "code":
        // For ASCII diagrams
        block.text.split(/\r?\n/).forEach((line) => {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line,
                  font: "Courier New",
                }),
              ],
            }),
          )
        })
        break
      case "paragraph":
      default:
        if (block.text.trim()) {
          children.push(new Paragraph({ children: [new TextRun(stripInlineMarkdown(block.text))] }))
        }
        break
    }
  })

  const doc = new Document({
    sections: [
      {
        children,
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

function mapHeadingLevel(level: number) {
  const mapping = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
  ]
  return mapping[Math.min(Math.max(level, 1), mapping.length) - 1] ?? HeadingLevel.HEADING_2
}
