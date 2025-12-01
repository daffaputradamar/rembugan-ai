"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Eye, FileCode2, Sparkles, X, Loader2 } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"

export function MarkdownField({
  label,
  value,
  onChange,
  placeholder,
  id,
  minHeight = "100px",
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  id?: string
  minHeight?: string
}) {
  const [view, setView] = useState<"edit" | "preview">("preview")
  const [showAiPrompt, setShowAiPrompt] = useState(false)
  const [aiPrompt, setAiPrompt] = useState("")
  const [isAiProcessing, setIsAiProcessing] = useState(false)

  const handleAiEdit = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Prompt diperlukan", { description: "Masukkan instruksi untuk AI." })
      return
    }

    setIsAiProcessing(true)
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: value || "",
          mode: "edit",
          prompt: aiPrompt,
          fieldLabel: label,
        }),
      })

      if (!res.ok) throw new Error("AI request failed")
      
      const data = await res.json()
      onChange(data.result || "")
      setAiPrompt("")
      setShowAiPrompt(false)
      setView("preview")
      toast.success("Berhasil diperbarui", { description: "Konten telah diperbarui dengan AI." })
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Coba lagi."
      toast.error("AI gagal memproses", { description })
    } finally {
      setIsAiProcessing(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex items-center gap-2">
          {!showAiPrompt && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 rounded-md px-2 text-xs"
              onClick={() => setShowAiPrompt(true)}
              disabled={isAiProcessing}
            >
              <Sparkles className="h-3 w-3" />
              Edit dengan AI
            </Button>
          )}
          <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card/60 p-0.5 shadow-sm">
            <Button
              type="button"
              variant={view === "edit" ? "default" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 rounded-md px-2 text-xs"
              onClick={() => setView("edit")}
              disabled={isAiProcessing}
            >
              <FileCode2 className="h-3 w-3" />
              Edit
            </Button>
            <Button
              type="button"
              variant={view === "preview" ? "default" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 rounded-md px-2 text-xs"
              onClick={() => setView("preview")}
              disabled={isAiProcessing}
            >
              <Eye className="h-3 w-3" />
              Preview
            </Button>
          </div>
        </div>
      </div>
      
      {showAiPrompt && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={`${id}-ai-prompt`} className="text-sm font-medium">
              Instruksi AI
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => {
                setShowAiPrompt(false)
                setAiPrompt("")
              }}
              disabled={isAiProcessing}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <Input
            id={`${id}-ai-prompt`}
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Contoh: Tambahkan detail tentang skalabilitas sistem"
            disabled={isAiProcessing}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleAiEdit()
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            className="w-full gap-2"
            onClick={handleAiEdit}
            disabled={isAiProcessing || !aiPrompt.trim()}
          >
            {isAiProcessing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3" />
                Terapkan AI
              </>
            )}
          </Button>
        </div>
      )}
      
      {view === "edit" ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="font-mono"
          style={{ minHeight }}
        />
      ) : (
        <div
          className="rounded-md border bg-muted/40 p-4 overflow-auto"
          style={{ minHeight }}
        >
          {value ? (
            <div className="markdown-preview prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {placeholder || "No content to preview"}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
