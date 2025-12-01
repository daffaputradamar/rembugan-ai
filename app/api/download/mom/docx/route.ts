import type { NextRequest } from "next/server"
import { 
  Document, 
  Packer, 
  Paragraph, 
  HeadingLevel, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  BorderStyle,
  AlignmentType,
  convertInchesToTwip
} from "docx"

import { parseMarkdownToBlocks } from "@/lib/markdown"

export async function POST(req: NextRequest) {
  const { markdown, filename } = (await req.json()) as { markdown: string; filename?: string }
  if (!markdown) return new Response("Missing markdown content", { status: 400 })

  const blocks = parseMarkdownToBlocks(markdown)

  const children: (Paragraph | Table)[] = []

  blocks.forEach((block, index) => {
    switch (block.type) {
      case "heading":
        // Add spacing before headings (except the first one)
        if (index > 0) {
          children.push(new Paragraph({ text: "", spacing: { before: 240 } }))
        }
        children.push(
          new Paragraph({ 
            text: block.text, 
            heading: mapHeadingLevel(block.level),
            spacing: { after: 120 }
          })
        )
        break
      case "list":
        block.items.forEach((item, itemIndex) => {
          children.push(
            new Paragraph({
              children: [new TextRun(stripInlineMarkdown(item))],
              bullet: { level: 0 },
              spacing: { 
                before: itemIndex === 0 ? 120 : 40,
                after: itemIndex === block.items.length - 1 ? 120 : 40
              }
            }),
          )
        })
        break
      case "table":
        // Add spacing before table
        children.push(new Paragraph({ text: "", spacing: { before: 120 } }))
        
        const tableRows: TableRow[] = []
        
        // Header row
        tableRows.push(
          new TableRow({
            tableHeader: true,
            children: block.headers.map((header) => 
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: header, bold: true })],
                    alignment: AlignmentType.LEFT,
                  })
                ],
                shading: { fill: "E7E6E6" },
                margins: {
                  top: convertInchesToTwip(0.05),
                  bottom: convertInchesToTwip(0.05),
                  left: convertInchesToTwip(0.1),
                  right: convertInchesToTwip(0.1),
                }
              })
            ),
          })
        )
        
        // Data rows
        block.rows.forEach((row) => {
          tableRows.push(
            new TableRow({
              children: row.map((cell) => 
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun(cell)],
                      alignment: AlignmentType.LEFT,
                    })
                  ],
                  margins: {
                    top: convertInchesToTwip(0.05),
                    bottom: convertInchesToTwip(0.05),
                    left: convertInchesToTwip(0.1),
                    right: convertInchesToTwip(0.1),
                  }
                })
              ),
            })
          )
        })
        
        children.push(
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            },
          })
        )
        
        // Add spacing after table
        children.push(new Paragraph({ text: "", spacing: { after: 120 } }))
        break
      case "code":
        children.push(new Paragraph({ text: "", spacing: { before: 80 } }))
        block.text.split(/\r?\n/).forEach((line) => {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line || " ",
                  font: "Courier New",
                  size: 20, // 10pt
                }),
              ],
              shading: { fill: "F5F5F5" },
              spacing: { before: 0, after: 0, line: 276 }
            }),
          )
        })
        children.push(new Paragraph({ text: "", spacing: { after: 80 } }))
        break
      case "paragraph":
      default:
        if (block.text.trim()) {
          children.push(
            new Paragraph({ 
              children: [new TextRun(stripInlineMarkdown(block.text))],
              spacing: { before: 120, after: 120, line: 276 }
            })
          )
        }
        break
    }
  })

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const arrayBuffer = await blob.arrayBuffer()
  const outputFilename = filename || "minutes-of-meeting.docx"
  
  return new Response(arrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${outputFilename}"`,
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

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
}
