import { auth } from "@/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  const session = await auth()
  const { pathname } = request.nextUrl

  // Check if it's an API route
  const isApiRoute = pathname.startsWith("/api/")
  
  // Public routes that don't require authentication
  const publicRoutes = ["/login", "/unauthorized", "/pending"]
  
  // Check if the current path is public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  
  // Allow public routes
  if (isPublicRoute) {
    // If user is authenticated and tries to access login, redirect to home
    if (pathname.startsWith("/login") && session?.user) {
      return NextResponse.redirect(new URL("/", request.url))
    }
    return NextResponse.next()
  }

  // Handle unauthenticated users
  if (!session?.user) {
    if (isApiRoute) {
      // Return JSON error for API routes
      return NextResponse.json(
        { error: "Unauthorized - Please log in" },
        { status: 401 }
      )
    }
    // Redirect to login for page routes
    const url = new URL("/login", request.url)
    url.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(url)
  }

  // Check user status - only approved users can access protected routes
  if (session.user.status !== "APPROVED") {
    if (isApiRoute) {
      // Return JSON error for API routes
      return NextResponse.json(
        { error: "Account pending approval or rejected" },
        { status: 403 }
      )
    }
    // Redirect to pending page for page routes
    if (!pathname.startsWith("/pending")) {
      return NextResponse.redirect(new URL("/pending", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*|public).*)",
  ],
}
