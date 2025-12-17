"use client"

import Image from "next/image"
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Building2, GitBranch, LogOut, ShieldCheck, Home } from "lucide-react"
import { ThemeToggler } from "./theme-toggler"

// Simplified user bar for all pages
export function UserBar() {
  const { data: session } = useSession()

  if (!session?.user) return null

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-linear-to-r from-background/50 via-background/30 to-background/50 backdrop-blur-md">
      <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/40 bg-primary/5">
          <Image
            src="/rembuganai-logo.svg"
            alt="RembuganAI"
            width={24}
            height={24}
          />
        </div>
        <span className="font-semibold text-foreground">RembuganAI</span>
      </Link>
      
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2 justify-end">
            <span className="text-foreground font-semibold text-sm truncate">
              {session.user?.name || "User"}
            </span>
            {(session.user as any)?.isAdmin && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-medium">
                <ShieldCheck className="size-3" />
                Admin
              </span>
            )}
          </div>
          <span className="text-muted-foreground text-xs leading-none truncate">
            {session.user?.email}
          </span>
          {((session.user as any)?.divisionNames?.length > 0 || (session.user as any)?.departmentNames?.length > 0) && (
            <div className="flex flex-wrap gap-2 justify-end pt-1">
              {(session.user as any)?.divisionNames && (session.user as any).divisionNames.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-medium">
                  <Building2 className="size-3" />
                  <span className="truncate max-w-32">{(session.user as any).divisionNames.join(", ")}</span>
                </span>
              )}
              {(session.user as any)?.departmentNames && (session.user as any).departmentNames.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-medium">
                  <GitBranch className="size-3" />
                  <span className="truncate max-w-32">{(session.user as any).departmentNames.join(", ")}</span>
                </span>
              )}
            </div>
          )}
        </div>
        <div className="w-px h-10 bg-border" />
        <ThemeToggler />
        <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut className="mr-2 h-4 w-4" />
          Keluar
        </Button>
      </div>
    </div>
  )
}

// Full branding hero for home page only
export function BrandingHero() {
  return (
    <div className="grid gap-6 lg:grid-cols-[auto,1fr] lg:items-center mt-8">
      <div className="flex justify-center lg:justify-start">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/40 bg-primary/5 shadow-lg shadow-primary/10">
          <Image
            src="/rembuganai-logo.svg"
            alt="RembuganAI logo"
            width={56}
            height={56}
            priority
          />
        </div>
      </div>
      <div className="space-y-4 text-center lg:text-left">
        <div className="inline-flex items-center justify-center gap-2 rounded-full bg-primary/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-primary lg:justify-start">
          RembuganAI
        </div>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Saka obrolan dadi tindakan.
        </h1>
        <p className="text-muted-foreground">
          Ringkas rapat produk, tangkap keputusan penting, dan dapatkan draft spesifikasi siap kirim dalam hitungan menit.
        </p>
      </div>
    </div>
  )
}

// Legacy AppHeader - now just combines UserBar (for backward compatibility)
export function AppHeader() {
  return (
    <header>
      <UserBar />
    </header>
  )
}
