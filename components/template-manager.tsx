"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  FileText,
  Loader2,
  Trash2,
  UploadCloud,
  Eye,
  EyeOff,
  Check,
  FileUp,
  Plus,
  Edit2,
  Globe,
  Building2,
  Users,
  Lock,
  Library,
} from "lucide-react"
import type { CustomTemplate, TemplateVisibility, TemplateType } from "@/types/mom"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

interface TemplateManagerProps {
  selectedTemplate: CustomTemplate | null
  onTemplateSelect: (template: CustomTemplate | null) => void
  disabled?: boolean
  userDivisionIds?: number[]
  userDepartmentIds?: number[]
  userDivisionNames?: string[]
  userDepartmentNames?: string[]
  isAuthenticated?: boolean
}

const visibilityIcons = {
  public: Globe,
  division: Building2,
  department: Users,
  custom: Lock,
}

const visibilityLabels: Record<TemplateVisibility, string> = {
  public: "Publik",
  division: "Divisi",
  department: "Departemen",
  custom: "Kustom",
}

const typeLabels: Record<TemplateType, string> = {
  mom: "Minutes of Meeting",
  urd: "User Requirement Document",
  analysis_design: "Analysis & Design",
  test_scenario: "Test Scenario",
  custom: "Kustom",
}

export function TemplateManager({
  selectedTemplate,
  onTemplateSelect,
  disabled = false,
  userDivisionIds = [],
  userDepartmentIds = [],
  userDivisionNames = [],
  userDepartmentNames = [],
  isAuthenticated = false,
}: TemplateManagerProps) {
  const [templates, setTemplates] = useState<CustomTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showBrowse, setShowBrowse] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state for creating/editing template
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "mom" as TemplateType,
    visibility: "public" as TemplateVisibility,
    divisionId: userDivisionIds[0] || null,
    departmentId: userDepartmentIds[0] || null,
    markdown: "",
    rawText: "",
    fileName: "",
  })

  // Fetch templates on mount
  useEffect(() => {
    fetchTemplates()
  }, [])

  async function fetchTemplates() {
    setLoading(true)
    try {
      const res = await fetch("/api/templates")
      if (res.ok) {
        const data = await res.json()
        setTemplates(data)
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(file: File) {
    if (!file) return

    setUploading(true)
    try {
      const formDataUpload = new FormData()
      formDataUpload.append("file", file)
      formDataUpload.append("convertToTemplate", "true")

      const res = await fetch("/api/upload/template", {
        method: "POST",
        body: formDataUpload,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Upload failed")
      }

      const data = await res.json()

      // Pre-fill form with uploaded data
      setFormData({
        ...formData,
        name: file.name.replace(/\.(pdf|docx?|txt)$/i, ""),
        markdown: data.markdown,
        rawText: data.text,
        fileName: file.name,
      })
      
      setShowCreateDialog(true)
      toast.success("File berhasil diproses", {
        description: "Lengkapi detail template dan simpan.",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengunggah template"
      toast.error("Gagal mengunggah template", { description: message })
    } finally {
      setUploading(false)
    }
  }

  async function handleSaveTemplate() {
    if (!formData.name || !formData.markdown) {
      toast.error("Data tidak lengkap", {
        description: "Nama dan konten template wajib diisi.",
      })
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          type: formData.type,
          markdown: formData.markdown,
          rawText: formData.rawText,
          fileName: formData.fileName,
          visibility: formData.visibility,
          divisionId: formData.visibility === "division" ? formData.divisionId : null,
          departmentId: formData.visibility === "department" ? formData.departmentId : null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save template")
      }

      const newTemplate = await res.json()
      setTemplates([newTemplate, ...templates])
      onTemplateSelect(newTemplate)
      setShowCreateDialog(false)
      resetForm()
      toast.success("Template berhasil disimpan", {
        description: `${formData.name} telah ditambahkan ke koleksi template.`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan template"
      toast.error("Gagal menyimpan template", { description: message })
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteTemplate(templateId: string) {
    try {
      const res = await fetch(`/api/templates/${templateId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        throw new Error("Failed to delete template")
      }

      setTemplates(templates.filter((t) => t.id !== templateId))
      if (selectedTemplate?.id === templateId) {
        onTemplateSelect(null)
      }
      toast.success("Template dihapus")
    } catch (error) {
      toast.error("Gagal menghapus template")
    }
  }

  function resetForm() {
    setFormData({
      name: "",
      description: "",
      type: "mom",
      visibility: "public",
      divisionId: userDivisionIds[0] || null,
      departmentId: userDepartmentIds[0] || null,
      markdown: "",
      rawText: "",
      fileName: "",
    })
  }

  const handleBrowseClick = () => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click()
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled && !uploading) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (disabled || uploading) return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (/\.(pdf|docx?|txt)$/i.test(file.name)) {
        handleUpload(file)
      } else {
        toast.error("Format tidak didukung", {
          description: "Hanya .pdf, .docx, atau .txt yang dapat diunggah.",
        })
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleUpload(files[0])
    }
  }

  const VisibilityIcon = selectedTemplate
    ? visibilityIcons[selectedTemplate.visibility]
    : Globe

  return (
    <Collapsible open={showPreview} onOpenChange={setShowPreview}>
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Template Dokumen
              </CardTitle>
              <CardDescription className="text-sm">
                {isAuthenticated
                  ? "Pilih template tersimpan atau unggah template baru."
                  : "Unggah template untuk format hasil MoM (login untuk menyimpan)."}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {isAuthenticated && (
                <Dialog open={showBrowse} onOpenChange={setShowBrowse}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Library className="h-4 w-4" />
                      Pilih Template
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>Pilih Template</DialogTitle>
                      <DialogDescription>
                        Pilih template dari koleksi yang tersedia.
                      </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[50vh]">
                      {loading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : templates.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          Belum ada template tersimpan.
                        </div>
                      ) : (
                        <div className="space-y-2 pr-4">
                          {templates.map((template) => {
                            const Icon = visibilityIcons[template.visibility]
                            return (
                              <div
                                key={template.id}
                                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                                  selectedTemplate?.id === template.id
                                    ? "border-primary bg-primary/5"
                                    : "hover:bg-muted/50"
                                }`}
                                onClick={() => {
                                  onTemplateSelect(template)
                                  setShowBrowse(false)
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                    <FileText className="h-5 w-5 text-primary" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">{template.name}</p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <Icon className="h-3 w-3" />
                                      <span>{visibilityLabels[template.visibility]}</span>
                                      <span>•</span>
                                      <span>{typeLabels[template.type]}</span>
                                      {template.isOwner && (
                                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                          Milik Anda
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {template.canModify && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteTemplate(template.id)
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              )}
              {selectedTemplate && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    {showPreview ? (
                      <>
                        <EyeOff className="h-4 w-4" />
                        Sembunyikan
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" />
                        Preview
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selected template display */}
          {selectedTemplate ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{selectedTemplate.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <VisibilityIcon className="h-3 w-3" />
                      <span>{visibilityLabels[selectedTemplate.visibility]}</span>
                      {selectedTemplate.fileName && (
                        <>
                          <span>•</span>
                          <span>{selectedTemplate.fileName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    <Check className="h-3 w-3 mr-1" />
                    Aktif
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onTemplateSelect(null)}
                    disabled={disabled}
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <CollapsibleContent className="space-y-2">
                <Label className="text-sm font-medium">Preview Markdown</Label>
                <Textarea
                  readOnly
                  value={selectedTemplate.markdown}
                  className="min-h-[200px] max-h-[400px] overflow-y-auto font-mono text-xs"
                />
              </CollapsibleContent>
            </div>
          ) : (
            /* Upload area */
            <div
              role="button"
              tabIndex={disabled || uploading ? -1 : 0}
              onClick={handleBrowseClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  handleBrowseClick()
                }
              }}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              aria-disabled={disabled || uploading}
              className={`group flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-all ${
                disabled || uploading
                  ? "cursor-not-allowed border-border bg-muted/60 text-muted-foreground"
                  : isDragging
                    ? "border-primary bg-primary/10 text-foreground"
                    : "cursor-pointer border-border bg-muted/20 text-muted-foreground hover:border-primary/50 hover:bg-primary/5"
              }`}
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                <FileUp className={`h-6 w-6 transition ${isDragging ? "text-primary" : "text-primary/70"}`} />
              )}
              <p className="mt-2 text-sm font-medium text-foreground">
                {uploading ? "Memproses template..." : "Unggah template Anda"}
              </p>
              <p className="text-xs text-muted-foreground">
                {uploading ? "Mengkonversi dokumen ke markdown..." : "PDF, DOCX, atau TXT"}
              </p>
            </div>
          )}

          <Input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt"
            disabled={disabled || uploading}
            onChange={handleFileChange}
            className="sr-only"
          />
        </CardContent>
      </Card>

      {/* Create/Edit Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Simpan Template Baru</DialogTitle>
            <DialogDescription>
              Lengkapi detail template dan atur visibilitas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Template *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Template MoM IT Division"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipe Template</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: TemplateType) =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih tipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Deskripsi</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Deskripsi singkat tentang template ini..."
                rows={2}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="visibility">Visibilitas</Label>
                <Select
                  value={formData.visibility}
                  onValueChange={(value: TemplateVisibility) =>
                    setFormData({ ...formData, visibility: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih visibilitas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Publik - Semua orang
                      </div>
                    </SelectItem>
                    <SelectItem value="division" disabled={userDivisionIds.length === 0}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Divisi
                      </div>
                    </SelectItem>
                    <SelectItem value="department" disabled={userDepartmentIds.length === 0}>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Departemen
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.visibility === "division" && userDivisionNames.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="divisionId">Pilih Divisi</Label>
                  <Select
                    value={formData.divisionId?.toString() || ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, divisionId: parseInt(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih divisi" />
                    </SelectTrigger>
                    <SelectContent>
                      {userDivisionIds.map((id, index) => (
                        <SelectItem key={id} value={id.toString()}>
                          {userDivisionNames[index] || `Division ${id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.visibility === "department" && userDepartmentNames.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="departmentId">Pilih Departemen</Label>
                  <Select
                    value={formData.departmentId?.toString() || ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, departmentId: parseInt(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih departemen" />
                    </SelectTrigger>
                    <SelectContent>
                      {userDepartmentIds.map((id, index) => (
                        <SelectItem key={id} value={id.toString()}>
                          {userDepartmentNames[index] || `Department ${id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Preview Markdown</Label>
              <Textarea
                value={formData.markdown}
                onChange={(e) => setFormData({ ...formData, markdown: e.target.value })}
                className="min-h-[200px] font-mono text-xs"
                placeholder="Konten template dalam format Markdown..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false)
                resetForm()
              }}
            >
              Batal
            </Button>
            <Button onClick={handleSaveTemplate} disabled={saving || !formData.name || !formData.markdown}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Simpan Template
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Collapsible>
  )
}
