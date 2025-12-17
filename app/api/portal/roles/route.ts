import { NextResponse } from "next/server"
import { auth } from "@/auth"

const PORTAL_URL = process.env.PORTAL_API_URL || "http://localhost:3000"

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch from portal
    const response = await fetch(`${PORTAL_URL}/api/roles`, {
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": process.env.INTERNAL_API_TOKEN || "",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`Portal API error: ${response.status}`)
    }

    const roles = await response.json()
    
    // Return simplified list
    return NextResponse.json(roles.map((r: { id: number; name: string; isSystem?: boolean }) => ({
      id: r.id,
      name: r.name,
      isSystem: r.isSystem,
    })))
  } catch (error) {
    console.error("Error fetching roles from portal:", error)
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 })
  }
}
