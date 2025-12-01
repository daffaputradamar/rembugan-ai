export type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "code"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] }

const INLINE_TOKENS = /[*_`~]/g
const HEADING_PATTERN = /^(#{1,6})\s+/
const BULLET_PATTERN = /^[-*+]\s+/
const ORDERED_PATTERN = /^\d+\.\s+/
const CODE_FENCE = /^```/
const TABLE_ROW_PATTERN = /^\|(.+)\|$/
const TABLE_SEPARATOR_PATTERN = /^\|[-:\s|]+\|$/

export function stripInlineMarkdown(input: string) {
  if (!input) return ""
  return input
    .replace(/!\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/`{1,3}(.*?)`{1,3}/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(INLINE_TOKENS, "")
    .trim()
}

export function parseMarkdownToBlocks(markdown: string): MarkdownBlock[] {
  if (!markdown) return []
  const lines = markdown.split(/\r?\n/)
  const blocks: MarkdownBlock[] = []
  let paragraphBuffer: string[] = []
  let listBuffer: string[] | null = null
  let listOrdered = false
  let codeBuffer: string[] | null = null
  let inCodeBlock = false
  let tableHeaders: string[] | null = null
  let tableRows: string[][] = []
  let inTable = false

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return
    const text = stripInlineMarkdown(paragraphBuffer.join(" "))
    if (text) {
      blocks.push({ type: "paragraph", text })
    }
    paragraphBuffer = []
  }

  const flushList = () => {
    if (!listBuffer || listBuffer.length === 0) return
    blocks.push({ type: "list", items: listBuffer.map((item) => stripInlineMarkdown(item)), ordered: listOrdered })
    listBuffer = null
    listOrdered = false
  }

  const flushCode = () => {
    if (!codeBuffer || codeBuffer.length === 0) return
    blocks.push({ type: "code", text: codeBuffer.join("\n") })
    codeBuffer = null
  }

  const flushTable = () => {
    if (!tableHeaders || tableHeaders.length === 0) return
    blocks.push({ type: "table", headers: tableHeaders, rows: tableRows })
    tableHeaders = null
    tableRows = []
    inTable = false
  }

  const parseTableRow = (line: string): string[] => {
    return line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => stripInlineMarkdown(cell.trim()))
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()
    
    // Check for code fence
    if (CODE_FENCE.test(line)) {
      if (inCodeBlock) {
        // Closing fence
        flushCode()
        inCodeBlock = false
      } else {
        // Opening fence
        flushParagraph()
        flushList()
        flushTable()
        inCodeBlock = true
        codeBuffer = []
      }
      continue
    }

    // If inside code block, just accumulate lines
    if (inCodeBlock) {
      if (!codeBuffer) codeBuffer = []
      codeBuffer.push(raw) // Use raw to preserve formatting
      continue
    }

    // Check for table row
    if (TABLE_ROW_PATTERN.test(line)) {
      // Check if next line is a separator (this is the header row)
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : ""
      
      if (!inTable && TABLE_SEPARATOR_PATTERN.test(nextLine)) {
        // This is a header row
        flushParagraph()
        flushList()
        tableHeaders = parseTableRow(line)
        inTable = true
        i++ // Skip the separator line
        continue
      } else if (inTable && tableHeaders) {
        // This is a data row
        tableRows.push(parseTableRow(line))
        continue
      }
    } else if (inTable) {
      // End of table
      flushTable()
    }
    
    if (!line) {
      flushParagraph()
      flushList()
      if (inTable) flushTable()
      continue
    }

    const headingMatch = line.match(HEADING_PATTERN)
    if (headingMatch) {
      flushParagraph()
      flushList()
      flushTable()
      const text = stripInlineMarkdown(line.replace(HEADING_PATTERN, ""))
      const level = headingMatch[1].length
      if (text) {
        blocks.push({ type: "heading", level, text })
      }
      continue
    }

    const isBullet = BULLET_PATTERN.test(line)
    const isOrdered = ORDERED_PATTERN.test(line)
    if (isBullet || isOrdered) {
      flushTable()
      const cleaned = line.replace(isBullet ? BULLET_PATTERN : ORDERED_PATTERN, "")
      if (!listBuffer) {
        listBuffer = []
        listOrdered = isOrdered
      }
      listBuffer.push(cleaned)
      continue
    }

    flushList()
    flushTable()
    paragraphBuffer.push(line)
  }

  flushParagraph()
  flushList()
  flushCode()
  flushTable()

  return blocks
}
