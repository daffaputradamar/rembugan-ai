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
    const response = await fetch(`${PORTAL_URL}/api/departments`, {
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": process.env.INTERNAL_API_TOKEN || "",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`Portal API error: ${response.status}`)
    }

    const departments = await response.json()
    
    // Return list with divisionId for filtering
    return NextResponse.json(departments.map((d: { id: number; name: string; divisionId: number }) => ({
      id: d.id,
      name: d.name,
      divisionId: d.divisionId,
    })))
  } catch (error) {
    console.error("Error fetching departments from portal:", error)
    return NextResponse.json({ error: "Failed to fetch departments" }, { status: 500 })
  }
}
