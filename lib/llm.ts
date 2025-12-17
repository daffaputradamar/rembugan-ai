import { ChatOllama } from "@langchain/ollama"
import { HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages"
import { PromptTemplate } from "@langchain/core/prompts"
import type { z } from "zod"

// Create LLM instance with Ollama
export function createLLM(options?: {
  temperature?: number
  model?: string
  numCtx?: number
}) {
  return new ChatOllama({
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model: options?.model || process.env.OLLAMA_MODEL || "llama3.2",
    temperature: options?.temperature ?? 0.7,
    numCtx: options?.numCtx ?? 98304, // Context window size
  })
}

// Truncate text to fit within context limits
export function truncateText(text: string, maxChars: number = 12000): string {
  if (text.length <= maxChars) return text
  
  // Try to truncate at a natural break point
  const truncated = text.substring(0, maxChars)
  const lastPeriod = truncated.lastIndexOf('.')
  const lastNewline = truncated.lastIndexOf('\n')
  const breakPoint = Math.max(lastPeriod, lastNewline)
  
  if (breakPoint > maxChars * 0.8) {
    return truncated.substring(0, breakPoint + 1) + "\n\n[... transkrip dipotong karena terlalu panjang ...]"
  }
  
  return truncated + "\n\n[... transkrip dipotong karena terlalu panjang ...]"
}

// Extract key speakers from transcript
export function extractSpeakers(text: string): string[] {
  const speakerRegex = /^([A-Za-z\s]+(?:[A-Za-z]+))\s+\d+:\d+/gm
  const speakers = new Set<string>()
  let match
  
  while ((match = speakerRegex.exec(text)) !== null) {
    const speaker = match[1].trim()
    if (speaker.length > 2 && speaker.length < 50) {
      speakers.add(speaker)
    }
  }
  
  return Array.from(speakers)
}

// Generate text response
export async function generateText(
  prompt: string,
  options?: {
    systemPrompt?: string
    temperature?: number
    model?: string
    maxInputChars?: number
  }
): Promise<string> {
  const llm = createLLM({
    temperature: options?.temperature,
    model: options?.model,
  })
  
  const messages: BaseMessage[] = []
  
  if (options?.systemPrompt) {
    messages.push(new SystemMessage(options.systemPrompt))
  }
  
  // Truncate input if too long
  const maxChars = options?.maxInputChars ?? 15000
  const truncatedPrompt = prompt.length > maxChars 
    ? truncateText(prompt, maxChars)
    : prompt
  
  messages.push(new HumanMessage(truncatedPrompt))
  
  const response = await llm.invoke(messages)
  return typeof response.content === "string" 
    ? response.content 
    : JSON.stringify(response.content)
}

// Generate structured JSON output using LangChain's structured output
export async function generateObject<T extends Record<string, unknown>>(
  prompt: string,
  options?: {
    systemPrompt?: string
    temperature?: number
    model?: string
    maxInputChars?: number
    retries?: number
    schema?: z.ZodType<T>
    timeout?: number
  }
): Promise<T> {
  const maxRetries = options?.retries ?? 2
  const timeoutMs = options?.timeout ?? 120000 // 2 minute default timeout
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const llm = createLLM({
        temperature: options?.temperature ?? 0.2,
        model: options?.model
      })
      
      // Truncate input if too long
      const maxChars = options?.maxInputChars ?? 12000
      const truncatedPrompt = prompt.length > maxChars 
        ? truncateText(prompt, maxChars)
        : prompt
      
      // Create abort controller for timeout
      const abortController = new AbortController()
      const timeoutId = setTimeout(() => abortController.abort(), timeoutMs)
      
      try {
        // Use structured output if schema provided (recommended)
        if (options?.schema) {
          try {
            const structuredLlm = llm.withStructuredOutput(options.schema, {
              name: "response",
              includeRaw: false,
            })
            
            const messages: BaseMessage[] = []
            if (options?.systemPrompt) {
              messages.push(new SystemMessage(options.systemPrompt))
            }
            messages.push(new HumanMessage(truncatedPrompt))
            
            const result = await Promise.race([
              structuredLlm.invoke(messages),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Request timeout")), timeoutMs)
              )
            ])
            
            clearTimeout(timeoutId)
            return result as T
          } catch (structuredError) {
            // Fallback to manual parsing if structured output fails
            console.warn("Structured output failed, falling back to manual parsing:", structuredError)
            clearTimeout(timeoutId)
          }
        }
        
        // Fallback: manual JSON parsing
        const messages: BaseMessage[] = []
        const systemPromptWithJson = `${options?.systemPrompt || ""}

CRITICAL: Respond with valid JSON only. No markdown, no code blocks, no extra text.`
        
        messages.push(new SystemMessage(systemPromptWithJson))
        messages.push(new HumanMessage(truncatedPrompt))
        
        const response = await Promise.race([
          llm.invoke(messages),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Request timeout")), timeoutMs)
          )
        ]) as Awaited<ReturnType<typeof llm.invoke>>
        
        clearTimeout(timeoutId)
        
        const content = typeof response.content === "string" 
          ? response.content 
          : JSON.stringify(response.content)
        
        return parseJsonResponse<T>(content)
      } catch (err) {
        clearTimeout(timeoutId)
        throw err
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`Attempt ${attempt + 1}/${maxRetries + 1} failed:`, lastError.message)
      
      if (attempt < maxRetries) {
        const backoffMs = 1000 * (attempt + 1) // Exponential backoff
        console.log(`Retrying in ${backoffMs}ms...`)
        await new Promise(resolve => setTimeout(resolve, backoffMs))
      }
    }
  }
  
  throw lastError || new Error("Failed to generate structured output after all retries")
}

// Improved JSON parsing with multiple strategies
function parseJsonResponse<T>(content: string): T {
  // Strategy 1: Direct parse after cleaning
  const cleanedContent = content
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .replace(/^\s*[\r\n]+/, "")
    .replace(/[\r\n]+\s*$/, "")
    .trim()
  
  try {
    return JSON.parse(cleanedContent) as T
  } catch {
    // Continue to next strategy
  }
  
  // Strategy 2: Find JSON object in content
  const jsonObjectMatch = cleanedContent.match(/\{[\s\S]*\}/)
  if (jsonObjectMatch) {
    try {
      return JSON.parse(jsonObjectMatch[0]) as T
    } catch {
      // Continue
    }
  }
  
  // Strategy 3: Find JSON array in content
  const jsonArrayMatch = cleanedContent.match(/\[[\s\S]*\]/)
  if (jsonArrayMatch) {
    try {
      return JSON.parse(jsonArrayMatch[0]) as T
    } catch {
      // Continue
    }
  }
  
  // Strategy 4: Try to fix common JSON issues
  const fixedContent = cleanedContent
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
  
  const fixedMatch = fixedContent.match(/\{[\s\S]*\}/)
  if (fixedMatch) {
    try {
      return JSON.parse(fixedMatch[0]) as T
    } catch {
      // Final attempt failed
    }
  }
  
  const preview = cleanedContent.substring(0, 500)
  throw new Error(`Failed to parse JSON. Response preview: ${preview}`)
}

// Simple text generation with template
export async function generateWithTemplate(
  template: string,
  variables: Record<string, string>,
  options?: {
    systemPrompt?: string
    temperature?: number
    model?: string
  }
): Promise<string> {
  let prompt = template
  for (const [key, value] of Object.entries(variables)) {
    prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
  }
  
  return generateText(prompt, options)
}

// For backward compatibility
export async function generateWithTemplateOld(
  template: string,
  variables: Record<string, string>,
  options?: {
    systemPrompt?: string
    temperature?: number
    model?: string
  }
): Promise<string> {
  const llm = createLLM({
    temperature: options?.temperature,
    model: options?.model,
  })
  
  const promptTemplate = PromptTemplate.fromTemplate(template)
  const formattedPrompt = await promptTemplate.format(variables)
  
  const messages: BaseMessage[] = []
  
  if (options?.systemPrompt) {
    messages.push(new SystemMessage(options.systemPrompt))
  }
  
  messages.push(new HumanMessage(formattedPrompt))
  
  const response = await llm.invoke(messages)
  return typeof response.content === "string" 
    ? response.content 
    : JSON.stringify(response.content)
}
