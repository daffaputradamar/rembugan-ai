"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Stepper, type StepStatus } from "@/components/ui/stepper"
import { toast } from "sonner"
import { type SpecData, emptySpec } from "@/components/spec-editor"
import { urdToMarkdown, analysisDesignToMarkdown, testScenarioToMarkdown } from "@/lib/spec-markdown"
import { LoadingOverlay } from "@/components/loading-overlay"
import { AppHeader } from "@/components/app-header"
import { TranscriptInputSection } from "@/components/transcript-input-section"
import { MomSection } from "@/components/mom-section"
import { SpecSection } from "@/components/spec-section"
import { useMomWorkflow } from "@/hooks/use-mom-workflow"
import type { AiMode, Step, CustomTemplate } from "@/types/mom"

const STORAGE_KEY = "rembuganai-session"

export default function HomePage() {
  const { data: session } = useSession()
  const [transcript, setTranscript] = useState("")
  const [spec, setSpec] = useState<SpecData>(emptySpec)
  const [loading, setLoading] = useState<AiMode | null>(null)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState<"docx" | "pdf" | null>(null)
  const [downloadingMom, setDownloadingMom] = useState<"docx" | "pdf" | null>(null)
  const [step, setStep] = useState<Step>("input")
  const [projectName, setProjectName] = useState("")
  const [syncingOutline, setSyncingOutline] = useState(false)
  const [generatingStep, setGeneratingStep] = useState<"urd" | "analysisDesign" | "testScenario" | null>(null)
  const [customTemplate, setCustomTemplate] = useState<CustomTemplate | null>(null)

  const momWorkflow = useMomWorkflow({ transcript, step, setStep, customTemplate })

  // Persist session locally
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        setTranscript(parsed.transcript || "")
        setSpec(parsed.spec || emptySpec)
        setProjectName(parsed.projectName || "")
        setCustomTemplate(parsed.customTemplate || null)
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ transcript, spec, projectName, customTemplate }))
    } catch {}
  }, [transcript, spec, projectName, customTemplate])

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
      toast.error("Transkrip belum diisi", { description: "Unggah atau tempelkan teks rapat terlebih dahulu." })
      return
    }

    setLoading(mode)
    try {
      if (mode === "spec") {
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

          if (docStep === "analysisDesign" && data.analysisDesign) {
            data.analysisDesign = cleanDiagrams(data.analysisDesign)
          }

          setSpec((prevSpec) => ({
            ...prevSpec,
            [docStep]: data[docStep] || prevSpec[docStep],
          }))

          const docName = docStep === "urd" ? "URD" : docStep === "analysisDesign" ? "Analysis & Design" : "Test Scenario"
          toast.success(`${docName} selesai`, { description: `Dokumen ${docName} telah berhasil dibuat.` })
        }

        setGeneratingStep(null)
        if (nextStep) setStep(nextStep)
      }
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Please try again."
      toast.error("Something went wrong", { description })
      setGeneratingStep(null)
    } finally {
      setLoading(null)
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
        toast.error("Download failed", { description: `Could not generate ${type.toUpperCase()}.` })
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
      toast.error("Download failed", { description })
    } finally {
      setDownloading(null)
    }
  }

  async function downloadMom(type: "docx" | "pdf") {
    if (downloadingMom || !momWorkflow.summary.trim()) return
    setDownloadingMom(type)
    try {
      const res = await fetch(`/api/download/mom/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: momWorkflow.summary, filename: `minutes-of-meeting.${type}` }),
      })
      if (!res.ok) {
        toast.error("Download gagal", { description: `Tidak dapat membuat file ${type.toUpperCase()}.` })
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `minutes-of-meeting.${type}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success("Download berhasil", { description: `Minutes of Meeting berhasil diunduh sebagai ${type.toUpperCase()}.` })
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Silakan coba lagi."
      toast.error("Download gagal", { description })
    } finally {
      setDownloadingMom(null)
    }
  }

  const resetWorkflow = () => {
    setTranscript("")
    setSpec(emptySpec)
    setStep("input")
    setProjectName("")
    setCustomTemplate(null)
    momWorkflow.resetMomWorkflow()
  }

  const migrateToOutline = async () => {
    if (syncingOutline || loading !== null || downloading || uploading) return
    const name = projectName.trim()
    if (!name) {
      toast.error("Nama proyek diperlukan", { description: "Masukkan nama proyek untuk membuat koleksi di Outline." })
      return
    }
    if (!momWorkflow.summary.trim() && !specHasContent) {
      toast.error("Tidak ada konten", { description: "Buat Minutes of Meeting atau spesifikasi sebelum migrasi." })
      return
    }

    const urd = urdToMarkdown(spec.urd, momWorkflow.summary)
    const analysisDesign = analysisDesignToMarkdown(spec.analysisDesign)
    const testScenario = testScenarioToMarkdown(spec.testScenario)

    if (!urd.trim() && !analysisDesign.trim() && !testScenario.trim()) {
      toast.error("Tidak ada konten", { description: "Spesifikasi kosong tidak dapat dikirim ke Outline." })
      return
    }

    setSyncingOutline(true)
    try {
      const res = await fetch("/api/integrations/outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName: name, urd, analysisDesign, testScenario, summary: momWorkflow.summary }),
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
      toast.success("Berhasil dikirim ke Outline", {
        description: docCount > 0
          ? `${docCount} dokumen tersimpan di koleksi ${data.collection?.name ?? name}.`
          : `Konten berhasil disimpan ke Outline.`,
      })

      if (data.documents?.[0]?.url) {
        window.open(`${process.env.NEXT_PUBLIC_OUTLINE_BASE_URL}${data.documents[0].url}`, "_blank", "noopener")
      } else if (data.collection?.url) {
        window.open(`${process.env.NEXT_PUBLIC_OUTLINE_BASE_URL}${data.collection.url}`, "_blank", "noopener")
      }
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Gagal mengirim ke Outline"
      toast.error("Migrasi Outline gagal", { description })
    } finally {
      setSyncingOutline(false)
    }
  }

  // Computed values
  const hasValues = (arr: string[]) => arr.some((item) => item.trim().length > 0)

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

  const stepItems: { key: Step; title: string; description: string }[] = [
    { key: "input", title: "Unggah Rapat", description: "Unggah catatan rapat atau tempel transkrip mentah." },
    { key: "summary", title: "Minutes of Meeting", description: "Susun MoM terstruktur dengan keputusan dan aksi lanjut." },
    { key: "spec", title: "Draft Spesifikasi", description: "Konversi Minutes of Meeting menjadi requirement siap bagikan." },
  ]

  const currentStepIndex = stepItems.findIndex((s) => s.key === step)

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
    return { ...item, status, onSelect }
  })

  return (
    <main className="relative mx-auto max-w-6xl p-4 sm:p-6 md:p-10">
      <LoadingOverlay
        loading={loading || momWorkflow.loading}
        uploading={uploading}
        downloading={downloading}
        downloadingMom={downloadingMom}
        syncingOutline={syncingOutline}
        generatingStep={generatingStep}
      />

      <AppHeader />

      <Stepper steps={stepperSteps} className="mb-6" />

      {step === "input" && (
        <TranscriptInputSection
          transcript={transcript}
          setTranscript={setTranscript}
          loading={loading}
          uploading={uploading}
          setUploading={setUploading}
          summaryStepAvailable={momWorkflow.summaryStepAvailable}
          onSummarize={() => callAI("summarize", "summary")}
          onReset={resetWorkflow}
          onGoToSummary={() => setStep("summary")}
          customTemplate={customTemplate}
          onTemplateChange={setCustomTemplate}
          userDivisionIds={session?.user?.divisionIds || []}
          userDepartmentIds={session?.user?.departmentIds || []}
          userDivisionNames={session?.user?.divisionNames || []}
          userDepartmentNames={session?.user?.departmentNames || []}
          isAuthenticated={!!session?.user}
        />
      )}

      {step === "summary" && (
        <MomSection
          momWorkflow={momWorkflow}
          loading={loading}
          downloadingMom={downloadingMom}
          specHasContent={specHasContent}
          onDownloadMom={downloadMom}
          onGenerateSpec={() => callAI("spec", "spec")}
          onGoToInput={() => setStep("input")}
          onGoToSpec={() => setStep("spec")}
        />
      )}

      {step === "spec" && (
        <SpecSection
          spec={spec}
          setSpec={setSpec}
          summary={momWorkflow.summary}
          projectName={projectName}
          setProjectName={setProjectName}
          loading={loading}
          downloading={downloading}
          syncingOutline={syncingOutline}
          specHasContent={specHasContent}
          onDownload={download}
          onGenerateSpec={() => callAI("spec")}
          onMigrateToOutline={migrateToOutline}
          onReset={resetWorkflow}
          onGoToSummary={() => setStep("summary")}
        />
      )}
    </main>
  )
}
