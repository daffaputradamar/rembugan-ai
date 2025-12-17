"use client"

import { useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import {
  FileText,
  Loader2,
  Trash2,
  UploadCloud,
  Eye,
  EyeOff,
  Check,
  FileUp,
} from "lucide-react"
import type { CustomTemplate } from "@/types/mom"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface TemplateUploadProps {
  template: CustomTemplate | null
  onTemplateChange: (template: CustomTemplate | null) => void
  disabled?: boolean
}

export function TemplateUpload({
  template,
  onTemplateChange,
  disabled = false,
}: TemplateUploadProps) {
  const { data: session } = useSession()
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(file: File) {
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("convertToTemplate", "true")

      const res = await fetch("/api/upload/template", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Upload failed")
      }

      const data = await res.json()

      const newTemplate: CustomTemplate = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.(pdf|docx?|txt)$/i, ""),
        fileName: file.name,
        markdown: data.markdown,
        rawText: data.text,
        type: "custom",
        visibility: "custom",
        userId: session?.user?.id || "anonymous",
        isActive: true,
        createdAt: new Date().toISOString(),
      }

      onTemplateChange(newTemplate)
      toast.success("Template berhasil diunggah", {
        description: `${file.name} telah dikonversi menjadi template markdown.`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengunggah template"
      toast.error("Gagal mengunggah template", { description: message })
    } finally {
      setUploading(false)
    }
  }

  const handleBrowseClick = () => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      handleBrowseClick()
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled && !uploading) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (disabled || uploading) return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (/\.(pdf|docx?|txt)$/i.test(file.name)) {
        handleUpload(file)
      } else {
        toast.error("Format tidak didukung", {
          description: "Hanya .pdf, .docx, atau .txt yang dapat diunggah.",
        })
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleUpload(files[0])
    }
  }

  const handleRemoveTemplate = () => {
    onTemplateChange(null)
    toast.info("Template dihapus", {
      description: "AI akan menggunakan template default.",
    })
  }

  return (
    <Collapsible open={showPreview} onOpenChange={setShowPreview}>
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Template Kustom
              </CardTitle>
              <CardDescription className="text-sm">
                Unggah template Anda sendiri (PDF, DOCX, TXT) untuk format hasil MoM.
              </CardDescription>
            </div>
            {template && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  {showPreview ? (
                    <>
                      <EyeOff className="h-4 w-4" />
                      Sembunyikan
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      Lihat Template
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!template ? (
            <div
              role="button"
              tabIndex={disabled || uploading ? -1 : 0}
              onClick={handleBrowseClick}
              onKeyDown={handleKeyDown}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              aria-disabled={disabled || uploading}
              aria-label="Unggah template dengan drag and drop atau klik"
              className={`group flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-all ${
                disabled || uploading
                  ? "cursor-not-allowed border-border bg-muted/60 text-muted-foreground"
                  : isDragging
                    ? "border-primary bg-primary/10 text-foreground"
                    : "cursor-pointer border-border bg-muted/20 text-muted-foreground hover:border-primary/50 hover:bg-primary/5"
              }`}
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                <FileUp className={`h-6 w-6 transition ${isDragging ? "text-primary" : "text-primary/70"}`} />
              )}
              <p className="mt-2 text-sm font-medium text-foreground">
                {uploading ? "Memproses template..." : "Unggah template Anda"}
              </p>
              <p className="text-xs text-muted-foreground">
                {uploading ? "Mengkonversi dokumen ke markdown..." : "PDF, DOCX, atau TXT"}
              </p>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                disabled={disabled || uploading}
                onChange={handleFileChange}
                className="sr-only"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{template.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {template.fileName} • {new Date(template.createdAt).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <Check className="h-3 w-3" />
                    Aktif
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRemoveTemplate}
                    disabled={disabled}
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <CollapsibleContent className="space-y-2">
                <Label className="text-sm font-medium">Preview Template (Markdown)</Label>
                <div className="relative">
                  <Textarea
                    readOnly
                    value={template.markdown}
                    className="min-h-[200px] max-h-[400px] overflow-y-auto font-mono text-xs"
                  />
                  <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute bottom-2 right-2"
                      >
                        Lihat Penuh
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh]">
                      <DialogHeader>
                        <DialogTitle>Template: {template.name}</DialogTitle>
                        <DialogDescription>
                          Preview lengkap template markdown yang akan digunakan AI.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="overflow-y-auto max-h-[70vh]">
                        <Textarea
                          readOnly
                          value={template.markdown}
                          className="min-h-[500px] font-mono text-sm"
                        />
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CollapsibleContent>

              <Button
                variant="outline"
                size="sm"
                onClick={handleBrowseClick}
                disabled={disabled || uploading}
                className="w-full gap-2"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UploadCloud className="h-4 w-4" />
                )}
                {uploading ? "Memproses..." : "Ganti Template"}
              </Button>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                disabled={disabled || uploading}
                onChange={handleFileChange}
                className="sr-only"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </Collapsible>
  )
}
