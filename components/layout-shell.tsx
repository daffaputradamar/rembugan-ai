"use client"

import { UserBar } from "@/components/app-header"
import { cn } from "@/lib/utils"

interface LayoutShellProps {
  children: React.ReactNode
  className?: string
  /** Page title shown in header area */
  title?: string
  /** Page description */
  description?: string
  /** Action buttons to show in header */
  actions?: React.ReactNode
}

export function LayoutShell({ children, className, title, description, actions }: LayoutShellProps) {
  return (
    <div className="min-h-screen">
      <div className="container max-w-7xl mx-auto px-4 py-6">
        <UserBar />
        
        {/* Page header with title and actions */}
        {(title || actions) && (
          <div className="flex items-start justify-between gap-4 mt-6 mb-6">
            <div>
              {title && (
                <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              )}
              {description && (
                <p className="text-muted-foreground mt-1">{description}</p>
              )}
            </div>
            {actions && (
              <div className="flex items-center gap-2 shrink-0">
                {actions}
              </div>
            )}
          </div>
        )}
        
        <main className={cn("mt-6", className)}>
          {children}
        </main>
      </div>
    </div>
  )
}
