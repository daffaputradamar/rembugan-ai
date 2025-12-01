"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MarkdownField } from "@/components/markdown-field"
import { MomReviewPanel } from "@/components/mom-review-panel"
import { ExportActions } from "@/components/export-actions"
import { ArrowLeft, ArrowRight, LoaderCircle, Sparkles } from "lucide-react"
import type { UseMomWorkflowReturn } from "@/hooks/use-mom-workflow"

interface MomSectionProps {
  momWorkflow: UseMomWorkflowReturn
  loading: "summarize" | "spec" | null
  downloadingMom: "docx" | "pdf" | null
  specHasContent: boolean
  onDownloadMom: (type: "docx" | "pdf") => void
  onGenerateSpec: () => void
  onGoToInput: () => void
  onGoToSpec: () => void
}

export function MomSection({
  momWorkflow,
  loading,
  downloadingMom,
  specHasContent,
  onDownloadMom,
  onGenerateSpec,
  onGoToInput,
  onGoToSpec,
}: MomSectionProps) {
  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button className="gap-2" variant="ghost" onClick={onGoToInput}>
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Unggah Transkrip
        </Button>
        <Button variant="ghost" onClick={onGoToSpec} disabled={!specHasContent}>
          <ArrowRight className="h-4 w-4" />
          Lihat Spesifikasi
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
              <div className="text-sm text-muted-foreground">
                Sunting konten Minutes of Meeting di bawah ini.
              </div>
              <MarkdownField
                label="Minutes of Meeting"
                value={momWorkflow.summary}
                onChange={momWorkflow.setSummary}
                placeholder="Minutes of Meeting akan muncul di sini setelah proses AI selesai."
                minHeight="200px"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  onClick={onGenerateSpec}
                  disabled={loading !== null || !momWorkflow.summaryReady}
                >
                  {loading === "spec" ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {loading === "spec" ? "Menyusun…" : "Generate Spesifikasi"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => momWorkflow.startMomWorkflow()}
                  disabled={loading !== null}
                >
                  {loading === "summarize" ? "Menyiapkan review…" : "Perbarui Minutes of Meeting"}
                </Button>
              </div>
              <div className="flex justify-end">
                <ExportActions
                    markdown={momWorkflow.summary}
                    downloading={downloadingMom}
                    onDownload={onDownloadMom}
                    copyToastMessage="Minutes of Meeting disalin ke clipboard"
                />
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
  )
}
