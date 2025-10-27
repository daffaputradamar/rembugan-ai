"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Stepper, type StepStatus } from "@/components/ui/stepper"
import { toast } from "@/components/ui/use-toast"
import { MarkdownField } from "@/components/markdown-field"
import SpecEditor, { type SpecData, emptySpec } from "@/components/spec-editor"
import { urdToMarkdown, analysisDesignToMarkdown, testScenarioToMarkdown, specToMarkdown } from "@/lib/spec-markdown"
import { ArrowLeft, ArrowRight, Copy, LoaderCircle, NotebookPen, RotateCcw, Sparkles, UploadCloud } from "lucide-react"
import Image from "next/image"
import { PageHeader } from "@/components/page-header"
import { FileUploadZone } from "@/components/file-upload-zone"
import { LoadingOverlay } from "@/components/loading-overlay"
import { MomReviewPanel } from "@/components/mom-review-panel"
import { useMomWorkflow } from "@/hooks/use-mom-workflow"
import type { AiMode, Step } from "@/types/mom"

const STORAGE_KEY = "rembuganai-session"

export default function HomePage() {
  const [transcript, setTranscript] = useState("")
  const [spec, setSpec] = useState<SpecData>(emptySpec)
  const [loading, setLoading] = useState<AiMode | null>(null)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState<"docx" | "pdf" | null>(null)
  const [step, setStep] = useState<Step>("input")
  const [projectName, setProjectName] = useState("")
  const [syncingOutline, setSyncingOutline] = useState(false)
  const [generatingStep, setGeneratingStep] = useState<"urd" | "analysisDesign" | "testScenario" | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const momWorkflow = useMomWorkflow({ transcript, step, setStep })

  // Persist session locally
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        setTranscript(parsed.transcript || "")
        setSpec(parsed.spec || emptySpec)
        setProjectName(parsed.projectName || "")
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          transcript,
          spec,
          projectName,
        })
      )
    } catch {}
  }, [transcript, spec, projectName])

  // Helper function to clean escaped newlines in diagrams
  const cleanDiagrams = (data: any) => {
    if (data.useCaseDiagram) data.useCaseDiagram = data.useCaseDiagram.replace(/\\n/g, "\n")
    if (data.erdDiagram) data.erdDiagram = data.erdDiagram.replace(/\\n/g, "\n")
    if (data.systemArchitecture) data.systemArchitecture = data.systemArchitecture.replace(/\\n/g, "\n")
    if (data.containerDiagram) data.containerDiagram = data.containerDiagram.replace(/\\n/g, "\n")
    if (data.sequenceDiagram) data.sequenceDiagram = data.sequenceDiagram.replace(/\\n/g, "\n")
    if (data.deploymentArchitecture) data.deploymentArchitecture = data.deploymentArchitecture.replace(/\\n/g, "\n")
    return data
  }

  async function callAI(mode: AiMode, nextStep?: Step) {
    if (mode === "summarize") {
      await momWorkflow.startMomWorkflow(nextStep)
      return
    }

    if (!transcript.trim()) {
      toast({ title: "Transkrip belum diisi", description: "Unggah atau tempelkan teks rapat terlebih dahulu." })
      return
    }

    setLoading(mode)
    try {
      if (mode === "spec") {
        // Generate specs in 3 steps
        const steps: Array<"urd" | "analysisDesign" | "testScenario"> = ["urd", "analysisDesign", "testScenario"]
        
        for (const docStep of steps) {
          setGeneratingStep(docStep)
          const res = await fetch("/api/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: transcript, mode: "spec", step: docStep }),
          })
          if (!res.ok) throw new Error(`Failed to generate ${docStep}`)
          const data = await res.json()
          
          // Clean up any escaped newlines in diagrams
          if (docStep === "analysisDesign" && data.analysisDesign) {
            data.analysisDesign = cleanDiagrams(data.analysisDesign)
          }
          
          // Update spec progressively
          setSpec((prevSpec) => ({
            ...prevSpec,
            [docStep]: data[docStep] || prevSpec[docStep],
          }))
          
          // Show success toast for each completed document
          const docName = docStep === "urd" ? "URD" : docStep === "analysisDesign" ? "Analysis & Design" : "Test Scenario"
          toast({ 
            title: `${docName} selesai`,
            description: `Dokumen ${docName} telah berhasil dibuat.`,
          })
        }
        
        setGeneratingStep(null)
        if (nextStep) setStep(nextStep)
      }
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Please try again."
      toast({ title: "Something went wrong", description })
      setGeneratingStep(null)
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

  async function processFiles(files: FileList | File[]) {
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

  async function download(type: "docx" | "pdf") {
    if (downloading) return
    setDownloading(type)
    try {
      const res = await fetch(`/api/download/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec, summary: momWorkflow.summary }),
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
    setSpec(emptySpec)
    setStep("input")
    setProjectName("")
    momWorkflow.resetMomWorkflow()
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
      title: "Minutes of Meeting",
      description: "Susun MoM terstruktur dengan keputusan dan aksi lanjut.",
    },
    {
      key: "spec",
      title: "Draft Spesifikasi",
      description: "Konversi Minutes of Meeting menjadi requirement siap bagikan.",
    },
  ]
  const currentStepIndex = stepItems.findIndex((s) => s.key === step)
  const specHasContent =
    spec.urd.projectName.trim().length > 0 ||
    spec.urd.background.trim().length > 0 ||
    spec.urd.objective.trim().length > 0 ||
    hasValues(spec.urd.inScope) ||
    hasValues(spec.urd.outOfScope) ||
    spec.urd.functionalRequirements.length > 0 ||
    spec.urd.nonFunctionalRequirements.length > 0 ||
    spec.analysisDesign.projectName.trim().length > 0 ||
    spec.analysisDesign.objective.trim().length > 0 ||
    spec.testScenario.projectName.trim().length > 0 ||
    spec.testScenario.objective.trim().length > 0
  const stepperSteps = stepItems.map((item, idx) => {
    const status: StepStatus = idx < currentStepIndex ? "complete" : idx === currentStepIndex ? "current" : "upcoming"
    let onSelect: (() => void) | undefined
    if (idx <= currentStepIndex) {
      onSelect = () => setStep(item.key)
    } else if (item.key === "summary" && momWorkflow.summaryStepAvailable) {
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
    if (!momWorkflow.summary.trim() && !specHasContent) {
      toast({ title: "Tidak ada konten", description: "Buat Minutes of Meeting atau spesifikasi sebelum migrasi." })
      return
    }

    // Generate separate markdown for each document
    const urd = urdToMarkdown(spec.urd, momWorkflow.summary)
    const analysisDesign = analysisDesignToMarkdown(spec.analysisDesign)
    const testScenario = testScenarioToMarkdown(spec.testScenario)

    if (!urd.trim() && !analysisDesign.trim() && !testScenario.trim()) {
      toast({ title: "Tidak ada konten", description: "Spesifikasi kosong tidak dapat dikirim ke Outline." })
      return
    }

    setSyncingOutline(true)
    try {
      const res = await fetch("/api/integrations/outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          projectName: name, 
          urd, 
          analysisDesign, 
          testScenario, 
          summary: momWorkflow.summary 
        }),
      })

      if (!res.ok) {
        const message = await res.text()
        throw new Error(message || "Outline response error")
      }

      const data = (await res.json()) as {
        collection?: { name: string; url?: string }
        documents?: Array<{ title: string; url?: string }>
      }

      const docCount = data.documents?.length || 0
      toast({
        title: "Berhasil dikirim ke Outline",
        description: docCount > 0
          ? `${docCount} dokumen tersimpan di koleksi ${data.collection?.name ?? name}.`
          : `Konten berhasil disimpan ke Outline.`,
      })

      // Open the first document or collection
      if (data.documents?.[0]?.url) {
        window.open(`${process.env.NEXT_PUBLIC_OUTLINE_BASE_URL}${data.documents[0].url}`, "_blank", "noopener")
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
      <LoadingOverlay
        loading={loading || momWorkflow.loading}
        uploading={uploading}
        downloading={downloading}
        syncingOutline={syncingOutline}
        generatingStep={generatingStep}
      />
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
                setStep("summary")
              }}
              disabled={!momWorkflow.summaryStepAvailable}
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
                  className={`group flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${uploading
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
              <CardTitle>Minutes of Meeting</CardTitle>
              <p className="text-sm text-muted-foreground">
                Tinjau dan sunting minutes of meeting berbasis Markdown sebelum dibagikan ke tim.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {momWorkflow.summaryPhase === "review" && momWorkflow.momReview ? (
                <MomReviewPanel
                  momReview={momWorkflow.momReview}
                  summaryReady={momWorkflow.summaryReady}
                  clarifications={momWorkflow.clarifications}
                  clarificationAnswers={momWorkflow.clarificationAnswers}
                  activeClarification={momWorkflow.activeClarification}
                  answeredClarifications={momWorkflow.answeredClarifications}
                  allClarificationsAnswered={momWorkflow.allClarificationsAnswered}
                  pendingClarifications={momWorkflow.pendingClarifications}
                  clarificationInput={momWorkflow.clarificationInput}
                  loading={loading || momWorkflow.loading}
                  clarificationAnswerMap={momWorkflow.clarificationAnswerMap}
                  onClarificationInputChange={momWorkflow.setClarificationInput}
                  onClarificationSubmit={momWorkflow.handleClarificationSubmit}
                  onClarificationSkip={momWorkflow.handleClarificationSkip}
                  onClarificationEdit={momWorkflow.handleClarificationEdit}
                  onFinalizeMom={() => momWorkflow.finalizeMomWorkflow()}
                  onReloadClarifications={() => momWorkflow.startMomWorkflow("summary")}
                />
              ) : momWorkflow.summaryPhase === "finalized" ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-muted-foreground">
                      Sunting konten Minutes of Meeting di bawah ini.
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        navigator.clipboard.writeText(momWorkflow.summary || "")
                        toast({ title: "Minutes of Meeting disalin" })
                      }}
                    >
                      <Copy className="h-4 w-4" />
                      Salin
                    </Button>
                  </div>
                  <MarkdownField
                    label="Minutes of Meeting"
                    value={momWorkflow.summary}
                    onChange={momWorkflow.setSummary}
                    placeholder="Minutes of Meeting akan muncul di sini setelah proses AI selesai."
                    minHeight="200px"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button onClick={() => callAI("spec", "spec")} disabled={loading !== null || !momWorkflow.summaryReady}>
                      {loading === "spec" ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {loading === "spec" ? "Menyusun…" : "Generate Spesifikasi"}
                    </Button>
                    <Button variant="ghost" onClick={() => momWorkflow.startMomWorkflow()} disabled={loading !== null}>
                      {loading === "summarize" ? "Menyiapkan review…" : "Perbarui Minutes of Meeting"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  <p>Belum ada Minutes of Meeting.</p>
                  <p>
                    Jalankan <span className="font-medium text-foreground">Ringkas Otomatis</span> pada langkah sebelumnya untuk memulai review.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {step === "spec" && (
        <section className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button className="gap-2" variant="ghost" onClick={() => setStep("summary")}>
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Minutes of Meeting
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
                Lengkapi detail spesifikasi dengan cepat dari Minutes of Meeting dan highlight keputusan penting.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    1
                  </span>
                  <div>
                    <div className="font-medium text-foreground">Tinjau Minutes of Meeting</div>
                    <div>Pastikan MoM memuat konteks, keputusan, dan next step yang disepakati.</div>
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
              {
                process.env.NEXT_PUBLIC_OUTLINE_BASE_URL && (
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
                        (!specHasContent && !momWorkflow.summary.trim()) ||
                        !projectName.trim()
                      }
                    >
                      {syncingOutline ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <NotebookPen className="h-4 w-4" />}
                      Migrasi ke Outline
                    </Button>
                  </div>
                )
              }
              <SpecEditor value={spec} onChange={setSpec} />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => callAI("spec")} disabled={loading !== null}>
                  {loading === "spec" ? "Memperbarui…" : "Generate Ulang"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const md = specToMarkdown(spec, momWorkflow.summary)
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
