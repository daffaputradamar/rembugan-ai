import { NextRequest, NextResponse } from "next/server"
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"
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

import { auth } from "@/auth"
import { db } from "@/db"
import { tasks } from "@/db/schema"
import { eq } from "drizzle-orm"
import { parseMarkdownToBlocks } from "@/lib/markdown"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch task with template info
    const taskResult = await db
      .select({
        id: tasks.id,
        name: tasks.name,
        result: tasks.result,
        templateId: tasks.templateId,
        userId: tasks.userId,
      })
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1)

    if (!taskResult.length || taskResult[0].userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const taskData = taskResult[0]
    const format = req.nextUrl.searchParams.get("format") || "markdown"

    if (!taskData.result) {
      return NextResponse.json(
        { error: "Task result not available" },
        { status: 400 }
      )
    }

    let templateName = "Default"
    if (taskData.templateId) {
      // This would need a templates table, using templateId for now
      templateName = taskData.templateId
    }

    if (format === "docx") {
      // Generate DOCX with proper markdown parsing
      const blocks = parseMarkdownToBlocks(taskData.result)
      const children: (Paragraph | Table)[] = []

      // Add title
      children.push(
        new Paragraph({
          text: taskData.name,
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 120 },
        })
      )

      // Add metadata
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `Template: ${templateName}`, italics: true })],
          spacing: { after: 60 },
        })
      )
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `Generated: ${new Date().toLocaleString()}`, italics: true })],
          spacing: { after: 240 },
        })
      )

      // Process markdown blocks
      blocks.forEach((block, index) => {
        switch (block.type) {
          case "heading":
            if (index > 0) {
              children.push(new Paragraph({ text: "", spacing: { before: 120 } }))
            }
            children.push(
              new Paragraph({
                text: block.text,
                heading: mapHeadingLevel(block.level),
                spacing: { after: 120 },
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
                    after: itemIndex === block.items.length - 1 ? 120 : 40,
                  },
                })
              )
            })
            break
          case "table":
            children.push(new Paragraph({ text: "", spacing: { before: 120 } }))

            const tableRows: TableRow[] = []

            // Header row
            tableRows.push(
              new TableRow({
                tableHeader: true,
                children: block.headers.map(
                  (header) =>
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: header, bold: true })],
                          alignment: AlignmentType.LEFT,
                        }),
                      ],
                      shading: { fill: "E7E6E6" },
                      margins: {
                        top: convertInchesToTwip(0.05),
                        bottom: convertInchesToTwip(0.05),
                        left: convertInchesToTwip(0.1),
                        right: convertInchesToTwip(0.1),
                      },
                    })
                ),
              })
            )

            // Data rows
            block.rows.forEach((row) => {
              tableRows.push(
                new TableRow({
                  children: row.map(
                    (cell) =>
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [new TextRun(cell)],
                            alignment: AlignmentType.LEFT,
                          }),
                        ],
                        margins: {
                          top: convertInchesToTwip(0.05),
                          bottom: convertInchesToTwip(0.05),
                          left: convertInchesToTwip(0.1),
                          right: convertInchesToTwip(0.1),
                        },
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
                      size: 20,
                    }),
                  ],
                  shading: { fill: "F5F5F5" },
                  spacing: { before: 0, after: 0, line: 276 },
                })
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
                  spacing: { before: 120, after: 120, line: 276 },
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

      return new NextResponse(arrayBuffer, {
        headers: {
          "Content-Disposition": `attachment; filename="${taskData.name}.docx"`,
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      })
    } else if (format === "pdf") {
      // Generate PDF with proper markdown parsing
      const blocks = parseMarkdownToBlocks(taskData.result)
      const pdfDoc = await PDFDocument.create()
      const pageSize: [number, number] = [612, 792]
      let page = pdfDoc.addPage(pageSize)
      const margin = 56
      const contentWidth = pageSize[0] - margin * 2
      let y = pageSize[1] - margin
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      const courier = await pdfDoc.embedFont(StandardFonts.Courier)
      const fontSize = 11
      const lineHeight = 16

      function newPage() {
        page = pdfDoc.addPage(pageSize)
        y = pageSize[1] - margin
      }

      function ensureSpace(height: number) {
        if (y - height < margin) {
          newPage()
        }
      }

      function drawText(
        text: string,
        options: {
          x?: number
          size?: number
          useBold?: boolean
          useFont?: PDFFont
          maxWidth?: number
        } = {}
      ) {
        const {
          x = margin,
          size = fontSize,
          useBold = false,
          useFont,
          maxWidth = contentWidth,
        } = options

        const sanitized = removeNonWinAnsiChars(stripInlineMarkdown(text))
        if (!sanitized) return

        const selectedFont = useFont || (useBold ? bold : font)
        const lines = wrapText(sanitized, maxWidth, selectedFont, size)
        const currentLineHeight = size + 4

        lines.forEach((line) => {
          ensureSpace(currentLineHeight)
          page.drawText(line, { x, y, size, font: selectedFont })
          y -= currentLineHeight
        })
      }

      function addSpacing(space: number) {
        y -= space
        if (y < margin) newPage()
      }

      function drawHeading(text: string, level: number) {
        const size = level <= 1 ? 18 : level === 2 ? 14 : 12
        const spacing = level <= 1 ? 16 : level === 2 ? 12 : 8

        addSpacing(spacing)
        ensureSpace(size + 8)

        const headingText = removeNonWinAnsiChars(text)
        page.drawText(headingText, {
          x: margin,
          y,
          size,
          font: bold,
          color: rgb(0.1, 0.1, 0.1),
        })
        y -= size + 4
        addSpacing(spacing / 2)
      }

      function drawList(items: string[], ordered = false) {
        addSpacing(6)

        items.forEach((item, index) => {
          const sanitized = removeNonWinAnsiChars(stripInlineMarkdown(item))
          if (!sanitized) return

          const prefix = ordered ? `${index + 1}. ` : "• "
          const prefixWidth = font.widthOfTextAtSize(prefix, fontSize)
          const textMaxWidth = contentWidth - prefixWidth - 10
          const lines = wrapText(sanitized, textMaxWidth, font, fontSize)

          lines.forEach((line, lineIndex) => {
            ensureSpace(lineHeight)
            if (lineIndex === 0) {
              page.drawText(prefix, { x: margin, y, size: fontSize, font })
            }
            page.drawText(line, {
              x: margin + prefixWidth,
              y,
              size: fontSize,
              font,
            })
            y -= lineHeight
          })
        })

        addSpacing(6)
      }

      function drawTable(headers: string[], rows: string[][]) {
        addSpacing(10)

        const columnCount = headers.length
        const colWidth = contentWidth / columnCount
        const cellPadding = 6
        const cellFontSize = 9
        const cellLineHeight = 12

        function getRowHeight(cells: string[]): number {
          let maxLines = 1
          cells.forEach((cell) => {
            const sanitized = removeNonWinAnsiChars(cell)
            const lines = wrapText(
              sanitized,
              colWidth - cellPadding * 2,
              font,
              cellFontSize
            )
            maxLines = Math.max(maxLines, lines.length)
          })
          return maxLines * cellLineHeight + cellPadding * 2
        }

        const headerHeight = getRowHeight(headers)
        ensureSpace(headerHeight)

        page.drawRectangle({
          x: margin,
          y: y - headerHeight,
          width: contentWidth,
          height: headerHeight,
          color: rgb(0.92, 0.92, 0.92),
        })

        page.drawLine({
          start: { x: margin, y },
          end: { x: margin + contentWidth, y },
          thickness: 1,
          color: rgb(0.8, 0.8, 0.8),
        })

        headers.forEach((header, colIndex) => {
          const x = margin + colIndex * colWidth
          const sanitized = removeNonWinAnsiChars(header)
          const lines = wrapText(
            sanitized,
            colWidth - cellPadding * 2,
            bold,
            cellFontSize
          )

          let cellY = y - cellPadding - cellFontSize
          lines.forEach((line) => {
            page.drawText(line, {
              x: x + cellPadding,
              y: cellY,
              size: cellFontSize,
              font: bold,
            })
            cellY -= cellLineHeight
          })

          if (colIndex > 0) {
            page.drawLine({
              start: { x, y },
              end: { x, y: y - headerHeight },
              thickness: 0.5,
              color: rgb(0.8, 0.8, 0.8),
            })
          }
        })

        y -= headerHeight

        page.drawLine({
          start: { x: margin, y },
          end: { x: margin + contentWidth, y },
          thickness: 1,
          color: rgb(0.8, 0.8, 0.8),
        })

        rows.forEach((row) => {
          const rowHeight = getRowHeight(row)
          ensureSpace(rowHeight)

          row.forEach((cell, colIndex) => {
            const x = margin + colIndex * colWidth
            const sanitized = removeNonWinAnsiChars(cell)
            const lines = wrapText(
              sanitized,
              colWidth - cellPadding * 2,
              font,
              cellFontSize
            )

            let cellY = y - cellPadding - cellFontSize
            lines.forEach((line) => {
              page.drawText(line, {
                x: x + cellPadding,
                y: cellY,
                size: cellFontSize,
                font,
              })
              cellY -= cellLineHeight
            })

            if (colIndex > 0) {
              page.drawLine({
                start: { x, y },
                end: { x, y: y - rowHeight },
                thickness: 0.5,
                color: rgb(0.8, 0.8, 0.8),
              })
            }
          })

          y -= rowHeight

          page.drawLine({
            start: { x: margin, y },
            end: { x: margin + contentWidth, y },
            thickness: 0.5,
            color: rgb(0.8, 0.8, 0.8),
          })
        })

        const tableTop =
          y +
          rows.reduce((acc, row) => acc + getRowHeight(row), 0) +
          headerHeight
        page.drawLine({
          start: { x: margin, y: tableTop },
          end: { x: margin, y },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        })
        page.drawLine({
          start: { x: margin + contentWidth, y: tableTop },
          end: { x: margin + contentWidth, y },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        })

        addSpacing(10)
      }

      function drawCode(text: string) {
        addSpacing(8)

        const sanitizedText = removeNonWinAnsiChars(text)
        const lines = sanitizedText.split(/\r?\n/)
        const codeFontSize = 9
        const codeLineHeight = 12

        const blockHeight = lines.length * codeLineHeight + 12
        ensureSpace(blockHeight)

        page.drawRectangle({
          x: margin,
          y: y - blockHeight + 6,
          width: contentWidth,
          height: blockHeight,
          color: rgb(0.96, 0.96, 0.96),
        })

        y -= 6
        lines.forEach((line) => {
          ensureSpace(codeLineHeight)
          if (line) {
            page.drawText(line, {
              x: margin + 8,
              y,
              size: codeFontSize,
              font: courier,
              color: rgb(0.2, 0.2, 0.2),
            })
          }
          y -= codeLineHeight
        })

        addSpacing(8)
      }

      function drawParagraph(text: string) {
        addSpacing(4)
        drawText(text)
        addSpacing(8)
      }

      // Add title
      drawHeading(taskData.name, 1)

      // Add metadata
      drawText(`Template: ${templateName}`, { size: 10 })
      drawText(`Generated: ${new Date().toLocaleString()}`, { size: 10 })
      addSpacing(12)

      // Process blocks
      blocks.forEach((block, index) => {
        switch (block.type) {
          case "heading":
            if (index > 0) addSpacing(8)
            drawHeading(block.text, block.level)
            break
          case "list":
            drawList(block.items, block.ordered)
            break
          case "table":
            drawTable(block.headers, block.rows)
            break
          case "code":
            drawCode(block.text)
            break
          case "paragraph":
          default:
            if (block.text.trim()) {
              drawParagraph(block.text)
            }
            break
        }
      })

      const bytes = await pdfDoc.save()
      const arrayBuffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer

      return new NextResponse(arrayBuffer, {
        headers: {
          "Content-Disposition": `attachment; filename="${taskData.name}.pdf"`,
          "Content-Type": "application/pdf",
        },
      })
    } else {
      // Default to markdown
      return new NextResponse(taskData.result, {
        headers: {
          "Content-Disposition": `attachment; filename="${taskData.name}.md"`,
          "Content-Type": "text/markdown",
        },
      })
    }
  } catch (error) {
    console.error("Export error:", error)
    return NextResponse.json(
      { error: "Failed to export document" },
      { status: 500 }
    )
  }
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

function removeNonWinAnsiChars(text: string): string {
  if (!text) return ""
  return text
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .replace(/[\u{1F600}-\u{1F64F}]/gu, "")
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, "")
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "")
    .replace(/[\u{200D}]/gu, "")
    .replace(/[\u{FE0F}]/gu, "")
    .replace(/[^\x00-\xFF]/g, "")
    .trim()
}

function wrapText(text: string, maxWidth: number, font: PDFFont, size: number): string[] {
  const sanitizedText = removeNonWinAnsiChars(text || "")
  if (!sanitizedText) return []

  const words = sanitizedText.split(/\s+/)
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
