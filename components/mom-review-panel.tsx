"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { LoaderCircle, Save } from "lucide-react"

type MomAttendee = { name: string; role: string }
type MomTopic = { topic: string; keyPoints: string; decision: string }
type MomActionItem = { action: string; pic: string; dueDate: string }
type MomRisk = { risk: string; impact: string; mitigation: string }
type MomOpenIssue = { question: string; owner: string }
type MomNextMeeting = { date: string; agenda: string; expectedOutcome: string }

type MomReview = {
  projectName: string
  meetingTitle: string
  meetingObjective: string
  meetingDate: string
  meetingTime: string
  meetingLocation: string
  attendees: MomAttendee[]
  topics: MomTopic[]
  actionItems: MomActionItem[]
  risks: MomRisk[]
  openIssues: MomOpenIssue[]
  nextMeeting: MomNextMeeting
}

type ClarificationFieldPath =
  | "projectName"
  | "meetingTitle"
  | "meetingObjective"
  | "meetingDate"
  | "meetingTime"
  | "meetingLocation"
  | "attendees"
  | "topics"
  | "actionItems"
  | "risks"
  | "openIssues"
  | "nextMeeting"
  | "nextMeeting.date"
  | "nextMeeting.agenda"
  | "nextMeeting.expectedOutcome"

type MomClarification = {
  id: string
  fieldPath: ClarificationFieldPath
  prompt: string
  currentValue?: string
  answerType: "text" | "list" | "date"
  formatHint?: string
  suggestions?: string[]
  severity: "high" | "medium" | "low"
}

type ClarificationAnswer = {
  id: string
  fieldPath: ClarificationFieldPath
  prompt: string
  answer?: string
}

interface MomReviewPanelProps {
  momReview: MomReview
  summaryReady: boolean
  clarifications: MomClarification[]
  clarificationAnswers: ClarificationAnswer[]
  activeClarification: MomClarification | null
  answeredClarifications: MomClarification[]
  allClarificationsAnswered: boolean
  pendingClarifications: MomClarification[]
  clarificationInput: string
  loading: "summarize" | "spec" | null
  clarificationAnswerMap: Map<string, ClarificationAnswer>
  onClarificationInputChange: (value: string) => void
  onClarificationSubmit: (answer?: string) => void
  onClarificationSkip: () => void
  onClarificationEdit: (clar: MomClarification) => void
  onFinalizeMom: () => void
  onReloadClarifications: () => void
}

const formatValue = (value: string) => (value?.trim().length ? value : "Tidak disebutkan")

const severityLabel: Record<MomClarification["severity"], string> = {
  high: "Prioritas tinggi",
  medium: "Prioritas sedang",
  low: "Prioritas rendah",
}

const severityVariant = (level: MomClarification["severity"]) => {
  if (level === "high") return "destructive" as const
  if (level === "medium") return "secondary" as const
  return "outline" as const
}

export function MomReviewPanel({
  momReview,
  summaryReady,
  clarifications,
  clarificationAnswers,
  activeClarification,
  answeredClarifications,
  allClarificationsAnswered,
  pendingClarifications,
  clarificationInput,
  loading,
  clarificationAnswerMap,
  onClarificationInputChange,
  onClarificationSubmit,
  onClarificationSkip,
  onClarificationEdit,
  onFinalizeMom,
  onReloadClarifications,
}: MomReviewPanelProps) {
  const metadataEntries = [
    { label: "Project", value: formatValue(momReview.projectName) },
    { label: "Meeting Title", value: formatValue(momReview.meetingTitle) },
    { label: "Tujuan", value: formatValue(momReview.meetingObjective) },
    { label: "Tanggal", value: formatValue(momReview.meetingDate) },
    { label: "Waktu", value: formatValue(momReview.meetingTime) },
    { label: "Lokasi", value: formatValue(momReview.meetingLocation) },
  ]

  return (
    <div className="space-y-5">
      <Alert>
        <AlertTitle>Konfirmasi data rapat</AlertTitle>
        <AlertDescription>
          Baca hasil ekstraksi AI, lalu jawab pertanyaan klarifikasi satu per satu agar Minutes of Meeting akurat.
        </AlertDescription>
      </Alert>
      {summaryReady ? (
        <Alert>
          <AlertTitle>MoM sebelumnya masih tersimpan</AlertTitle>
          <AlertDescription>
            Hasil Minutes of Meeting lama tidak akan diganti sampai Anda menekan "Buat Minutes of Meeting" setelah klarifikasi selesai.
          </AlertDescription>
        </Alert>
      ) : null}
      
      {activeClarification ? (
        <div className="space-y-4 rounded-lg border border-orange-300/60 bg-orange-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
                Klarifikasi {clarificationAnswers.length + 1} dari {clarifications.length}
              </p>
              <h3 className="text-base font-semibold text-orange-700">Perlu konfirmasi</h3>
            </div>
            <Badge variant={severityVariant(activeClarification.severity)}>
              {severityLabel[activeClarification.severity]}
            </Badge>
          </div>
          <p className="text-sm text-foreground">{activeClarification.prompt}</p>
          {activeClarification.currentValue ? (
            <div className="rounded-md border border-orange-300/60 bg-background px-3 py-2 text-sm whitespace-pre-wrap">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nilai saat ini</p>
              <p className="mt-1 text-foreground">{activeClarification.currentValue}</p>
            </div>
          ) : null}
          {activeClarification.formatHint ? (
            <p className="text-xs text-muted-foreground">Format yang disarankan: {activeClarification.formatHint}</p>
          ) : null}
          {activeClarification.suggestions?.length ? (
            <div className="flex flex-wrap gap-2">
              {activeClarification.suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onClarificationInputChange(suggestion)}
                >
                  Gunakan "{suggestion}"
                </Button>
              ))}
            </div>
          ) : null}
          <Textarea
            value={clarificationInput}
            onChange={(event) => onClarificationInputChange(event.target.value)}
            placeholder="Tulis jawaban Anda..."
            rows={activeClarification.answerType === "text" ? 3 : 5}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => onClarificationSubmit(clarificationInput)}
              disabled={loading !== null}
              className="gap-2"
            >
              {loading === "summarize" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan jawaban
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onClarificationSkip}
              disabled={loading !== null}
            >
              Gunakan data awal
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-orange-300/60 bg-orange-50 px-4 py-5 text-sm text-orange-700">
          Semua pertanyaan klarifikasi sudah dijawab. Klik "Buat Minutes of Meeting" untuk menyusun MoM akhir.
        </div>
      )}
      
      {answeredClarifications.length > 0 ? (
        <div className="space-y-3 rounded-lg border border-orange-300/60 bg-orange-50/50 p-4">
          <h3 className="text-sm font-semibold text-orange-700">Jawaban Anda</h3>
          <div className="grid gap-3">
            {answeredClarifications.map((clar) => {
              const answer = clarificationAnswerMap.get(clar.id)?.answer
              return (
                <div key={clar.id} className="space-y-2 rounded-md border border-orange-200 bg-background px-3 py-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="max-w-3xl">
                      <p className="font-medium text-foreground">{clar.prompt}</p>
                      <p className="text-xs text-muted-foreground">Field: {clar.fieldPath}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onClarificationEdit(clar)}
                    >
                      Ubah jawaban
                    </Button>
                  </div>
                  <div className="whitespace-pre-wrap text-foreground">
                    {answer ? answer : <span className="italic text-muted-foreground">Tetap gunakan nilai awal.</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
      
      <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Data yang ditemukan AI</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {metadataEntries.map((item) => (
            <div key={item.label} className="rounded-md bg-background px-3 py-2 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
              <p className="text-sm font-medium text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Peserta</h4>
            {momReview.attendees.length ? (
              <ul className="grid gap-1 text-sm text-muted-foreground">
                {momReview.attendees.map((person, idx) => (
                  <li key={`${person.name}-${idx}`}>
                    <span className="font-medium text-foreground">{person.name}</span>
                    {person.role ? <span> - {person.role}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Tidak disebutkan.</p>
            )}
          </div>
          
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Pertemuan selanjutnya</h4>
            <div className="rounded-md bg-background px-3 py-2 text-sm text-muted-foreground">
              <p><span className="font-medium text-foreground">Tanggal:</span> {formatValue(momReview.nextMeeting.date)}</p>
              <p><span className="font-medium text-foreground">Agenda:</span> {formatValue(momReview.nextMeeting.agenda)}</p>
              <p><span className="font-medium text-foreground">Outcome:</span> {formatValue(momReview.nextMeeting.expectedOutcome)}</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Topik diskusi</h4>
            {momReview.topics.length ? (
              <div className="grid gap-2 text-sm text-muted-foreground">
                {momReview.topics.map((topic, idx) => (
                  <div key={`${topic.topic}-${idx}`} className="rounded-md border border-border/60 bg-background/60 px-3 py-2">
                    <p className="font-semibold text-foreground">{topic.topic}</p>
                    <p><span className="font-medium text-foreground">Poin:</span> {formatValue(topic.keyPoints)}</p>
                    <p><span className="font-medium text-foreground">Keputusan:</span> {formatValue(topic.decision)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Tidak disebutkan.</p>
            )}
          </div>
          
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Action items</h4>
            {momReview.actionItems.length ? (
              <div className="grid gap-2 text-sm text-muted-foreground">
                {momReview.actionItems.map((item, idx) => (
                  <div key={`${item.action}-${idx}`} className="rounded-md border border-border/60 bg-background/60 px-3 py-2">
                    <p className="font-semibold text-foreground">{item.action}</p>
                    <p><span className="font-medium text-foreground">PIC:</span> {formatValue(item.pic)}</p>
                    <p><span className="font-medium text-foreground">Due:</span> {formatValue(item.dueDate)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Tidak disebutkan.</p>
            )}
          </div>
          
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Risiko & isu</h4>
            {momReview.risks.length ? (
              <div className="grid gap-2 text-sm text-muted-foreground">
                {momReview.risks.map((risk, idx) => (
                  <div key={`${risk.risk}-${idx}`} className="rounded-md border border-border/60 bg-background/60 px-3 py-2">
                    <p className="font-semibold text-foreground">{risk.risk}</p>
                    <p><span className="font-medium text-foreground">Dampak:</span> {formatValue(risk.impact)}</p>
                    <p><span className="font-medium text-foreground">Mitigasi:</span> {formatValue(risk.mitigation)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Tidak disebutkan.</p>
            )}
          </div>
          
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Pertanyaan terbuka</h4>
            {momReview.openIssues.length ? (
              <div className="grid gap-2 text-sm text-muted-foreground">
                {momReview.openIssues.map((issue, idx) => (
                  <div key={`${issue.question}-${idx}`} className="rounded-md border border-border/60 bg-background/60 px-3 py-2">
                    <p className="font-semibold text-foreground">{issue.question}</p>
                    <p><span className="font-medium text-foreground">Owner:</span> {formatValue(issue.owner)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Tidak disebutkan.</p>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={onFinalizeMom}
          disabled={loading !== null || !allClarificationsAnswered}
          className="gap-2"
        >
          {loading === "summarize" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Buat Minutes of Meeting
        </Button>
        <span className="text-sm text-muted-foreground">
          {allClarificationsAnswered
            ? "Siap menyusun MoM akhir."
            : `Selesaikan ${pendingClarifications.length} pertanyaan lagi.`}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReloadClarifications}
          disabled={loading !== null}
        >
          Muat ulang klarifikasi
        </Button>
      </div>
    </div>
  )
}
