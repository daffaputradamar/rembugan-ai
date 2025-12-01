"use client"

import { LoaderCircle } from "lucide-react"

interface LoadingOverlayProps {
  uploading?: boolean
  downloading?: "docx" | "pdf" | null
  downloadingMom?: "docx" | "pdf" | null
  syncingOutline?: boolean
  loading?: "summarize" | "spec" | null
  generatingStep?: "urd" | "analysisDesign" | "testScenario" | null
}

export function LoadingOverlay({
  uploading,
  downloading,
  downloadingMom,
  syncingOutline,
  loading,
  generatingStep,
}: LoadingOverlayProps) {
  const isLoading = loading !== null || uploading || downloading !== null || downloadingMom !== null || syncingOutline

  if (!isLoading) return null

  return (
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
                  : downloadingMom === "docx"
                    ? "Menyiapkan Minutes of Meeting (DOCX)"
                    : downloadingMom === "pdf"
                      ? "Menyiapkan Minutes of Meeting (PDF)"
                      : syncingOutline
                        ? "Mengirim dokumen ke Outline"
                        : loading === "summarize"
                          ? "AI sedang merangkum"
                          : generatingStep === "urd"
                            ? "Membuat User Requirement Document (1/3)"
                            : generatingStep === "analysisDesign"
                              ? "Membuat Analysis & Design Document (2/3)"
                              : generatingStep === "testScenario"
                                ? "Membuat Test Scenario Document (3/3)"
                                : "AI sedang menyusun spesifikasi"}
          </p>
          <p className="text-xs text-muted-foreground">
            {generatingStep
              ? "Dokumen yang selesai akan langsung ditampilkan."
              : "Mohon tunggu, RembuganAI sedang bekerja."}
          </p>
        </div>
      </div>
    </div>
  )
}
