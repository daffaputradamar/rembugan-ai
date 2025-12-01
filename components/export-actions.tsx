"use client"

import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Copy, Download, FileText, LoaderCircle } from "lucide-react"

interface ExportActionsProps {
  markdown: string
  downloading: "docx" | "pdf" | null
  onDownload: (type: "docx" | "pdf") => void
  disabled?: boolean
  copyLabel?: string
  copyToastMessage?: string
}

export function ExportActions({
  markdown,
  downloading,
  onDownload,
  disabled = false,
  copyLabel = "Salin Markdown",
  copyToastMessage = "Markdown disalin ke clipboard",
}: ExportActionsProps) {
  const hasContent = markdown.trim().length > 0
  const isDisabled = disabled || !hasContent

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        className="gap-2"
        onClick={() => {
          navigator.clipboard.writeText(markdown)
          toast.success(copyToastMessage)
        }}
        disabled={isDisabled}
      >
        <Copy className="h-4 w-4" />
        {copyLabel}
      </Button>
      <Button
        variant="outline"
        className="gap-2"
        onClick={() => onDownload("docx")}
        disabled={isDisabled || !!downloading}
      >
        {downloading === "docx" ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        Unduh DOCX
      </Button>
      <Button
        variant="outline"
        className="gap-2"
        onClick={() => onDownload("pdf")}
        disabled={isDisabled || !!downloading}
      >
        {downloading === "pdf" ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Unduh PDF
      </Button>
    </div>
  )
}
