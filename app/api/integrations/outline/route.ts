import type { NextRequest } from "next/server"

const OUTLINE_BASE_URL = process.env.NEXT_PUBLIC_OUTLINE_BASE_URL ?? "https://app.getoutline.com"
const OUTLINE_API_TOKEN = process.env.OUTLINE_API_TOKEN

if (!OUTLINE_API_TOKEN) {
  console.warn("Outline API token is not configured. Set OUTLINE_API_TOKEN in environment variables to enable Outline integration.")
}

type OutlineCollection = {
  id: string
  name: string
  url: string
}

type OutlineDocument = {
  id: string
  title: string
  url: string
}

type OutlineResponse<T> = {
  data: T
  error?: { message?: string }
}

async function outlineRequest<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  if (!OUTLINE_API_TOKEN) {
    throw new Error("Outline API token is not configured")
  }

  const response = await fetch(`${OUTLINE_BASE_URL}/api/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OUTLINE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })

  let payload: OutlineResponse<T> | undefined
  try {
    payload = (await response.json()) as OutlineResponse<T>
  } catch (error) {
    if (!response.ok) {
      throw new Error(response.statusText)
    }
    throw error
  }

  if (!response.ok || payload?.error) {
    const message = payload?.error?.message ?? response.statusText
    throw new Error(message)
  }

  return payload.data
}

export async function POST(req: NextRequest) {
  try {
    const { projectName, markdown, summary } = (await req.json()) as {
      projectName?: string
      markdown?: string
      summary?: string
    }

    if (!OUTLINE_API_TOKEN) {
      return new Response("Outline integration is not configured.", { status: 500 })
    }

    const trimmedName = projectName?.trim()
    if (!trimmedName) {
      return new Response("Project name is required.", { status: 400 })
    }

    if (!markdown || !markdown.trim()) {
      return new Response("No document content provided.", { status: 400 })
    }

    let collection: OutlineCollection | undefined
    try {
      const collections = await outlineRequest<OutlineCollection[]>("collections.list", { limit: 100 })
      collection = collections.find((c) => c.name.toLowerCase() === trimmedName.toLowerCase())
    } catch {
      // Ignore listing errors; we'll attempt to create the collection below
    }

    if (!collection) {
      collection = await outlineRequest<OutlineCollection>("collections.create", {
        name: trimmedName,
        description: summary ? `Imported from RembuganAI. Summary: ${summary.slice(0, 180)}${summary.length > 180 ? "…" : ""}` : "Imported from RembuganAI",
      })
    }

    const documentTitle = `${trimmedName} – Product Specification`

    let existingDocument: OutlineDocument | undefined
    try {
      const documents = await outlineRequest<OutlineDocument[]>("documents.list", {
        collectionId: collection.id,
        limit: 100,
        query: trimmedName,
      })
      existingDocument = documents.find((doc) => doc.title.toLowerCase() === documentTitle.toLowerCase())
    } catch {
      // Ignore list errors and fall back to creating the document below
    }

    const document = existingDocument
      ? await outlineRequest<OutlineDocument>("documents.update", {
          id: existingDocument.id,
          title: documentTitle,
          text: markdown,
          publish: true,
        })
      : await outlineRequest<OutlineDocument>("documents.create", {
          title: documentTitle,
          text: markdown,
          collectionId: collection.id,
          publish: true,
        })

    return Response.json({
      collection: {
        id: collection.id,
        name: collection.name,
        url: collection.url,
      },
      document: {
        id: document.id,
        title: document.title,
        url: document.url,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Outline integration failed"
    return new Response(message, { status: 500 })
  }
}
