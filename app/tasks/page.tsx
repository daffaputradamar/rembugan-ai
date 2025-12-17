"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "sonner"
import { 
  Clock, CheckCircle, XCircle, Loader2, Trash2, RefreshCw, 
  ArrowUpDown, Eye, MoreHorizontal, FileText, CalendarIcon
} from "lucide-react"
import { LayoutShell } from "@/components/layout-shell"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, differenceInDays } from "date-fns"
import type { DateRange } from "react-day-picker"

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

export default function TasksPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)
  
  // Date range filter state
  const [datePreset, setDatePreset] = useState<string>("this-month")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  }))

  // Handle date preset changes
  const handlePresetChange = (preset: string) => {
    setDatePreset(preset)
    const today = new Date()
    
    switch (preset) {
      case "today":
        setDateRange({ from: startOfDay(today), to: endOfDay(today) })
        break
      case "7-days":
        setDateRange({ from: startOfDay(subDays(today, 6)), to: endOfDay(today) })
        break
      case "this-month":
        setDateRange({ from: startOfMonth(today), to: endOfMonth(today) })
        break
      case "custom":
        // Keep current dates
        break
    }
  }

  // Validate date range (max 1 month)
  const validateDateRange = (range: DateRange | undefined) => {
    if (!range?.from || !range?.to) return true
    const diffDays = differenceInDays(range.to, range.from)
    if (diffDays > 31) {
      toast.error("Date range cannot exceed 1 month (31 days)")
      return false
    }
    if (diffDays < 0) {
      toast.error("End date must be after start date")
      return false
    }
    return true
  }

  // Handle date range change
  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (!validateDateRange(range)) {
      return
    }
    setDateRange(range)
    setDatePreset("custom")
  }

  // Load tasks from API with filters
  async function fetchTasks() {
    try {
      setLoading(true)
      
      // Build query params
      const params = new URLSearchParams({ limit: "100" })
      
      if (statusFilter !== "all") {
        params.append("status", statusFilter)
      }
      
      if (dateRange?.from) {
        params.append("startDate", dateRange.from.toISOString())
      }
      
      if (dateRange?.to) {
        params.append("endDate", dateRange.to.toISOString())
      }
      
      const res = await fetch(`/api/tasks?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setTasks(data)
      }
    } catch (error) {
      console.error("Failed to fetch tasks:", error)
      toast.error("Gagal memuat tasks")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) {
      fetchTasks()
    }
  }, [session, statusFilter, dateRange])

  // Poll for task updates
  useEffect(() => {
    const hasPendingTasks = tasks.some(t => t.status === "pending" || t.status === "processing")
    if (!hasPendingTasks) return

    const interval = setInterval(fetchTasks, 3000)
    return () => clearInterval(interval)
  }, [tasks])

  // Delete task
  async function handleDelete(taskId: string) {
    setDeleteTaskId(null)
    setDeleting(taskId)
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" })
      if (res.ok) {
        setTasks(tasks.filter(t => t.id !== taskId))
        toast.success("Task berhasil dihapus")
      } else {
        toast.error("Gagal menghapus task")
      }
    } catch (error) {
      toast.error("Gagal menghapus task")
    } finally {
      setDeleting(null)
    }
  }

  // Filter tasks (already filtered by API, this is just for display)
  const filteredTasks = useMemo(() => {
    return tasks
  }, [tasks])

  // Get status badge
  function getStatusBadge(status: Task["status"]) {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="w-3 h-3" />
            Pending
          </Badge>
        )
      case "processing":
        return (
          <Badge variant="default" className="gap-1 bg-blue-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            Processing
          </Badge>
        )
      case "completed":
        return (
          <Badge variant="default" className="gap-1 bg-green-500">
            <CheckCircle className="w-3 h-3" />
            Completed
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="w-3 h-3" />
            Failed
          </Badge>
        )
    }
  }

  // Define columns for DataTable
  const columns: ColumnDef<Task>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="w-full justify-start -ml-4 font-semibold"
            >
              Task Name
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => {
          const task = row.original
          return (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-medium truncate">{task.name}</span>
                <span className="text-xs text-muted-foreground">
                  {task.templateName || "Default Template"}
                </span>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: "status",
        header: () => <span className="font-semibold">Status</span>,
        cell: ({ row }) => {
          const task = row.original
          return (
            <div className="space-y-1">
              {getStatusBadge(task.status)}
              {task.status === "processing" && task.progressMessage && (
                <p className="text-xs text-blue-500">
                  {task.progressMessage}
                </p>
              )}
              {task.status === "failed" && task.error && (
                <p className="text-xs text-red-500 truncate max-w-[200px]">
                  {task.error}
                </p>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="w-full justify-start -ml-4 font-semibold"
            >
              Created
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => {
          const date = new Date(row.getValue("createdAt"))
          return (
            <span className="text-sm text-muted-foreground">
              {date.toLocaleString("id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          )
        },
      },
      {
        accessorKey: "completedAt",
        header: () => <span className="font-semibold">Completed</span>,
        cell: ({ row }) => {
          const completedAt = row.getValue("completedAt") as string | null
          if (!completedAt) {
            return <span className="text-sm text-muted-foreground">-</span>
          }
          const date = new Date(completedAt)
          return (
            <span className="text-sm text-muted-foreground">
              {date.toLocaleString("id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          )
        },
      },
      {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => {
          const task = row.original

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => router.push(`/tasks/${task.id}`)}
                  className="cursor-pointer"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteTaskId(task.id)}
                  disabled={deleting === task.id}
                  className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  {deleting === task.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Task
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [deleting, router]
  )

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

  // Stats
  const totalTasks = tasks.length
  const pendingTasks = tasks.filter((t) => t.status === "pending").length
  const processingTasks = tasks.filter((t) => t.status === "processing").length
  const completedTasks = tasks.filter((t) => t.status === "completed").length
  const failedTasks = tasks.filter((t) => t.status === "failed").length

  return (
    <LayoutShell
      title="Semua Task"
      description={`${totalTasks} task total`}
      actions={
        <Button variant="outline" size="sm" onClick={fetchTasks}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-foreground">{totalTasks}</p>
                <p className="text-sm font-medium text-muted-foreground mt-1">Total</p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <FileText className="w-5 h-5 text-primary" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-gray-600">{pendingTasks}</p>
                <p className="text-sm font-medium text-muted-foreground mt-1">Pending</p>
              </div>
              <div className="p-3 rounded-full bg-gray-500/10">
                <Clock className="w-5 h-5 text-gray-500" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-blue-600">{processingTasks}</p>
                <p className="text-sm font-medium text-muted-foreground mt-1">Processing</p>
              </div>
              <div className="p-3 rounded-full bg-blue-500/10">
                <Loader2 className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-green-600">{completedTasks}</p>
                <p className="text-sm font-medium text-muted-foreground mt-1">Completed</p>
              </div>
              <div className="p-3 rounded-full bg-green-500/10">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-red-600">{failedTasks}</p>
                <p className="text-sm font-medium text-muted-foreground mt-1">Failed</p>
              </div>
              <div className="p-3 rounded-full bg-red-500/10">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-card border rounded-xl shadow-sm">
          <div className="p-6 border-b">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">All Tasks</h2>
                  <p className="text-sm text-muted-foreground">
                    {filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"} found
                  </p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                {/* Date Preset Select */}
                <Select value={datePreset} onValueChange={handlePresetChange}>
                  <SelectTrigger className="w-40">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="this-month">This Month</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="7-days">Last 7 Days</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>

                {/* Date Range Picker */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-80 justify-start text-left font-normal",
                        !dateRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "dd MMM yyyy")} -{" "}
                            {format(dateRange.to, "dd MMM yyyy")}
                          </>
                        ) : (
                          format(dateRange.from, "dd MMM yyyy")
                        )
                      ) : (
                        "Pick a date range"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={handleDateRangeChange}
                      numberOfMonths={2}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="p-6 pt-4">
            <DataTable
              columns={columns}
              data={filteredTasks}
              searchKey="name"
              searchPlaceholder="Search tasks by name..."
              showPagination={true}
              pageSize={10}
            />
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTaskId} onOpenChange={(open) => !open && setDeleteTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Task</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus task ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteTaskId && handleDelete(deleteTaskId)} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LayoutShell>
  )
}
