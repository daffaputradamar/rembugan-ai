export type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; text: string }

const INLINE_TOKENS = /[*_`~]/g
const HEADING_PATTERN = /^(#{1,6})\s+/
const BULLET_PATTERN = /^[-*+]\s+/
const ORDERED_PATTERN = /^\d+\.\s+/
const CODE_FENCE = /^```/

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
  let codeBuffer: string[] | null = null
  let inCodeBlock = false

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
    blocks.push({ type: "list", items: listBuffer.map((item) => stripInlineMarkdown(item)) })
    listBuffer = null
  }

  const flushCode = () => {
    if (!codeBuffer || codeBuffer.length === 0) return
    blocks.push({ type: "code", text: codeBuffer.join("\n") })
    codeBuffer = null
  }

  for (const raw of lines) {
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
    
    if (!line) {
      flushParagraph()
      flushList()
      continue
    }

    const headingMatch = line.match(HEADING_PATTERN)
    if (headingMatch) {
      flushParagraph()
      flushList()
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
      const cleaned = line.replace(isBullet ? BULLET_PATTERN : ORDERED_PATTERN, "")
      if (!listBuffer) listBuffer = []
      listBuffer.push(cleaned)
      continue
    }

    flushList()
    paragraphBuffer.push(line)
  }

  flushParagraph()
  flushList()
  flushCode()

  return blocks
}
