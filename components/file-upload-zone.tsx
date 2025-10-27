"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UploadCloud } from "lucide-react"
import { type ChangeEvent, type DragEvent, type KeyboardEvent, useRef, useState } from "react"

interface FileUploadZoneProps {
  uploading: boolean
  onFilesSelected: (files: FileList | File[]) => Promise<void>
}

export function FileUploadZone({ uploading, onFilesSelected }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFileInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    await onFilesSelected(event.target.files ?? [])
  }

  const handleBrowseClick = () => {
    if (uploading) return
    fileInputRef.current?.click()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (uploading) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      fileInputRef.current?.click()
    }
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (uploading) return
    event.dataTransfer.dropEffect = "copy"
    setIsDragging(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (uploading) return
    const related = event.relatedTarget as Node | null
    if (related && event.currentTarget.contains(related)) return
    setIsDragging(false)
  }

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (uploading) return
    setIsDragging(false)
    const files = event.dataTransfer.files
    if (!files?.length) return
    await onFilesSelected(files)
    event.dataTransfer.clearData()
  }

  return (
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
        className={`group flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
          uploading
            ? "cursor-not-allowed border-border bg-muted/60 text-muted-foreground"
            : isDragging
              ? "border-primary bg-primary/10 text-foreground"
              : "cursor-pointer border-border bg-muted/40 text-muted-foreground hover:border-primary/50 hover:bg-primary/5"
        }`}
      >
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
  )
}
