"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Eye, FileCode2, Sparkles, X, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import mermaid from "mermaid"

function extractMermaidContent(text: string) {
  const fenced = text.match(/```mermaid\s*([\s\S]*?)```/i)
  if (fenced) {
    return fenced[1].trim()
  }

  const genericFence = text.match(/```\s*([\s\S]*?)```/)
  if (genericFence) {
    return genericFence[1].trim()
  }

  return text.trim()
}

type MermaidAPI = typeof import("mermaid").default

let mermaidPromise: Promise<MermaidAPI> | null = null

async function getMermaid(): Promise<MermaidAPI> {
  if (!mermaidPromise) {
    mermaidPromise = (async () => {
        mermaid.initialize({ startOnLoad: false, securityLevel: "loose" })
        return mermaid;
    })()
  }

  return mermaidPromise
}

export function DiagramViewer({
  label,
  value,
  onChange,
  id,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  id: string
}) {
  const [mode, setMode] = useState<"preview" | "edit">("preview")
  const [showAiPrompt, setShowAiPrompt] = useState(false)
  const [aiPrompt, setAiPrompt] = useState("")
  const [isAiProcessing, setIsAiProcessing] = useState(false)
  const [mermaidSvg, setMermaidSvg] = useState("")
  const [renderError, setRenderError] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(false)
  const renderBaseId = useMemo(() => {
    const sanitized = id.replace(/[^a-zA-Z0-9_-]/g, "-") || "diagram"
    return `${sanitized}-${Math.random().toString(36).slice(2, 8)}`
  }, [id])
  const renderCounter = useRef(0)
  const hasDiagram = value.trim().length > 0
  const shouldIncludeMermaidContext = /diagram/i.test(label)

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
          includeMermaidContext: shouldIncludeMermaidContext,
        }),
      })

      if (!res.ok) throw new Error("AI request failed")
      
      const data = await res.json()
      const rawResult = data.result || ""
      const nextValue = extractMermaidContent(rawResult)

      onChange(nextValue)
      setAiPrompt("")
      setShowAiPrompt(false)
      setMode("preview")
      toast.success("Berhasil diperbarui", { description: "Diagram telah diperbarui dengan AI." })
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Coba lagi."
      toast.error("AI gagal memproses", { description })
    } finally {
      setIsAiProcessing(false)
    }
  }

  const handleAiRegenerate = async () => {
    if (!value.trim()) {
      toast.error("Diagram kosong", {
        description: "Tambahkan definisi diagram terlebih dahulu sebelum memperbaikinya dengan AI.",
      })
      return
    }

    if (!renderError) {
      toast.info("Tidak ada error", {
        description: "Diagram saat ini tidak memiliki error untuk diperbaiki.",
      })
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
          prompt: `Perbaiki diagram Mermaid agar valid. Gunakan pesan error berikut sebagai konteks: ${renderError}. Balas hanya dengan definisi Mermaid yang lengkap dan valid tanpa penjelasan tambahan.`,
          fieldLabel: label,
          includeMermaidContext: shouldIncludeMermaidContext,
        }),
      })

      if (!res.ok) throw new Error("AI request failed")

      const data = await res.json()
      const result = extractMermaidContent(data.result || "")

      if (!result) {
        throw new Error("AI tidak mengembalikan hasil perbaikan.")
      }

      onChange(result)
      setMode("preview")
      toast.success("Diagram diperbaiki", {
        description: "AI mencoba memperbaiki diagram berdasarkan pesan error.",
      })
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Coba lagi."
      toast.error("Gagal memperbaiki dengan AI", { description })
    } finally {
      setIsAiProcessing(false)
    }
  }

  useEffect(() => {
    if (mode !== "preview") {
      setIsRendering(false)
      return
    }

    const trimmed = value.trim()
    if (!trimmed) {
      setMermaidSvg("")
      setRenderError(null)
      setIsRendering(false)
      return
    }

    let cancelled = false
    const renderDiagram = async () => {
      setIsRendering(true)
      try {
        const mermaid = await getMermaid()

        const isMermaidValid = await mermaid.parse(trimmed)

        if(!isMermaidValid) {
          setRenderError("Diagram Mermaid tidak valid.")
          setMermaidSvg("")
          return
        }

        renderCounter.current += 1
        const renderId = `${renderBaseId}-${renderCounter.current}`
        const { svg } = await mermaid.render(renderId, trimmed)
        
        if (!cancelled) {
          setMermaidSvg(svg)
          setRenderError(null)
        }
      } catch (error: unknown) {

        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Gagal merender diagram Mermaid."
          setRenderError(message)
          setMermaidSvg("")
        }
      } finally {
        if (!cancelled) {
          setIsRendering(false)
        }
      }
    }

    renderDiagram()

    return () => {
      cancelled = true
    }
  }, [mode, value, renderBaseId])

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
          <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card/60 p-1">
            <Button
              type="button"
              variant={mode === "preview" ? "default" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 rounded px-2 text-xs"
              onClick={() => setMode("preview")}
              disabled={isAiProcessing}
            >
              <Eye className="h-3 w-3" />
              Preview
            </Button>
            <Button
              type="button"
              variant={mode === "edit" ? "default" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 rounded px-2 text-xs"
              onClick={() => setMode("edit")}
              disabled={isAiProcessing}
            >
              <FileCode2 className="h-3 w-3" />
              Edit
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
            placeholder="Contoh: Tambahkan tabel users dengan field email dan password"
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
      
      {mode === "edit" ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[200px] font-mono text-xs leading-relaxed"
          placeholder="Tulis definisi Mermaid di sini, mis. `flowchart LR` atau `erDiagram`."
        />
      ) : (
        <div className="min-h-[200px] rounded-md border bg-muted/40 p-4 overflow-x-auto">
          {hasDiagram ? (
            <div className="space-y-3">
              {isRendering ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Merender diagram Mermaid…
                </div>
              ) : mermaidSvg ? (
                <div
                  className="overflow-auto"
                  dangerouslySetInnerHTML={{ __html: mermaidSvg }}
                />
              ) : renderError ? null : (
                <p className="text-xs text-muted-foreground">
                  Diagram Mermaid akan muncul setelah Anda menulis definisinya.
                </p>
              )}

              {renderError && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  <p className="font-medium">Tidak bisa menampilkan Mermaid</p>
                  <p className="mt-1 break-words">{renderError}</p>
                  <p className="mt-1">Gunakan tab Edit untuk melihat dan memperbaiki definisi aslinya.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAiRegenerate}
                      disabled={isAiProcessing}
                      className="gap-1.5"
                    >
                      {isAiProcessing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      Perbaiki dengan AI
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Diagram belum tersedia. Klik Edit untuk menambahkan definisi Mermaid.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
