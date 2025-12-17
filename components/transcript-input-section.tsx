"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { ArrowRight, LoaderCircle, Sparkles, UploadCloud } from "lucide-react"
import { TemplateManager } from "@/components/template-manager"
import type { CustomTemplate } from "@/types/mom"

interface TranscriptInputSectionProps {
  transcript: string
  setTranscript: (value: string) => void
  loading: "summarize" | "spec" | null
  uploading: boolean
  setUploading: (value: boolean) => void
  summaryStepAvailable: boolean
  onSummarize: () => void
  onReset: () => void
  onGoToSummary: () => void
  customTemplate: CustomTemplate | null
  onTemplateChange: (template: CustomTemplate | null) => void
  // Session info for template visibility
  userDivisionIds?: number[]
  userDepartmentIds?: number[]
  userDivisionNames?: string[]
  userDepartmentNames?: string[]
  isAuthenticated?: boolean
}

export function TranscriptInputSection({
  transcript,
  setTranscript,
  loading,
  uploading,
  setUploading,
  summaryStepAvailable,
  onSummarize,
  onReset,
  onGoToSummary,
  customTemplate,
  onTemplateChange,
  userDivisionIds = [],
  userDepartmentIds = [],
  userDivisionNames = [],
  userDepartmentNames = [],
  isAuthenticated = false,
}: TranscriptInputSectionProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function onUploadFile(file: File) {
    if (!file) return
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: form })
      if (!res.ok) throw new Error("Upload failed")
      const data = await res.json()
      setTranscript(transcript ? transcript + "\n\n" + data.text : data.text)
      toast.success("File loaded", { description: `Extracted text from ${file.name}` })
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Only .txt and .docx are supported."
      toast.error("Could not read file", { description })
    }
  }

  async function processFiles(files: FileList | File[]) {
    if (uploading) {
      toast.info("Sedang memproses", { description: "Tunggu hingga unggahan saat ini selesai." })
      return
    }

    const fileArray = Array.isArray(files) ? files : Array.from(files)
    if (!fileArray.length) return

    const accepted = fileArray.filter((file) => /\.(txt|docx)$/i.test(file.name))
    if (!accepted.length) {
      toast.error("Format tidak didukung", { description: "Hanya berkas .txt atau .docx yang dapat diunggah." })
      return
    }

    if (accepted.length < fileArray.length) {
      toast.warning("Beberapa berkas dilewati", { description: "Hanya .txt atau .docx yang diproses." })
    }

    setUploading(true)
    try {
      for (const file of accepted) {
        await onUploadFile(file)
      }
    } finally {
      setUploading(false)
    }
  }

  const handleBrowseClick = () => fileInputRef.current?.click()

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      handleBrowseClick()
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
    if (event.dataTransfer.files) {
      processFiles(event.dataTransfer.files)
    }
  }

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      processFiles(event.target.files)
    }
  }

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex items-center justify-end">
        <Button
          className="gap-2"
          variant="ghost"
          onClick={onGoToSummary}
          disabled={!summaryStepAvailable}
        >
          <ArrowRight className="h-4 w-4" />
          Lihat Minutes of Meeting
        </Button>
      </div>
      <Card className="overflow-hidden">
        <CardHeader className="space-y-2">
          <CardTitle>Unggah Rembugan</CardTitle>
          <p className="text-sm text-muted-foreground">
            Unggah atau tempelkan transkrip rapat, lalu biarkan RembuganAI mengolahnya menjadi Minutes of Meeting siap pakai.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file" className="text-sm font-medium">
              Upload (.txt atau .docx)
            </Label>
            <div
              role="button"
              tabIndex={0}
              onClick={handleBrowseClick}
              onKeyDown={handleKeyDown}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              aria-disabled={uploading}
              aria-label="Unggah berkas dengan drag and drop atau klik untuk memilih"
              className={`group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                uploading
                  ? "cursor-not-allowed border-border bg-muted/60 text-muted-foreground"
                  : isDragging
                    ? "border-primary bg-primary/10 text-foreground"
                    : "cursor-pointer border-border bg-muted/40 text-muted-foreground hover:border-primary/50 hover:bg-primary/5"
              }`}
            >
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-2">
                    <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
                    <p className="text-sm font-medium text-foreground">Sedang memproses…</p>
                  </div>
                </div>
              )}
              <UploadCloud className={`h-8 w-8 transition ${isDragging ? "text-primary" : "text-primary/70"}`} />
              <p className="mt-3 text-sm font-medium text-foreground">Seret & lepas transkrip Anda</p>
              <p className="text-xs text-muted-foreground">
                {uploading ? "Sedang memproses berkas…" : "Atau klik untuk memilih .txt atau .docx"}
              </p>
              <Button type="button" variant="outline" size="sm" className="pointer-events-none mt-4">
                Telusuri berkas
              </Button>
            </div>
            <Input
              id="file"
              ref={fileInputRef}
              type="file"
              accept=".txt,.docx"
              disabled={uploading}
              onChange={handleFileInputChange}
              className="sr-only"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="transcript">Meeting Transcript</Label>
            <Textarea
              id="transcript"
              placeholder="Tempelkan transkrip rapat Anda di sini..."
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="min-h-[260px] max-h-[500px] overflow-y-auto font-mono"
            />
          </div>
          
          {/* Template Manager */}
          <TemplateManager
            selectedTemplate={customTemplate}
            onTemplateSelect={onTemplateChange}
            disabled={loading !== null || uploading}
            userDivisionIds={userDivisionIds}
            userDepartmentIds={userDepartmentIds}
            userDivisionNames={userDivisionNames}
            userDepartmentNames={userDepartmentNames}
            isAuthenticated={isAuthenticated}
          />
          
          <div className="grid gap-2 sm:grid-cols-2">
            <Button className="gap-2" onClick={onSummarize} disabled={loading !== null}>
              {loading === "summarize" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {loading === "summarize" ? "Merangkum…" : "Ringkas Otomatis"}
            </Button>
            <Button variant="ghost" onClick={onReset}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
