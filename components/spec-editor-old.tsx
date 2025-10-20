"use client"

import { useState, useId } from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash } from "lucide-react"

// URD Types
export type URDFunctionalRequirement = {
  id: string
  requirement: string
  description: string
  priority: string
}

export type URDNonFunctionalRequirement = {
  id: string
  aspect: string
  requirement: string
}

export type URDUserRole = {
  role: string
  description: string
  accessRights: string
}

export type URDIntegrationPoint = {
  system: string
  direction: string
  data: string
  protocol: string
}

export type URDData = {
  projectName: string
  date: string
  preparedBy: string
  reviewedBy: string
  version: string
  background: string
  objective: string
  inScope: string[]
  outOfScope: string[]
  functionalRequirements: URDFunctionalRequirement[]
  nonFunctionalRequirements: URDNonFunctionalRequirement[]
  userRoles: URDUserRole[]
  businessFlow: string
  integrationPoints: URDIntegrationPoint[]
  acceptanceCriteria: string
}

// A&D Types
export type ANDTechnologyStack = {
  component: string
  technology: string
  description: string
}

export type ANDNonFunctionalDesign = {
  aspect: string
  specification: string
}

export type ANDData = {
  projectName: string
  date: string
  version: string
  preparedBy: string
  objective: string
  asIsProcess: string
  toBeProcess: string
  useCaseDiagram: string
  erdDiagram: string
  systemArchitecture: string
  containerDiagram: string
  technologyStack: ANDTechnologyStack[]
  sequenceDiagram: string
  uiUxMockup: string
  nonFunctionalDesign: ANDNonFunctionalDesign[]
  deploymentArchitecture: string
}

// Test Scenario Types
export type TestReferenceDocument = {
  name: string
  version: string
  date: string
}

export type TestFunctionalScenario = {
  id: string
  description: string
  urdReference: string
  expectedResult: string
  category: string
}

export type TestNonFunctionalScenario = {
  id: string
  description: string
  aspect: string
  expectedResult: string
}

export type TestData = {
  dataType: string
  example: string
  remarks: string
}

export type TestScenarioData = {
  projectName: string
  version: string
  date: string
  preparedBy: string
  objective: string
  referenceDocuments: TestReferenceDocument[]
  inScope: string[]
  outOfScope: string[]
  functionalScenarios: TestFunctionalScenario[]
  nonFunctionalScenarios: TestNonFunctionalScenario[]
  testData: TestData[]
  acceptanceCriteria: string
}

export type SpecData = {
  urd: URDData
  analysisDesign: ANDData
  testScenario: TestScenarioData
}

export const emptySpec: SpecData = {
  productOverview: "",
  objectives: [],
  keyFeatures: [],
  functionalRequirements: [],
  nonFunctionalRequirements: [],
  userStories: [],
  constraintsRisks: [],
  openQuestions: [],
  uiUxRequirements: [],
  layoutDiagram: "",
}

export function specToMarkdown(spec: SpecData, summary?: string) {
  const lines: string[] = []
  if (summary) {
    lines.push("# Summary", "", summary, "")
  }
  lines.push("# Product Specification", "")
  if (spec.productOverview) {
    lines.push("## Product Overview", "", spec.productOverview, "")
  }
  const addList = (title: string, arr: string[]) => {
    if (!arr?.length) return
    lines.push(`## ${title}`, "")
    arr.forEach((i) => lines.push(`- ${i}`))
    lines.push("")
  }
  addList("Objectives", spec.objectives)
  addList("Key Features", spec.keyFeatures)
  addList("Functional Requirements", spec.functionalRequirements)
  addList("Non-functional Requirements", spec.nonFunctionalRequirements)
  addList("User Stories", spec.userStories)
  addList("Constraints / Risks", spec.constraintsRisks)
  addList("Open Questions", spec.openQuestions)
  addList("UI/UX Requirements", spec.uiUxRequirements)
  if (spec.layoutDiagram) {
    lines.push("## Layout Diagram", "", "```", spec.layoutDiagram, "```", "")
  }
  return lines.join("\n")
}

function EditableList({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const id = useId()
  const list = value.length ? value : [""]
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="space-y-2">
        {list.map((item, idx) => (
          <div key={`${id}-${idx}`} className="space-y-2">
            <div className="flex items-center gap-2">
              <Textarea
                id={idx === 0 ? id : undefined}
                value={item}
                placeholder={placeholder}
                onChange={(e) => {
                  const next = [...list]
                  next[idx] = e.target.value
                  onChange(next.filter((s) => s !== "" || idx === list.length - 1))
                }}
                className="min-h-[56px] flex-1"
              />
              <div className="flex flex-col gap-2">
                <Button
                  variant="destructive"
                  className="bg-background text-destructive hover:text-destructive-foreground"
                  size="sm"
                  onClick={() => {
                    const next = [...list]
                    next.splice(idx, 1)
                    onChange(next)
                  }}
                  disabled={list.length <= 1 && !list[0]}
                  aria-label={`Remove ${label} item ${idx + 1}`}
                >
                  <Trash />
                </Button>
              </div>
            </div>
            {idx === list.length - 1 && (
              <Button
                variant="default"
                className="w-[calc(100%-42px)] mx-auto bg-background text-primary hover:text-primary-foreground border border-primary"
                onClick={() => onChange([...list, ""])}
                aria-label={`Add ${label} item`}
              >
                <Plus />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SpecEditor({
  value,
  onChange,
}: {
  value: SpecData
  onChange: (v: SpecData) => void
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="overview">Product Overview</Label>
        <Textarea
          id="overview"
          placeholder="Short overview of the product and its purpose…"
          value={value.productOverview}
          onChange={(e) => onChange({ ...value, productOverview: e.target.value })}
          className="min-h-[100px]"
        />
      </div>
      <EditableList
        label="Objectives"
        value={value.objectives}
        onChange={(arr) => onChange({ ...value, objectives: arr })}
        placeholder="e.g., Reduce support tickets by 20% within 3 months"
      />
      <EditableList
        label="Key Features"
        value={value.keyFeatures}
        onChange={(arr) => onChange({ ...value, keyFeatures: arr })}
        placeholder="e.g., Smart summarization of emails"
      />
      <EditableList
        label="Functional Requirements"
        value={value.functionalRequirements}
        onChange={(arr) => onChange({ ...value, functionalRequirements: arr })}
        placeholder="e.g., The system shall allow users to upload .docx files"
      />
      <EditableList
        label="Non-functional Requirements"
        value={value.nonFunctionalRequirements}
        onChange={(arr) => onChange({ ...value, nonFunctionalRequirements: arr })}
        placeholder="e.g., Responses in under 2 seconds"
      />
      <EditableList
        label="User Stories"
        value={value.userStories}
        onChange={(arr) => onChange({ ...value, userStories: arr })}
        placeholder="e.g., As a PM, I want to generate a spec from notes"
      />
      <EditableList
        label="Constraints / Risks"
        value={value.constraintsRisks}
        onChange={(arr) => onChange({ ...value, constraintsRisks: arr })}
        placeholder="e.g., Limited training data for niche domains"
      />
      <EditableList
        label="Open Questions"
        value={value.openQuestions}
        onChange={(arr) => onChange({ ...value, openQuestions: arr })}
        placeholder="e.g., Which roles will have edit access?"
      />
      <EditableList
        label="UI/UX Requirements"
        value={value.uiUxRequirements}
        onChange={(arr) => onChange({ ...value, uiUxRequirements: arr })}
        placeholder="e.g., Clean two-column layout with responsive design"
      />
      <div className="space-y-2">
        <Label htmlFor="layoutDiagram">Layout Diagram</Label>
        <Textarea
          id="layoutDiagram"
          placeholder="ASCII diagram showing UI layout and element placement..."
          value={value.layoutDiagram}
          onChange={(e) => onChange({ ...value, layoutDiagram: e.target.value })}
          className="min-h-[200px] font-mono text-sm"
        />
      </div>
    </div>
  )
}
