"use client"

import { useState, useEffect, use } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { 
  Clock, CheckCircle, XCircle, Loader2, 
  Download, Copy, RefreshCw, FileText, Trash2, ChevronDown,
  Pencil, Sparkles
} from "lucide-react"
import { LayoutShell } from "@/components/layout-shell"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import MDEditor from "@uiw/react-md-editor"
import "@uiw/react-md-editor/markdown-editor.css"
import "@uiw/react-markdown-preview/markdown.css"

interface TaskDetail {
  id: string
  name: string
  status: "pending" | "processing" | "completed" | "failed"
  transcript: string
  templateId: string | null
  templateName: string | null
  templateMarkdown: string | null
  result: string | null
  error: string | null
  progress: number
  progressMessage: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isEditingMarkdown, setIsEditingMarkdown] = useState(false)
  const [editedMarkdown, setEditedMarkdown] = useState<string | null>(null)
  const [aiPrompt, setAiPrompt] = useState("")
  const [isAiProcessing, setIsAiProcessing] = useState(false)

  // Fetch task details
  async function fetchTask() {
    try {
      const res = await fetch(`/api/tasks/${id}`)
      if (res.ok) {
        const data = await res.json()
        setTask(data)
      } else if (res.status === 404) {
        toast.error("Task tidak ditemukan")
        router.push("/tasks")
      }
    } catch (error) {
      console.error("Failed to fetch task:", error)
      toast.error("Gagal memuat task")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) {
      fetchTask()
    }
  }, [session, id])

  // Initialize edited markdown when task loads
  useEffect(() => {
    if (task?.result && !isEditingMarkdown) {
      setEditedMarkdown(task.result)
    }
  }, [task?.result, isEditingMarkdown])

  // Poll for updates if task is pending/processing
  useEffect(() => {
    if (!task || (task.status !== "pending" && task.status !== "processing")) return

    const interval = setInterval(fetchTask, 2000)
    return () => clearInterval(interval)
  }, [task?.status])

  // Delete task
  async function handleDelete() {
    setShowDeleteDialog(false)
    setDeleting(true)
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("Task berhasil dihapus")
        router.push("/tasks")
      } else {
        toast.error("Gagal menghapus task")
      }
    } catch (error) {
      toast.error("Gagal menghapus task")
    } finally {
      setDeleting(false)
    }
  }

  // Save edited markdown
  async function saveMarkdown() {
    if (!editedMarkdown || !task) return

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: editedMarkdown }),
      })

      if (res.ok) {
        const updated = await res.json()
        setTask(updated)
        setIsEditingMarkdown(false)
        toast.success("Document saved successfully")
      } else {
        toast.error("Failed to save document")
      }
    } catch (error) {
      toast.error("Failed to save document")
    }
  }

  // AI Edit function
  async function handleAiEdit() {
    if (!aiPrompt.trim() || !task?.result) {
      toast.error("Please enter a prompt")
      return
    }

    setIsAiProcessing(true)
    try {
      const res = await fetch(`/api/tasks/${id}/ai-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          currentContent: task.result,
          prompt: aiPrompt.trim()
        }),
      })

      if (res.ok) {
        const { result } = await res.json()
        const updated = await fetch(`/api/tasks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ result }),
        })
        
        if (updated.ok) {
          const updatedTask = await updated.json()
          setTask(updatedTask)
          setAiPrompt("")
          toast.success("Document updated with AI")
        }
      } else {
        const error = await res.json()
        toast.error(error.error || "Failed to process AI edit")
      }
    } catch (error) {
      toast.error("Failed to process AI edit")
    } finally {
      setIsAiProcessing(false)
    }
  }

  // Copy to clipboard
  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast.success("Berhasil disalin")
  }

  // Download as file
  function downloadAsFile(content: string, filename: string) {
    const blob = new Blob([content], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // Export as different formats
  async function handleExport(format: "markdown" | "docx" | "pdf") {
    if (!task?.result) return

    try {
      if (format === "markdown") {
        downloadAsFile(task.result, `${task.name}.md`)
      } else {
        // Call API endpoint for docx/pdf export
        const res = await fetch(`/api/tasks/${task.id}/export?format=${format}`)
        if (res.ok) {
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = format === "docx" ? `${task.name}.docx` : `${task.name}.pdf`
          a.click()
          URL.revokeObjectURL(url)
          toast.success(`Dokumen berhasil diunduh sebagai ${format.toUpperCase()}`)
        } else {
          toast.error(`Gagal mengunduh sebagai ${format.toUpperCase()}`)
        }
      }
    } catch (error) {
      toast.error("Gagal mengunduh dokumen")
    }
  }

  // Get status badge
  function getStatusBadge(status: TaskDetail["status"]) {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="text-lg px-3 py-1"><Clock className="w-4 h-4 mr-1" />Pending</Badge>
      case "processing":
        return <Badge variant="default" className="text-lg px-3 py-1"><Loader2 className="w-4 h-4 mr-1 animate-spin" />Processing</Badge>
      case "completed":
        return <Badge variant="default" className="text-lg px-3 py-1 bg-green-500"><CheckCircle className="w-4 h-4 mr-1" />Completed</Badge>
      case "failed":
        return <Badge variant="destructive" className="text-lg px-3 py-1"><XCircle className="w-4 h-4 mr-1" />Failed</Badge>
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  if (!session?.user) {
    router.push("/")
    return null
  }

  if (!task) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Task tidak ditemukan</p>
      </div>
    )
  }

  return (
    <LayoutShell
      title={task.name}
      description={task.templateName || "Default Template"}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchTask}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)} disabled={deleting}>
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Hapus
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Status & Progress */}
        <div className="flex items-center gap-3">
          {getStatusBadge(task.status)}
          {task.status === "processing" && task.progressMessage && (
            <span className="text-blue-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {task.progressMessage} ({task.progress}%)
            </span>
          )}
        </div>

        {/* Task Info */}
        <Card>
          <CardContent className="py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Dibuat</p>
                <p className="font-medium">{new Date(task.createdAt).toLocaleString("id-ID")}</p>
              </div>
              {task.startedAt && (
                <div>
                  <p className="text-muted-foreground">Mulai Diproses</p>
                  <p className="font-medium">{new Date(task.startedAt).toLocaleString("id-ID")}</p>
                </div>
              )}
              {task.completedAt && (
                <div>
                  <p className="text-muted-foreground">Selesai</p>
                  <p className="font-medium">{new Date(task.completedAt).toLocaleString("id-ID")}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Panjang Transkrip</p>
                <p className="font-medium">{task.transcript.length.toLocaleString()} karakter</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {task.status === "failed" && task.error && (
          <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
            <CardHeader>
              <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                Error
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-600 dark:text-red-400">{task.error}</p>
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {task.status === "completed" && task.result && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Generated Document
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyToClipboard(task.result!)}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Download
                        <ChevronDown className="w-4 h-4 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleExport("markdown")}>
                        Download as Markdown (.md)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport("docx")}>
                        Download as Word (.docx)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport("pdf")}>
                        Download as PDF (.pdf)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="preview">
                <TabsList>
                  <TabsTrigger value="preview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary p-4">Preview</TabsTrigger>
                  <TabsTrigger value="markdown" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary p-4">Editor</TabsTrigger>
                  <TabsTrigger value="ai-edit" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary p-4">AI Edit</TabsTrigger>
                </TabsList>
                <TabsContent value="preview" className="mt-4">
                  <div className="rounded-md border bg-muted/40 p-4 overflow-auto">
                    <div className="markdown-preview prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {isEditingMarkdown ? editedMarkdown || task.result : task.result}
                      </ReactMarkdown>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="markdown" className="mt-4 space-y-3">
                  {isEditingMarkdown ? (
                    <>
                      <div data-color-mode="light" className="rounded-lg border overflow-hidden">
                        <MDEditor
                          value={editedMarkdown || ""}
                          onChange={(val) => setEditedMarkdown(val || "")}
                          preview="live"
                          height={900}
                          textareaProps={{
                            placeholder: "Edit your markdown here...",
                          }}
                          hideToolbar={false}
                          visibleDragbar={true}
                          className="border-0!"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsEditingMarkdown(false)
                            setEditedMarkdown(task.result)
                          }}
                        >
                          Batal
                        </Button>
                        <Button
                          onClick={saveMarkdown}
                        >
                          Simpan
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={() => setIsEditingMarkdown(true)}
                        size="sm"
                        variant={'outline'}
                      >
                        <Pencil/> Edit Markdown
                      </Button>
                      <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm font-mono whitespace-pre-wrap">
                        {task.result}
                      </pre>
                    </>
                  )}
                </TabsContent>
                <TabsContent value="ai-edit" className="mt-4 space-y-3">
                  <div className="space-y-3 border-">
                    <div className="rounded-md border p-4">
                      <p className="text-sm text-muted-foreground mb-3">
                        Describe what you'd like to change or update in the document. The AI will modify the content based on your instructions.
                      </p>
                      <Textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Example: Make the tone more formal, add a conclusion section, summarize the key points..."
                        rows={4}
                        className="mb-3 bg-background border rounded-md shadow-sm"
                      />
                      <Button
                        onClick={handleAiEdit}
                        disabled={isAiProcessing || !aiPrompt.trim()}
                        className="w-full"
                      >
                        {isAiProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Apply AI Edit
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="rounded-md border bg-muted/40 p-4 overflow-auto max-h-96">
                      <div className="markdown-preview prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {task.result}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Pending/Processing State */}
        {(task.status === "pending" || task.status === "processing") && (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-blue-500" />
              <h3 className="text-lg font-medium mb-2">
                {task.status === "pending" ? "Menunggu Diproses" : "Sedang Diproses"}
              </h3>
              {task.progressMessage && (
                <p className="text-muted-foreground">{task.progressMessage}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Transcript (Collapsible) */}
        <Card>
          <CardHeader>
            <CardTitle>Transkrip Asli</CardTitle>
            <CardDescription>
              Transkrip rapat yang digunakan untuk generate dokumen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <details>
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                Klik untuk melihat transkrip ({task.transcript.length.toLocaleString()} karakter)
              </summary>
              <pre className="mt-4 bg-muted p-4 rounded-lg overflow-auto text-sm font-mono whitespace-pre-wrap max-h-96">
                {task.transcript}
              </pre>
            </details>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Task</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus task ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LayoutShell>
  )
}
