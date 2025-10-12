"use client"

import Image from "next/image"
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Stepper, type StepStatus } from "@/components/ui/stepper"
import { toast } from "@/components/ui/use-toast"
import SpecEditor, { type SpecData, emptySpec, specToMarkdown } from "@/components/spec-editor"
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Eye,
  FileCode2,
  LoaderCircle,
  NotebookPen,
  RotateCcw,
  Sparkles,
  UploadCloud,
} from "lucide-react"

type AiMode = "summarize" | "spec"
type Step = "input" | "summary" | "spec"
const STORAGE_KEY = "rembuganai-session"

export default function HomePage() {
  const [transcript, setTranscript] = useState("")
  const [summary, setSummary] = useState("")
  const [spec, setSpec] = useState<SpecData>(emptySpec)
  const [loading, setLoading] = useState<AiMode | null>(null)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState<"docx" | "pdf" | null>(null)
  const [step, setStep] = useState<Step>("input")
  const [summaryView, setSummaryView] = useState<"preview" | "markdown">("preview")
  const [isDragging, setIsDragging] = useState(false)
  const [projectName, setProjectName] = useState("")
  const [syncingOutline, setSyncingOutline] = useState(false)

  // Persist session locally (optional bonus)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        setTranscript(parsed.transcript || "")
        setSummary(parsed.summary || "")
        setSpec(parsed.spec || emptySpec)
        setProjectName(parsed.projectName || "")
      }
    } catch { }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ transcript, summary, spec, projectName }))
    } catch { }
  }, [transcript, summary, spec, projectName])

  async function callAI(mode: AiMode, nextStep?: Step) {
    if (!transcript.trim()) {
      toast({ title: "Transkrip belum diisi", description: "Unggah atau tempelkan teks rapat terlebih dahulu." })
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
        if (nextStep === "summary") setSummaryView("preview")
        if (nextStep) setStep(nextStep)
      } else {
        setSpec(data.spec || emptySpec)
        if (!summary && data.summary) setSummary(data.summary)
        if (nextStep) setStep(nextStep)
      }
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Please try again."
      toast({ title: "Something went wrong", description })
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
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Only .txt and .docx are supported."
      toast({
        title: "Could not read file",
        description,
      })
    }
  }

  async function download(type: "docx" | "pdf") {
    if (downloading) return
    setDownloading(type)
    try {
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
      a.download = `rembuganai-spec.${type}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Please try again."
      toast({ title: "Download failed", description })
    } finally {
      setDownloading(null)
    }
  }

  const resetWorkflow = () => {
    setTranscript("")
    setSummary("")
    setSpec(emptySpec)
    setSummaryView("preview")
    setStep("input")
    setProjectName("")
  }

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const processFiles = async (files: FileList | File[]) => {
    if (uploading) {
      toast({ title: "Sedang memproses", description: "Tunggu hingga unggahan saat ini selesai." })
      return
    }

    const fileArray = Array.isArray(files) ? files : Array.from(files)
    if (!fileArray.length) return

    const accepted = fileArray.filter((file) => /\.(txt|docx)$/i.test(file.name))
    if (!accepted.length) {
      toast({ title: "Format tidak didukung", description: "Hanya berkas .txt atau .docx yang dapat diunggah." })
      return
    }

    if (accepted.length < fileArray.length) {
      toast({ title: "Beberapa berkas dilewati", description: "Hanya .txt atau .docx yang diproses." })
    }

    setUploading(true)
    try {
      for (const file of accepted) {
        await onUploadFile(file)
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleFileInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    await processFiles(event.target.files ?? [])
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
    await processFiles(files)
    event.dataTransfer.clearData()
  }

  const hasValues = (arr: string[]) => arr.some((item) => item.trim().length > 0)
  const stepItems: { key: Step; title: string; description: string }[] = [
    {
      key: "input",
      title: "Unggah Rapat",
      description: "Unggah catatan rapat atau tempel transkrip mentah.",
    },
    {
      key: "summary",
      title: "Ringkasan AI",
      description: "Kurasi highlight keputusan dan selaraskan narasi.",
    },
    {
      key: "spec",
      title: "Draft Spesifikasi",
      description: "Konversi ringkasan menjadi requirement siap bagikan.",
    },
  ]
  const currentStepIndex = stepItems.findIndex((s) => s.key === step)
  const summaryHasContent = summary.trim().length > 0
  const specHasContent =
    spec.productOverview.trim().length > 0 ||
    hasValues(spec.objectives) ||
    hasValues(spec.keyFeatures) ||
    hasValues(spec.functionalRequirements) ||
    hasValues(spec.nonFunctionalRequirements) ||
    hasValues(spec.userStories) ||
    hasValues(spec.constraintsRisks) ||
    hasValues(spec.openQuestions) ||
    hasValues(spec.uiUxRequirements)
  const stepperSteps = stepItems.map((item, idx) => {
    const status: StepStatus = idx < currentStepIndex ? "complete" : idx === currentStepIndex ? "current" : "upcoming"
    let onSelect: (() => void) | undefined
    if (idx <= currentStepIndex) {
      onSelect = () => setStep(item.key)
    } else if (item.key === "summary" && summaryHasContent) {
      onSelect = () => setStep("summary")
    } else if (item.key === "spec" && specHasContent) {
      onSelect = () => setStep("spec")
    }
    return {
      ...item,
      status,
      onSelect,
    }
  })

  const migrateToOutline = async () => {
    if (syncingOutline || loading !== null || downloading || uploading) return
    const name = projectName.trim()
    if (!name) {
      toast({ title: "Nama proyek diperlukan", description: "Masukkan nama proyek untuk membuat koleksi di Outline." })
      return
    }
    if (!summary.trim() && !specHasContent) {
      toast({ title: "Tidak ada konten", description: "Buat ringkasan atau spesifikasi sebelum migrasi." })
      return
    }

    const markdown = specToMarkdown(spec, summary)
    if (!markdown.trim()) {
      toast({ title: "Tidak ada konten", description: "Spesifikasi kosong tidak dapat dikirim ke Outline." })
      return
    }

    setSyncingOutline(true)
    try {
      const res = await fetch("/api/integrations/outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName: name, markdown, summary }),
      })

      if (!res.ok) {
        const message = await res.text()
        throw new Error(message || "Outline response error")
      }

      const data = (await res.json()) as {
        collection?: { name: string; url?: string }
        document?: { title: string; url?: string }
      }

      toast({
        title: "Berhasil dikirim ke Outline",
        description: data.document?.title
          ? `${data.document.title} tersimpan di koleksi ${data.collection?.name ?? name}.`
          : `Konten berhasil disimpan ke Outline.`,
      })

      if (data.document?.url) {
        window.open(`${process.env.NEXT_PUBLIC_OUTLINE_BASE_URL}${data.document.url}`, "_blank", "noopener")
      } else if (data.collection?.url) {
        window.open(`${process.env.NEXT_PUBLIC_OUTLINE_BASE_URL}${data.collection.url}`, "_blank", "noopener")
      }
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Gagal mengirim ke Outline"
      toast({ title: "Migrasi Outline gagal", description })
    } finally {
      setSyncingOutline(false)
    }
  }

  return (
    <main className="relative mx-auto max-w-6xl p-4 sm:p-6 md:p-10">
      {(loading !== null || uploading || downloading !== null || syncingOutline) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/20 bg-card px-6 py-5 text-center shadow-lg shadow-primary/10">
            <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {uploading
                  ? "Memuat transkrip…"
                  : downloading === "docx"
                    ? "Menyiapkan dokumen DOCX"
                    : downloading === "pdf"
                      ? "Menyiapkan dokumen PDF"
                      : syncingOutline
                        ? "Mengirim dokumen ke Outline"
                        : loading === "summarize"
                          ? "AI sedang merangkum"
                          : "AI sedang menyusun spesifikasi"}
              </p>
              <p className="text-xs text-muted-foreground">Mohon tunggu, RembuganAI sedang bekerja.</p>
            </div>
          </div>
        </div>
      )}
      <header className="mb-12 grid gap-6 lg:grid-cols-[auto,1fr] lg:items-center">
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
      </header>

      <Stepper steps={stepperSteps} className="mb-6" />

      {step === "input" && (
        <section className="mx-auto flex max-w-5xl flex-col gap-6">
          <div className="flex items-center justify-end">
            <Button
              className="gap-2"
              variant="ghost"
              onClick={() => {
                setSummaryView("preview")
                setStep("summary")
              }}
              disabled={!summaryHasContent}
            >
              <ArrowRight className="h-4 w-4" />
              Lihat Ringkasan
            </Button>
          </div>
          <Card className="overflow-hidden">
            <CardHeader className="space-y-2">
              <CardTitle>Unggah Rembugan</CardTitle>
              <p className="text-sm text-muted-foreground">
                Unggah atau tempelkan transkrip rapat, lalu biarkan RembuganAI mengolahnya menjadi ringkasan bernas.
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="pointer-events-none mt-4"
                  >
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
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  className="gap-2"
                  onClick={() => callAI("summarize", "summary")}
                  disabled={loading !== null}
                >
                  {loading === "summarize" ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {loading === "summarize" ? "Merangkum…" : "Ringkas Otomatis"}
                </Button>
                <Button variant="ghost" onClick={resetWorkflow}>
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {step === "summary" && (
        <section className="mx-auto max-w-5xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button className="gap-2" variant="ghost" onClick={() => setStep("input")}>
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Unggah Transkrip
            </Button>
            <Button variant="ghost" onClick={() => setStep("spec")} disabled={!specHasContent}>
              <ArrowRight /> Lihat Spesifikasi
            </Button>
          </div>

          <Card>
            <CardHeader className="space-y-2">
              <CardTitle>Ringkasan Rembugan</CardTitle>
              <p className="text-sm text-muted-foreground">
                Tinjau versi Markdown yang dirender atau sunting langsung struktur Markdown yang akan diteruskan ke tim.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card/60 p-1 shadow-sm">
                  <Button
                    variant={summaryView === "preview" ? "default" : "ghost"}
                    size="sm"
                    className="gap-2 rounded-lg"
                    onClick={() => setSummaryView("preview")}
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </Button>
                  <Button
                    variant={summaryView === "markdown" ? "default" : "ghost"}
                    size="sm"
                    className="gap-2 rounded-lg"
                    onClick={() => setSummaryView("markdown")}
                  >
                    <FileCode2 className="h-4 w-4" />
                    Markdown
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    navigator.clipboard.writeText(summary || "")
                    toast({ title: "Ringkasan disalin" })
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Salin
                </Button>
              </div>
              {summaryView === "markdown" ? (
                <Textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Ringkasan akan muncul di sini..."
                  className="min-h-[160px] font-mono"
                />
              ) : (
                <div className="rounded-md border bg-muted/40 p-4">
                  {summary ? (
                    <div className="prose max-w-none text-sm leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Ringkasan akan ditampilkan di sini setelah Anda menjalankan proses AI atau menulis secara manual.
                    </p>
                  )}
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <Button onClick={() => callAI("spec", "spec")} disabled={loading !== null || !summaryHasContent}>
                  {loading === "spec" ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {loading === "spec" ? "Menyusun…" : "Generate Spesifikasi"}
                </Button>
                <Button variant="ghost" onClick={() => callAI("summarize")} disabled={loading !== null}>
                  {loading === "summarize" ? "Merangkum…" : "Perbarui Ringkasan"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {step === "spec" && (
        <section className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button className="gap-2" variant="ghost" onClick={() => setStep("summary")}>
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Ringkasan
            </Button>
            <Button
              variant="outline"
              onClick={resetWorkflow}
              className="gap-2"
              disabled={!!downloading || loading !== null || syncingOutline}
            >
              <RotateCcw className="h-4 w-4" />
              Reset Semua
            </Button>
          </div>

          <Card className="border-primary/40 shadow-xl shadow-primary/10">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl">Draft Spesifikasi Produk</CardTitle>
              <p className="text-sm text-muted-foreground">
                Lengkapi detail spesifikasi dengan cepat dari ringkasan rapat dan highlight keputusan penting.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    1
                  </span>
                  <div>
                    <div className="font-medium text-foreground">Tinjau ringkasan</div>
                    <div>Pastikan ringkasan memuat konteks, keputusan, dan next step yang disepakati.</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    2
                  </span>
                  <div>
                    <div className="font-medium text-foreground">Lengkapi spesifikasi</div>
                    <div>Isi detail requirement, scope, dan risiko agar dokumen siap dikirim.</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    3
                  </span>
                  <div>
                    <div className="font-medium text-foreground">Bagikan deliverable</div>
                    <div>Ekspor ke DOCX, PDF, atau kirim Markdown langsung ke workspace tim.</div>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,2fr),minmax(0,1fr)] md:items-end">
                <div className="space-y-1">
                  <Label htmlFor="project-name" className="text-sm font-medium">
                    Nama Proyek (Outline)
                  </Label>
                  <Input
                    id="project-name"
                    placeholder="Contoh: RembuganAI Sprint Q4"
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    disabled={syncingOutline}
                  />
                  <p className="text-xs text-muted-foreground">
                    Nama ini digunakan sebagai koleksi saat migrasi ke Outline.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={migrateToOutline}
                  size={"lg"}
                  className="gap-2 md:justify-self-end"
                  disabled={
                    syncingOutline ||
                    loading !== null ||
                    !!downloading ||
                    uploading ||
                    (!specHasContent && !summary.trim()) ||
                    !projectName.trim()
                  }
                >
                  {syncingOutline ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <NotebookPen className="h-4 w-4" />}
                  Migrasi ke Outline
                </Button>
              </div>
              <SpecEditor value={spec} onChange={setSpec} />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => callAI("spec")} disabled={loading !== null}>
                  {loading === "spec" ? "Memperbarui…" : "Generate Ulang"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const md = specToMarkdown(spec, summary)
                    navigator.clipboard.writeText(md)
                    toast({ title: "Disalin dalam format Markdown" })
                  }}
                >
                  Salin (Markdown)
                </Button>
                <Button onClick={() => download("docx")} disabled={!!downloading} className="gap-2">
                  {downloading === "docx" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  Unduh .docx
                </Button>
                <Button variant="secondary" onClick={() => download("pdf")} disabled={!!downloading} className="gap-2">
                  {downloading === "pdf" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  Unduh .pdf
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </main>
  )
}
