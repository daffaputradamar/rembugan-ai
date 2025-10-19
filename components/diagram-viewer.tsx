"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Eye, FileCode2 } from "lucide-react"

export function DiagramViewer({
  label,
  value,
  onChange,
  id,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  id: string
}) {
  const [mode, setMode] = useState<"preview" | "edit">("preview")

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card/60 p-1">
          <Button
            type="button"
            variant={mode === "preview" ? "default" : "ghost"}
            size="sm"
            className="h-7 gap-1.5 rounded px-2 text-xs"
            onClick={() => setMode("preview")}
          >
            <Eye className="h-3 w-3" />
            Preview
          </Button>
          <Button
            type="button"
            variant={mode === "edit" ? "default" : "ghost"}
            size="sm"
            className="h-7 gap-1.5 rounded px-2 text-xs"
            onClick={() => setMode("edit")}
          >
            <FileCode2 className="h-3 w-3" />
            Edit
          </Button>
        </div>
      </div>
      {mode === "edit" ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[200px] font-mono text-xs leading-relaxed"
          placeholder="Diagram ASCII akan ditampilkan di sini..."
        />
      ) : (
        <div className="min-h-[200px] rounded-md border bg-muted/40 p-4 overflow-x-auto">
          {value ? (
            <pre className="font-mono text-xs leading-relaxed whitespace-pre text-foreground">
              {value}
            </pre>
          ) : (
            <p className="text-xs text-muted-foreground">
              Diagram belum tersedia. Klik Edit untuk menambahkan.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
