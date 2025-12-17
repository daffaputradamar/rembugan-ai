"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { Upload, FileText, Send, Clock, CheckCircle, XCircle, Loader2, Plus, Settings, ListTodo, ChevronsUpDown, Globe, Building2, GitBranch, Shield, Mic, RefreshCw, Trash } from "lucide-react"
import { UserBar, BrandingHero } from "@/components/app-header"
import { cn } from "@/lib/utils"

interface Template {
  id: string
  name: string
  description: string | null
  type: string
  isSystem: boolean
  // Accessibility fields (optional depending on API shape)
  visibility?: "public" | "division" | "department" | "custom" | string
  divisionId?: number | null
  departmentId?: number | null
  roleIds?: number[]
  ownerName?: string | null
}

interface Task {
  id: string
  name: string
  status: "pending" | "processing" | "completed" | "failed"
  templateName: string | null
  progress: number
  progressMessage: string | null
  error: string | null
  createdAt: string
  completedAt: string | null
}

interface TranscriptionTask {
  id: string
  fileName: string
  fileSize: number
  status: "pending" | "processing" | "completed" | "failed"
  operationName: string | null
  gcsUri: string | null
  language: string
  result: string | null
  wordCount: number | null
  error: string | null
  userId: string
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  // Form state
  const [taskName, setTaskName] = useState("")
  const [transcript, setTranscript] = useState("")
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)
  const [templateSearchOpen, setTemplateSearchOpen] = useState(false)
  const [templateQuery, setTemplateQuery] = useState("")
  
  // Data state
  const [templates, setTemplates] = useState<Template[]>([])
  const [recentTasks, setRecentTasks] = useState<Task[]>([])
  const [transcriptionTasks, setTranscriptionTasks] = useState<TranscriptionTask[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [loadingTranscriptions, setLoadingTranscriptions] = useState(true)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [transcribingAudio, setTranscribingAudio] = useState(false)
  const [transcribeOperation, setTranscribeOperation] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteConfirmAction, setDeleteConfirmAction] = useState<{ type: 'single' | 'all', taskId?: string } | null>(null)
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [isPollingTranscription, setIsPollingTranscription] = useState(false)

  // Load templates
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch("/api/templates")
        if (res.ok) {
          const data = await res.json()
          setTemplates(data)
          // Auto-select first template
          if (data.length > 0 && !selectedTemplateId) {
            const momTemplate = data.find((t: Template) => t.type === "mom" && t.isSystem)
            setSelectedTemplateId(momTemplate?.id || data[0].id)
          }
        }
      } catch (error) {
        console.error("Failed to fetch templates:", error)
      } finally {
        setLoadingTemplates(false)
      }
    }
    
    if (session?.user) {
      fetchTemplates()
    }
  }, [session])

  // Load recent tasks
  useEffect(() => {
    async function fetchTasks() {
      try {
        const res = await fetch("/api/tasks?limit=5")
        if (res.ok) {
          const data = await res.json()
          setRecentTasks(data)
        }
      } catch (error) {
        console.error("Failed to fetch tasks:", error)
      } finally {
        setLoadingTasks(false)
      }
    }
    
    if (session?.user) {
      fetchTasks()
    }
  }, [session])

  // Load transcription tasks
  useEffect(() => {
    async function fetchTranscriptionTasks() {
      try {
        const res = await fetch("/api/transcription-tasks")
        if (res.ok) {
          const data = await res.json()
          setTranscriptionTasks(data.tasks)
        }
      } catch (error) {
        console.error("Failed to fetch transcription tasks:", error)
      } finally {
        setLoadingTranscriptions(false)
      }
    }
    
    if (session?.user) {
      fetchTranscriptionTasks()
    }
  }, [session])

  // Poll for task updates
  useEffect(() => {
    const hasPendingTasks = recentTasks.some(t => t.status === "pending" || t.status === "processing")
    if (!hasPendingTasks) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/tasks?limit=10")
        if (res.ok) {
          const data = await res.json()
          setRecentTasks(data)
        }
      } catch (error) {
        console.error("Failed to poll tasks:", error)
      }
    }, 3000) // Poll every 3 seconds

    return () => clearInterval(interval)
  }, [recentTasks])
  // Poll for processing transcription tasks
  useEffect(() => {
    const processingTasks = transcriptionTasks.filter(
      t => t.status === "processing" || t.status === "pending"
    )
    if (processingTasks.length === 0) return

    const interval = setInterval(async () => {
      for (const task of processingTasks) {
        await pollTranscriptionTask(task.id)
      }
    }, 5000) // Poll every 5 seconds

    return () => clearInterval(interval)
  }, [transcriptionTasks])
  // Ensure transcript state is always a string
  const normalizeTranscript = (input: unknown) => {
    if (typeof input === "string") return input
    if (Array.isArray(input)) {
      return input
        .filter(Boolean)
        .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
        .join("\n")
    }
    if (input == null) return ""
    if (typeof input === "object") return JSON.stringify(input)
    return String(input)
  }

  // Handle file upload
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingFile(true)
    try {
      // For now, just read text files
      if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        const text = await file.text()
        setTranscript(normalizeTranscript(text))
        toast.success("File uploaded successfully")
      } else {
        // For other files, use the upload API
        const formData = new FormData()
        formData.append("file", file)
        
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })
        
        if (res.ok) {
          const data = await res.json()
          setTranscript(normalizeTranscript(data.text))
          toast.success("File uploaded successfully")
        } else {
          toast.error("Failed to upload file")
        }
      }
    } catch (error) {
      toast.error("Failed to upload file")
    } finally {
      setUploadingFile(false)
      // Reset input
      e.target.value = ""
    }
  }

  // Handle audio file upload and transcription
  async function handleAudioUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (max 100MB with GCS support)
    const maxSize = 100 * 1024 * 1024 // 100MB
    if (file.size > maxSize) {
      toast.error("Audio file too large", {
        description: "Maximum size is 100MB. Please split longer recordings.",
      })
      e.target.value = ""
      return
    }

    // Show info for large files
    const largeFileThreshold = 1 * 1024 * 1024 // 1MB
    if (file.size > largeFileThreshold) {
      toast.info("Large audio file detected", {
        description: "Uploading to cloud storage for transcription. This may take a few moments...",
      })
    }

    setTranscribingAudio(true)
    setTranscribeOperation(null)
    toast.info("Transcribing audio...", {
      description: "This may take a moment depending on the file size.",
    })

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("language", "id-ID") // Default to Indonesian
      
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      })
      
      if (res.ok) {
        const data = await res.json()
        
        if (data.status === "completed") {
          // Sync transcription completed immediately
          setTranscript(normalizeTranscript(data.transcript))
          toast.success("Audio transcribed successfully")
          setTranscribingAudio(false)
          
          // Refresh transcription tasks list
          const tasksRes = await fetch("/api/transcription-tasks")
          if (tasksRes.ok) {
            const tasksData = await tasksRes.json()
            setTranscriptionTasks(tasksData.tasks)
          }
        } else if (data.status === "processing") {
          // Async transcription - task created
          toast.info("Large audio detected — processing asynchronously", {
            description: "Check transcription tasks below to add the result when ready.",
          })
          setTranscribingAudio(false)
          
          // Refresh transcription tasks list
          const tasksRes = await fetch("/api/transcription-tasks")
          if (tasksRes.ok) {
            const tasksData = await tasksRes.json()
            setTranscriptionTasks(tasksData.tasks)
          }
        }
      } else {
        const error = await res.json()
        toast.error("Failed to transcribe audio", {
          description: error.details || error.error || "Please try again",
        })
        setTranscribingAudio(false)
      }
    } catch (error) {
      toast.error("Failed to transcribe audio", {
        description: "Network error. Please try again.",
      })
      setTranscribingAudio(false)
    } finally {
      e.target.value = ""
    }
  }

  // Poll a specific transcription task
  async function pollTranscriptionTask(taskId: string) {
    setIsPollingTranscription(true)
    try {
      const res = await fetch(`/api/transcription-tasks/${taskId}`)
      if (res.ok) {
        const data = await res.json()
        
        // Update the task in the list
        setTranscriptionTasks(prev => 
          prev.map(t => t.id === taskId ? data.task : t)
        )
        
        if (data.task.status === "completed") {
          toast.success("Transcription completed!", {
            description: `${data.task.wordCount?.toLocaleString()} words ready to add`,
          })
        } else if (data.task.status === "failed") {
          toast.error("Transcription failed", {
            description: data.task.error || "Unknown error",
          })
        }
      }
    } catch (error) {
      console.error("Failed to poll transcription task:", error)
    } finally {
      setIsPollingTranscription(false)
    }
  }

  // Add transcription to textarea
  function addTranscriptionToTextarea(result: string) {
    const currentText = transcript.trim()
    if (currentText) {
      setTranscript(currentText + "\n\n" + result)
    } else {
      setTranscript(result)
    }
    toast.success("Transcription added to textarea")
  }

  // Clear all completed and failed transcription tasks
  async function clearAllTranscriptionLogs() {
    setDeleteConfirmOpen(true)
    setDeleteConfirmAction({ type: 'all' })
  }

  // Handle confirmed deletion
  async function handleConfirmDelete() {
    if (!deleteConfirmAction) return

    try {
      if (deleteConfirmAction.type === 'all') {
        const res = await fetch("/api/transcription-tasks/manage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "clear-all" }),
        })

        if (res.ok) {
          const data = await res.json()
          setTranscriptionTasks(prev =>
            prev.filter(t => t.status === "pending" || t.status === "processing")
          )
          toast.success(data.message)
        } else {
          toast.error("Failed to clear logs")
        }
      } else if (deleteConfirmAction.type === 'single' && deleteConfirmAction.taskId) {
        const res = await fetch(`/api/transcription-tasks/${deleteConfirmAction.taskId}`, {
          method: "DELETE",
        })

        if (res.ok) {
          setTranscriptionTasks(prev => prev.filter(t => t.id !== deleteConfirmAction.taskId))
          toast.success("Task deleted successfully")
        } else {
          toast.error("Failed to delete task")
        }
      }
    } catch (error) {
      console.error("Failed to delete transcription task:", error)
      toast.error("Failed to delete task")
    } finally {
      setDeleteConfirmOpen(false)
      setDeleteConfirmAction(null)
    }
  }

  // Delete a single transcription task
  function deleteTranscriptionTask(taskId: string) {
    setDeleteConfirmOpen(true)
    setDeleteConfirmAction({ type: 'single', taskId })
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  // Submit task
  async function handleSubmit() {
    if (!taskName.trim()) {
      toast.error("Task name is required")
      return
    }
    if (!transcript.trim()) {
      toast.error("Transcript is required")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: taskName,
          transcript: transcript.trim(),
          templateId: selectedTemplateId || null,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create task")
      }

      const data = await res.json()
      toast.success("Task created successfully", {
        description: "Document will be processed in the background",
      })

      // Clear form
      setTaskName("")
      setTranscript("")
      
      // Refresh tasks
      const tasksRes = await fetch("/api/tasks?limit=10")
      if (tasksRes.ok) {
        setRecentTasks(await tasksRes.json())
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create task")
    } finally {
      setSubmitting(false)
    }
  }

  // Get status badge
  function getStatusBadge(status: Task["status"]) {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
      case "processing":
        return <Badge variant="default"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>
      case "completed":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>
    }
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">RembuganAI</h1>
        <p className="text-muted-foreground">Please login to continue</p>
        <Button onClick={() => router.push("/api/auth/signin")}>Login</Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="container max-w-7xl mx-auto px-4 py-6">
        <UserBar />
        <BrandingHero />
        
        <div className="grid gap-8 lg:grid-cols-2 mt-8">
          {/* Left Column - Input Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Create New Document
              </CardTitle>
              <CardDescription>
                Upload meeting transcript and select a template to generate a document
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Task Name */}
              <div className="space-y-2">
                <Label htmlFor="taskName">Task Name</Label>
                <Input
                  id="taskName"
                  placeholder="Sprint Planning Meeting..."
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  required
                />
              </div>

              {/* Template Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Template</Label>
                  <Button variant="outline" size="sm" onClick={() => router.push("/templates")}>
                    <Settings className="w-4 h-4 mr-1" />
                    Manage Templates
                  </Button>
                </div>
                <Popover open={templateSearchOpen} onOpenChange={setTemplateSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between bg-card"
                    >
                      {templates.find(t => t.id === selectedTemplateId)?.name || (loadingTemplates ? "Loading..." : "Select template")}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search templates..." />
                      <CommandList>
                        <CommandEmpty>No templates found.</CommandEmpty>
                        {templates.map((template) => (
                          <CommandItem
                            key={template.id}
                            value={template.name}
                            onSelect={() => {
                              setSelectedTemplateId(template.id)
                              setTemplateSearchOpen(false)
                            }}
                            className="rounded-none"
                          >
                            <div className="w-full">
                              <div className="flex items-center justify-between gap-2">
                                <span className={cn("truncate", template.id === selectedTemplateId && "font-semibold")}>{template.name}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                  {/* Accessibility badge */}
                                  {template.visibility === "public" && (
                                    <Badge variant="outline" className="text-xs gap-1"><Globe className="h-3 w-3" />Public</Badge>
                                  )}
                                  {template.visibility === "division" && (
                                    <Badge variant="outline" className="text-xs gap-1"><Building2 className="h-3 w-3" />Division</Badge>
                                  )}
                                  {template.visibility === "department" && (
                                    <Badge variant="outline" className="text-xs gap-1"><GitBranch className="h-3 w-3" />Department</Badge>
                                  )}
                                  {template.visibility === "custom" && (
                                    <Badge variant="outline" className="text-xs gap-1"><Shield className="h-3 w-3" />Custom</Badge>
                                  )}
                                  {template.isSystem && (
                                    <Badge variant="outline" className="text-xs">System</Badge>
                                  )}
                                </div>
                              </div>
                              {template.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.description}</p>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Transcript Input */}
              <div className="space-y-2">
                <Label>Meeting Transcript</Label>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" asChild disabled={uploadingFile || transcribingAudio}>
                    <label className="cursor-pointer">
                      {uploadingFile ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-1" />
                      )}
                      {uploadingFile ? "Uploading..." : "Upload File"}
                      <input
                        type="file"
                        accept=".txt,.docx,.pdf"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={uploadingFile || transcribingAudio}
                      />
                    </label>
                  </Button>
                  <Button variant="outline" size="sm" asChild disabled={uploadingFile || transcribingAudio}>
                    <label className="cursor-pointer">
                      {transcribingAudio ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Mic className="w-4 h-4 mr-1" />
                      )}
                      {transcribingAudio ? "Transcribing..." : "Upload Audio"}
                      <input
                        type="file"
                        accept=".wav,.mp3,.flac,.ogg,.webm,.m4a"
                        className="hidden"
                        onChange={handleAudioUpload}
                        disabled={uploadingFile || transcribingAudio}
                      />
                    </label>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Supports: .txt, .docx, .pdf for text files | .wav, .mp3, .m4a, .ogg, .webm for audio (max 100MB)
                </p>
                {transcribingAudio && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>
                      {transcribeOperation
                        ? "Processing large audio asynchronously..."
                        : "Transcribing audio..."}
                    </span>
                  </div>
                )}
                <Textarea
                  placeholder="Copy and Paste your meeting transcript here or upload a file..."
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  rows={12}
                  className="font-mono text-sm max-h-96"
                />
                <p className="text-xs text-muted-foreground">
                  {transcript.length.toLocaleString()} characters
                </p>
              </div>

              {/* Submit Button */}
              <Button 
                className="w-full" 
                size="lg"
                disabled={!transcript.trim() || submitting}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Generate Document
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Right Column - Recent Tasks */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ListTodo className="w-5 h-5" />
                    Recent Tasks
                  </CardTitle>
                  <CardDescription>
                    Documents being processed and completed
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push("/tasks")}>
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingTasks ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : recentTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ListTodo className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No tasks yet</p>
                  <p className="text-sm">Create your first document!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/tasks/${task.id}`)}
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{task.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{task.templateName || "Default"}</span>
                          <span>•</span>
                          <span>{new Date(task.createdAt).toLocaleString("id-ID")}</span>
                        </div>
                        {task.status === "processing" && task.progressMessage && (
                          <p className="text-xs text-blue-500">{task.progressMessage}</p>
                        )}
                        {task.status === "failed" && task.error && (
                          <p className="text-xs text-red-500 truncate max-w-[200px]">{task.error}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(task.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transcription Tasks */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Mic className="w-5 h-5" />
                    Audio Transcriptions
                  </CardTitle>
                  <CardDescription>
                    Audio files being processed
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllTranscriptionLogs}
                  disabled={!transcriptionTasks.some(t => t.status === "completed" || t.status === "failed")}
                >
                  <Trash className="w-4 h-4 mr-2" />
                  Clear Logs
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingTranscriptions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : transcriptionTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mic className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No audio transcriptions yet</p>
                  <p className="text-sm">Upload an audio file to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transcriptionTasks.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      className="p-3 border rounded-lg space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <p className="font-medium truncate">{task.fileName}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{(task.fileSize / 1024).toFixed(0)} KB</span>
                            <span>•</span>
                            <span>{new Date(task.createdAt).toLocaleString("id-ID")}</span>
                          </div>
                          {task.wordCount && (
                            <p className="text-xs text-muted-foreground">
                              {task.wordCount.toLocaleString()} words
                            </p>
                          )}
                          {task.error && (
                            <p className="text-xs text-red-500">{task.error}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-col">
                          {task.status === "pending" && (
                            <Badge variant="outline" className="gap-1">
                              <Clock className="w-3 h-3" />
                              Pending
                            </Badge>
                          )}
                          {task.status === "processing" && (
                            <Badge variant="outline" className="gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Processing
                            </Badge>
                          )}
                          {task.status === "completed" && (
                            <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                              <CheckCircle className="w-3 h-3" />
                              Ready
                            </Badge>
                          )}
                          {task.status === "failed" && (
                            <Badge variant="outline" className="gap-1 text-red-600 border-red-600">
                              <XCircle className="w-3 h-3" />
                              Failed
                            </Badge>
                          )}
                          {(task.status === "completed" || task.status === "failed") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              onClick={() => deleteTranscriptionTask(task.id)}
                            >
                              <XCircle className="w-3 h-3 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {task.status === "completed" && task.result && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => addTranscriptionToTextarea(task.result!)}
                        >
                          <Plus className="w-3 h-3 mr-2" />
                          Add to Transcript
                        </Button>
                      )}
                      
                      {task.status === "processing" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => pollTranscriptionTask(task.id)}
                        >
                          <RefreshCw className={`w-3 h-3 mr-2 ${isPollingTranscription ? "animate-spin" : ""}`} />
                          Check Status
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {deleteConfirmAction?.type === 'all' ? 'Clear All Logs?' : 'Delete Task?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deleteConfirmAction?.type === 'all'
                  ? 'Are you sure you want to delete all completed and failed transcription tasks? This cannot be undone.'
                  : 'Are you sure you want to delete this transcription task? This cannot be undone.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3 justify-end">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
