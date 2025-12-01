"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import type {
  MomReview,
  MomClarification,
  ClarificationAnswer,
  SummaryPhase,
  Step,
} from "@/types/mom"

const STORAGE_KEY = "rembuganai-session"

interface UseMomWorkflowProps {
  transcript: string
  step: Step
  setStep: (step: Step) => void
}

export function useMomWorkflow({ transcript, step, setStep }: UseMomWorkflowProps) {
  const [summary, setSummary] = useState("")
  const [momReview, setMomReview] = useState<MomReview | null>(null)
  const [clarifications, setClarifications] = useState<MomClarification[]>([])
  const [clarificationAnswers, setClarificationAnswers] = useState<ClarificationAnswer[]>([])
  const [summaryPhase, setSummaryPhase] = useState<SummaryPhase>("idle")
  const [clarificationInput, setClarificationInput] = useState("")
  const [clarificationPrefill, setClarificationPrefill] = useState<string | null>(null)
  const [loading, setLoading] = useState<"summarize" | null>(null)

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        setSummary(parsed.summary || "")
        setMomReview(parsed.momReview || null)
        setClarifications(parsed.clarifications || [])
        setClarificationAnswers(parsed.clarificationAnswers || [])
        if (parsed.summaryPhase) {
          setSummaryPhase(parsed.summaryPhase as SummaryPhase)
        } else if ((parsed.summary || "").trim().length > 0) {
          setSummaryPhase("finalized")
        }
      }
    } catch {}
  }, [])

  // Save to localStorage
  useEffect(() => {
    try {
      const existing = localStorage.getItem(STORAGE_KEY)
      const parsed = existing ? JSON.parse(existing) : {}
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...parsed,
          summary,
          momReview,
          clarifications,
          clarificationAnswers,
          summaryPhase,
        })
      )
    } catch {}
  }, [summary, momReview, clarifications, clarificationAnswers, summaryPhase])

  const clarificationOrder = useMemo(() => {
    const map = new Map<string, number>()
    clarifications.forEach((clar, index) => map.set(clar.id, index))
    return map
  }, [clarifications])

  const clarificationAnswerMap = useMemo(() => {
    const map = new Map<string, ClarificationAnswer>()
    clarificationAnswers.forEach((item) => {
      map.set(item.id, item)
    })
    return map
  }, [clarificationAnswers])

  const answeredClarificationIds = useMemo(
    () => new Set(clarificationAnswers.map((item) => item.id)),
    [clarificationAnswers]
  )

  const pendingClarifications = useMemo(
    () => clarifications.filter((item) => !answeredClarificationIds.has(item.id)),
    [clarifications, answeredClarificationIds]
  )

  const answeredClarifications = useMemo(
    () => clarifications.filter((item) => answeredClarificationIds.has(item.id)),
    [clarifications, answeredClarificationIds]
  )

  const activeClarification = pendingClarifications[0] ?? null
  const allClarificationsAnswered = clarifications.length === 0 || pendingClarifications.length === 0

  useEffect(() => {
    if (!activeClarification) {
      setClarificationInput("")
      setClarificationPrefill(null)
      return
    }

    if (clarificationPrefill !== null) {
      setClarificationInput(clarificationPrefill)
      setClarificationPrefill(null)
      return
    }

    const existing = clarificationAnswerMap.get(activeClarification.id)
    if (existing?.answer) {
      setClarificationInput(existing.answer)
      return
    }

    setClarificationInput(activeClarification.currentValue ?? "")
  }, [activeClarification, clarificationAnswerMap, clarificationPrefill])

  async function startMomWorkflow(nextStep?: Step) {
    if (!transcript.trim()) {
      toast.error("Transkrip belum diisi", { description: "Unggah atau tempelkan teks rapat terlebih dahulu." })
      return
    }

    setLoading("summarize")
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript, mode: "summarize", stage: "analyze" }),
      })
      if (!res.ok) throw new Error("AI request failed")
      const data = await res.json()

      setMomReview(data.review as MomReview)
      setClarifications(Array.isArray(data.clarifications) ? (data.clarifications as MomClarification[]) : [])
      setClarificationAnswers([])
      setClarificationPrefill(null)
      setSummaryPhase("review")
      setClarificationInput("")

      if (nextStep) {
        setStep(nextStep)
      } else if (step !== "summary") {
        setStep("summary")
      }

      if (Array.isArray(data.clarifications) && data.clarifications.length > 0) {
        toast.info("Perlu konfirmasi", {
          description: `${data.clarifications.length} pertanyaan klarifikasi siap dijawab.`,
        })
      } else {
        toast.success("Review siap", {
          description: 'Tidak ada klarifikasi tambahan. Klik "Buat Minutes of Meeting" untuk menyelesaikan.',
        })
      }
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Please try again."
      toast.error("Gagal menganalisis rapat", { description })
    } finally {
      setLoading(null)
    }
  }

  async function finalizeMomWorkflow(nextStep?: Step) {
    if (!momReview) {
      toast.error("Belum ada data review", { description: "Jalankan analisis Minutes of Meeting terlebih dahulu." })
      return
    }

    if (!transcript.trim()) {
      toast.error("Transkrip belum diisi", { description: "Unggah atau tempelkan teks rapat terlebih dahulu." })
      return
    }

    setLoading("summarize")
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: transcript,
          mode: "summarize",
          stage: "finalize",
          review: momReview,
          clarificationAnswers,
        }),
      })
      if (!res.ok) throw new Error("AI request failed")
      const data = await res.json()

      setSummary(data.summary || "")
      setMomReview((data.review as MomReview) || momReview)
      setClarificationAnswers((data.clarifications as ClarificationAnswer[]) || clarificationAnswers)
      setClarifications([])
      setSummaryPhase("finalized")

      toast.success("MoM siap", {
        description: "Minutes of Meeting sudah diperbarui berdasarkan klarifikasi Anda.",
      })

      if (nextStep) setStep(nextStep)
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Please try again."
      toast.error("Gagal menyusun MoM", { description })
    } finally {
      setLoading(null)
    }
  }

  const handleClarificationSubmit = (customAnswer?: string) => {
    if (!activeClarification) return

    const trimmed = customAnswer?.trim()
    const normalized = trimmed && trimmed.length > 0 ? trimmed : undefined

    setClarificationAnswers((prev) => {
      const filtered = prev.filter((item) => item.id !== activeClarification.id)
      const nextEntry: ClarificationAnswer = {
        id: activeClarification.id,
        fieldPath: activeClarification.fieldPath,
        prompt: activeClarification.prompt,
        answer: normalized,
      }
      const next = [...filtered, nextEntry]
      next.sort((a, b) => {
        const orderA = clarificationOrder.get(a.id) ?? 0
        const orderB = clarificationOrder.get(b.id) ?? 0
        return orderA - orderB
      })
      return next
    })
    setClarificationInput("")
  }

  const handleClarificationSkip = () => {
    handleClarificationSubmit()
  }

  const handleClarificationEdit = (clar: MomClarification) => {
    const previous = clarificationAnswerMap.get(clar.id)
    setClarificationAnswers((prev) => prev.filter((item) => item.id !== clar.id))
    setClarificationPrefill(previous?.answer ?? clar.currentValue ?? "")
  }

  const resetMomWorkflow = () => {
    setSummary("")
    setMomReview(null)
    setClarifications([])
    setClarificationAnswers([])
    setSummaryPhase("idle")
    setClarificationInput("")
    setClarificationPrefill(null)
  }

  const summaryReady = summaryPhase === "finalized" && summary.trim().length > 0
  const summaryInReview = summaryPhase === "review" && momReview !== null
  const summaryStepAvailable = summaryReady || summaryInReview

  return {
    summary,
    setSummary,
    momReview,
    clarifications,
    clarificationAnswers,
    summaryPhase,
    clarificationInput,
    setClarificationInput,
    loading,
    clarificationOrder,
    clarificationAnswerMap,
    answeredClarificationIds,
    pendingClarifications,
    answeredClarifications,
    activeClarification,
    allClarificationsAnswered,
    summaryReady,
    summaryInReview,
    summaryStepAvailable,
    startMomWorkflow,
    finalizeMomWorkflow,
    handleClarificationSubmit,
    handleClarificationSkip,
    handleClarificationEdit,
    resetMomWorkflow,
  }
}

export type UseMomWorkflowReturn = ReturnType<typeof useMomWorkflow>
