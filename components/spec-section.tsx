"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import SpecEditor, { type SpecData } from "@/components/spec-editor"
import { ExportActions } from "@/components/export-actions"
import { specToMarkdown } from "@/lib/spec-markdown"
import { ArrowLeft, LoaderCircle, NotebookPen, RotateCcw } from "lucide-react"

interface SpecSectionProps {
  spec: SpecData
  setSpec: (spec: SpecData) => void
  summary: string
  projectName: string
  setProjectName: (name: string) => void
  loading: "summarize" | "spec" | null
  downloading: "docx" | "pdf" | null
  syncingOutline: boolean
  specHasContent: boolean
  onDownload: (type: "docx" | "pdf") => void
  onGenerateSpec: () => void
  onMigrateToOutline: () => void
  onReset: () => void
  onGoToSummary: () => void
}

export function SpecSection({
  spec,
  setSpec,
  summary,
  projectName,
  setProjectName,
  loading,
  downloading,
  syncingOutline,
  specHasContent,
  onDownload,
  onGenerateSpec,
  onMigrateToOutline,
  onReset,
  onGoToSummary,
}: SpecSectionProps) {
  const markdown = specToMarkdown(spec, summary)

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button className="gap-2" variant="ghost" onClick={onGoToSummary}>
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Minutes of Meeting
        </Button>
        <Button
          variant="outline"
          onClick={onReset}
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
          <SpecInstructions />

          {process.env.NEXT_PUBLIC_OUTLINE_BASE_URL && (
            <OutlineIntegration
              projectName={projectName}
              setProjectName={setProjectName}
              syncingOutline={syncingOutline}
              loading={loading}
              downloading={downloading}
              specHasContent={specHasContent}
              summary={summary}
              onMigrateToOutline={onMigrateToOutline}
            />
          )}

          <SpecEditor value={spec} onChange={setSpec} />

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={onGenerateSpec} disabled={loading !== null}>
              {loading === "spec" ? "Memperbarui…" : "Generate Ulang"}
            </Button>
            <div className="flex-1" />
            <ExportActions
              markdown={markdown}
              downloading={downloading}
              onDownload={onDownload}
              disabled={loading !== null || syncingOutline}
              copyToastMessage="Spesifikasi disalin dalam format Markdown"
            />
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function SpecInstructions() {
  return (
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
  )
}

interface OutlineIntegrationProps {
  projectName: string
  setProjectName: (name: string) => void
  syncingOutline: boolean
  loading: "summarize" | "spec" | null
  downloading: "docx" | "pdf" | null
  specHasContent: boolean
  summary: string
  onMigrateToOutline: () => void
}

function OutlineIntegration({
  projectName,
  setProjectName,
  syncingOutline,
  loading,
  downloading,
  specHasContent,
  summary,
  onMigrateToOutline,
}: OutlineIntegrationProps) {
  return (
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
        onClick={onMigrateToOutline}
        size="lg"
        className="gap-2 md:justify-self-end"
        disabled={
          syncingOutline ||
          loading !== null ||
          !!downloading ||
          (!specHasContent && !summary.trim()) ||
          !projectName.trim()
        }
      >
        {syncingOutline ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <NotebookPen className="h-4 w-4" />
        )}
        Migrasi ke Outline
      </Button>
    </div>
  )
}
