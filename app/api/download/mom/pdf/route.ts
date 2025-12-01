import type { NextRequest } from "next/server"
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"

import { parseMarkdownToBlocks } from "@/lib/markdown"

export async function POST(req: NextRequest) {
  const { markdown, filename } = (await req.json()) as { markdown: string; filename?: string }
  if (!markdown) return new Response("Missing markdown content", { status: 400 })

  const blocks = parseMarkdownToBlocks(markdown)

  const pdfDoc = await PDFDocument.create()
  const pageSize: [number, number] = [612, 792] // Letter size
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

  function drawText(text: string, options: { 
    x?: number; 
    size?: number; 
    useBold?: boolean; 
    useFont?: PDFFont;
    maxWidth?: number;
  } = {}) {
    const { 
      x = margin, 
      size = fontSize, 
      useBold = false, 
      useFont,
      maxWidth = contentWidth 
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
      color: rgb(0.1, 0.1, 0.1) 
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
          font 
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
    
    // Calculate row heights
    function getRowHeight(cells: string[]): number {
      let maxLines = 1
      cells.forEach((cell) => {
        const sanitized = removeNonWinAnsiChars(cell)
        const lines = wrapText(sanitized, colWidth - cellPadding * 2, font, cellFontSize)
        maxLines = Math.max(maxLines, lines.length)
      })
      return maxLines * cellLineHeight + cellPadding * 2
    }

    // Draw header row
    const headerHeight = getRowHeight(headers)
    ensureSpace(headerHeight)
    
    // Header background
    page.drawRectangle({
      x: margin,
      y: y - headerHeight,
      width: contentWidth,
      height: headerHeight,
      color: rgb(0.92, 0.92, 0.92),
    })
    
    // Header borders
    page.drawLine({
      start: { x: margin, y },
      end: { x: margin + contentWidth, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    })
    
    // Draw header cells
    headers.forEach((header, colIndex) => {
      const x = margin + colIndex * colWidth
      const sanitized = removeNonWinAnsiChars(header)
      const lines = wrapText(sanitized, colWidth - cellPadding * 2, bold, cellFontSize)
      
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
      
      // Vertical line
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
    
    // Draw header bottom border
    page.drawLine({
      start: { x: margin, y },
      end: { x: margin + contentWidth, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    })

    // Draw data rows
    rows.forEach((row) => {
      const rowHeight = getRowHeight(row)
      ensureSpace(rowHeight)
      
      row.forEach((cell, colIndex) => {
        const x = margin + colIndex * colWidth
        const sanitized = removeNonWinAnsiChars(cell)
        const lines = wrapText(sanitized, colWidth - cellPadding * 2, font, cellFontSize)
        
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
        
        // Vertical line
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
      
      // Row bottom border
      page.drawLine({
        start: { x: margin, y },
        end: { x: margin + contentWidth, y },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      })
    })
    
    // Left and right borders
    const tableTop = y + rows.reduce((acc, row) => acc + getRowHeight(row), 0) + headerHeight
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
    
    // Draw background for code block
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
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const outputFilename = filename || "minutes-of-meeting.pdf"
  
  return new Response(arrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${outputFilename}"`,
    },
  })
}

function removeNonWinAnsiChars(text: string): string {
  if (!text) return ""
  return text
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, "") // Emojis
    .replace(/[\u{2600}-\u{26FF}]/gu, "")   // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, "")   // Dingbats
    .replace(/[\u{1F600}-\u{1F64F}]/gu, "") // Emoticons
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, "") // Transport symbols
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "") // Flags
    .replace(/[\u{200D}]/gu, "")            // Zero width joiner
    .replace(/[\u{FE0F}]/gu, "")            // Variation selector
    .replace(/[^\x00-\xFF]/g, "")           // Remove any remaining non-WinAnsi chars
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

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
}
