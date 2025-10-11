"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/use-toast"
import SpecEditor, { type SpecData, emptySpec, specToMarkdown } from "@/components/spec-editor"

type AiMode = "summarize" | "spec"

export default function HomePage() {
  const [transcript, setTranscript] = useState("")
  const [summary, setSummary] = useState("")
  const [spec, setSpec] = useState<SpecData>(emptySpec)
  const [loading, setLoading] = useState<AiMode | null>(null)
  const [highlight, setHighlight] = useState(true)

  // Persist session locally (optional bonus)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("meeting-spec-session")
      if (saved) {
        const parsed = JSON.parse(saved)
        setTranscript(parsed.transcript || "")
        setSummary(parsed.summary || "")
        setSpec(parsed.spec || emptySpec)
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem("meeting-spec-session", JSON.stringify({ transcript, summary, spec }))
    } catch {}
  }, [transcript, summary, spec])

  const keywords = useMemo(() => {
    // Derive simple keywords from features/objectives for optional highlighting
    const base = [
      ...spec.keyFeatures,
      ...spec.objectives,
      ...spec.functionalRequirements,
      ...spec.nonFunctionalRequirements,
    ]
    return Array.from(
      new Set(base.map((s) => s.toLowerCase()).flatMap((s) => s.split(/[^a-z0-9]+/i).filter(Boolean))),
    ).filter((w) => w.length > 4)
  }, [spec])

  const highlightedTranscript = useMemo(() => {
    if (!highlight || keywords.length === 0) return transcript
    // Escape regex special chars
    const escaped = keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    const re = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi")
    return transcript.replace(re, (m) => `[[[H:${m}]]]`)
  }, [transcript, keywords, highlight])

  const transcriptWithMarks = useMemo(() => {
    if (!highlight) return transcript
    // Render marked tokens with a subtle highlight
    const parts = highlightedTranscript.split("[[[")
    return parts.map((chunk, i) => {
      if (!chunk.includes("]]]")) return <span key={i}>{chunk}</span>
      const [tag, rest] = chunk.split("]]]")
      if (tag.startsWith("H:")) {
        const word = tag.slice(2)
        return (
          <span key={i}>
            <mark className="rounded-sm bg-accent/60 px-0.5 py-0.5 text-foreground">{word}</mark>
            {rest}
          </span>
        )
      }
      return <span key={i}>{chunk}</span>
    })
  }, [highlightedTranscript, highlight])

  async function callAI(mode: AiMode) {
    if (!transcript.trim()) {
      toast({ title: "No transcript provided", description: "Paste text or upload a file first." })
      return
    }
    setLoading(mode)
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript, mode }),
      })
      if (!res.ok) throw new Error("AI request failed")
      const data = await res.json()
      if (mode === "summarize") {
        setSummary(data.summary || "")
      } else {
        setSpec(data.spec || emptySpec)
        if (!summary && data.summary) setSummary(data.summary)
      }
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err?.message || "Please try again." })
    } finally {
      setLoading(null)
    }
  }

  async function onUploadFile(file: File) {
    if (!file) return
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: form })
      if (!res.ok) throw new Error("Upload failed")
      const data = await res.json()
      setTranscript((prev) => (prev ? prev + "\n\n" + data.text : data.text))
      toast({ title: "File loaded", description: `Extracted text from ${file.name}` })
    } catch (err: any) {
      toast({
        title: "Could not read file",
        description: err?.message || "Only .txt and .docx are supported.",
      })
    }
  }

  async function download(type: "docx" | "pdf") {
    const res = await fetch(`/api/download/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec, summary }),
    })
    if (!res.ok) {
      toast({ title: "Download failed", description: `Could not generate ${type.toUpperCase()}.` })
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `product-spec.${type}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
            Meeting Transcript → Product Specification
          </h1>
          <p className="text-muted-foreground">
            Paste a transcript or upload a file, then summarize and generate a structured spec.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setHighlight((h) => !h)}>
          {highlight ? "Disable" : "Enable"} Highlights
        </Button>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: Input */}
        <Card className="overflow-hidden">
          <CardHeader className="space-y-2">
            <CardTitle>Input</CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="file">Upload (.txt or .docx)</Label>
              <Input
                id="file"
                ref={fileInputRef}
                type="file"
                accept=".txt,.docx"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setUploading(true)
                  await onUploadFile(file)
                  setUploading(false)
                  if (fileInputRef.current) fileInputRef.current.value = ""
                }}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="transcript">Meeting Transcript</Label>
            <Textarea
              id="transcript"
              placeholder="Paste your meeting transcript here..."
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="min-h-[260px] font-mono"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => callAI("summarize")} disabled={loading !== null}>
                {loading === "summarize" ? "Summarizing…" : "Summarize"}
              </Button>
              <Button onClick={() => callAI("spec")} disabled={loading !== null} variant="default">
                {loading === "spec" ? "Generating…" : "Generate Specification"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(transcript)
                  toast({ title: "Copied transcript" })
                }}
              >
                Copy Transcript
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setTranscript("")
                  setSummary("")
                  setSpec(emptySpec)
                }}
              >
                Reset
              </Button>
            </div>
            {highlight && (
              <>
                <Separator />
                <div className="rounded-md border p-3">
                  <div className="mb-2 text-sm font-medium">Preview with Highlights</div>
                  <div className="prose max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                    {transcriptWithMarks}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right: Output */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Summary will appear here..."
                className="min-h-[120px]"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(summary || "")
                    toast({ title: "Copied summary" })
                  }}
                >
                  Copy
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Product Specification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SpecEditor value={spec} onChange={setSpec} />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const md = specToMarkdown(spec, summary)
                    navigator.clipboard.writeText(md)
                    toast({ title: "Copied as Markdown" })
                  }}
                >
                  Copy (Markdown)
                </Button>
                <Button onClick={() => download("docx")}>Download .docx</Button>
                <Button variant="secondary" onClick={() => download("pdf")}>
                  Download .pdf
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
