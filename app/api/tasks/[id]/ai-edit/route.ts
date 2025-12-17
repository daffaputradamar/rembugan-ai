import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { createLLM } from "@/lib/llm"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { currentContent, prompt } = await req.json()

    if (!currentContent || !prompt) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Use shared LLM instance (Ollama) configuration
    const model = createLLM({
      model: process.env.OLLAMA_MODEL || "llama3.2",
      temperature: 0.7,
    })

    // Create AI prompt
    const systemPrompt = `You are a helpful assistant that modifies documents based on user instructions. 
You will receive a markdown document and instructions on how to modify it.
Return the COMPLETE modified markdown document with all changes applied. Include all original content that was not modified.
Do not omit any sections. Do not summarize. Return only the full updated markdown, without any explanations or additional text.
Preserve the markdown formatting and structure unless specifically asked to change it.`

    const userPrompt = `Current document:

${currentContent}

User instructions: ${prompt}

Please modify the document according to the instructions above and return the ENTIRE updated markdown document with all changes integrated. Do not leave out any content.`

    // Get AI response
    const response = await model.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ])

    const result = response.content.toString().trim()

    return NextResponse.json({ result })
  } catch (error) {
    console.error("Error in AI edit:", error)
    return NextResponse.json(
      { error: "Failed to process AI edit" },
      { status: 500 }
    )
  }
}
