"use client"

import { useState, useId } from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash } from "lucide-react"
import { DiagramViewer } from "@/components/diagram-viewer"
import { MarkdownField } from "@/components/markdown-field"

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
  urd: {
    projectName: "",
    date: "",
    preparedBy: "",
    reviewedBy: "",
    version: "",
    background: "",
    objective: "",
    inScope: [],
    outOfScope: [],
    functionalRequirements: [],
    nonFunctionalRequirements: [],
    userRoles: [],
    businessFlow: "",
    integrationPoints: [],
    acceptanceCriteria: "",
  },
  analysisDesign: {
    projectName: "",
    date: "",
    version: "",
    preparedBy: "",
    objective: "",
    asIsProcess: "",
    toBeProcess: "",
    useCaseDiagram: "",
    erdDiagram: "",
    systemArchitecture: "",
    containerDiagram: "",
    technologyStack: [],
    sequenceDiagram: "",
    uiUxMockup: "",
    nonFunctionalDesign: [],
    deploymentArchitecture: "",
  },
  testScenario: {
    projectName: "",
    version: "",
    date: "",
    preparedBy: "",
    objective: "",
    referenceDocuments: [],
    inScope: [],
    outOfScope: [],
    functionalScenarios: [],
    nonFunctionalScenarios: [],
    testData: [],
    acceptanceCriteria: "",
  },
}

// Re-export markdown functions from lib/spec-markdown.ts
// These can be used on both client and server
export {
  urdToMarkdown,
  analysisDesignToMarkdown,
  testScenarioToMarkdown,
  specToMarkdown,
} from "@/lib/spec-markdown"

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
  const [activeTab, setActiveTab] = useState<"urd" | "and" | "test">("urd")

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "urd" | "and" | "test")}>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="urd">URD</TabsTrigger>
        <TabsTrigger value="and">Analysis & Design</TabsTrigger>
        <TabsTrigger value="test">Test Scenario</TabsTrigger>
      </TabsList>

      {/* URD Tab */}
      <TabsContent value="urd" className="space-y-4 mt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Project Name</Label>
            <Input
              value={value.urd.projectName}
              onChange={(e) => onChange({ ...value, urd: { ...value.urd, projectName: e.target.value } })}
              placeholder="Enter project name"
            />
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              value={value.urd.date}
              onChange={(e) => onChange({ ...value, urd: { ...value.urd, date: e.target.value } })}
              placeholder="YYYY-MM-DD"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Prepared By</Label>
            <Input
              value={value.urd.preparedBy}
              onChange={(e) => onChange({ ...value, urd: { ...value.urd, preparedBy: e.target.value } })}
              placeholder="Name"
            />
          </div>
          <div className="space-y-2">
            <Label>Reviewed By</Label>
            <Input
              value={value.urd.reviewedBy}
              onChange={(e) => onChange({ ...value, urd: { ...value.urd, reviewedBy: e.target.value } })}
              placeholder="Name"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Version</Label>
          <Input
            value={value.urd.version}
            onChange={(e) => onChange({ ...value, urd: { ...value.urd, version: e.target.value } })}
            placeholder="1.0"
          />
        </div>

        <MarkdownField
          label="Background"
          value={value.urd.background}
          onChange={(val) => onChange({ ...value, urd: { ...value.urd, background: val } })}
          placeholder="Project background..."
          minHeight="100px"
        />

        <MarkdownField
          label="Objective"
          value={value.urd.objective}
          onChange={(val) => onChange({ ...value, urd: { ...value.urd, objective: val } })}
          placeholder="Project objectives..."
          minHeight="100px"
        />

        <EditableList
          label="In Scope"
          value={value.urd.inScope}
          onChange={(arr) => onChange({ ...value, urd: { ...value.urd, inScope: arr } })}
          placeholder="e.g., User authentication"
        />

        <EditableList
          label="Out of Scope"
          value={value.urd.outOfScope}
          onChange={(arr) => onChange({ ...value, urd: { ...value.urd, outOfScope: arr } })}
          placeholder="e.g., Payment processing"
        />

        <MarkdownField
          label="Business Flow"
          value={value.urd.businessFlow}
          onChange={(val) => onChange({ ...value, urd: { ...value.urd, businessFlow: val } })}
          placeholder="Describe the business flow..."
          minHeight="100px"
        />

        <MarkdownField
          label="Acceptance Criteria"
          value={value.urd.acceptanceCriteria}
          onChange={(val) => onChange({ ...value, urd: { ...value.urd, acceptanceCriteria: val } })}
          placeholder="Define acceptance criteria..."
          minHeight="100px"
        />
      </TabsContent>

      {/* Analysis & Design Tab */}
      <TabsContent value="and" className="space-y-4 mt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Project Name</Label>
            <Input
              value={value.analysisDesign.projectName}
              onChange={(e) => onChange({ ...value, analysisDesign: { ...value.analysisDesign, projectName: e.target.value } })}
              placeholder="Enter project name"
            />
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              value={value.analysisDesign.date}
              onChange={(e) => onChange({ ...value, analysisDesign: { ...value.analysisDesign, date: e.target.value } })}
              placeholder="YYYY-MM-DD"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Version</Label>
            <Input
              value={value.analysisDesign.version}
              onChange={(e) => onChange({ ...value, analysisDesign: { ...value.analysisDesign, version: e.target.value } })}
              placeholder="1.0"
            />
          </div>
          <div className="space-y-2">
            <Label>Prepared By</Label>
            <Input
              value={value.analysisDesign.preparedBy}
              onChange={(e) => onChange({ ...value, analysisDesign: { ...value.analysisDesign, preparedBy: e.target.value } })}
              placeholder="Name"
            />
          </div>
        </div>

        <MarkdownField
          label="Objective"
          value={value.analysisDesign.objective}
          onChange={(val) => onChange({ ...value, analysisDesign: { ...value.analysisDesign, objective: val } })}
          placeholder="Design objectives..."
          minHeight="100px"
        />

        <MarkdownField
          label="AS-IS Process"
          value={value.analysisDesign.asIsProcess}
          onChange={(val) => onChange({ ...value, analysisDesign: { ...value.analysisDesign, asIsProcess: val } })}
          placeholder="Current process description..."
          minHeight="100px"
        />

        <MarkdownField
          label="TO-BE Process"
          value={value.analysisDesign.toBeProcess}
          onChange={(val) => onChange({ ...value, analysisDesign: { ...value.analysisDesign, toBeProcess: val } })}
          placeholder="Proposed process description..."
          minHeight="100px"
        />

        <DiagramViewer
          label="Use Case Diagram"
          value={value.analysisDesign.useCaseDiagram}
          onChange={(val) => onChange({ ...value, analysisDesign: { ...value.analysisDesign, useCaseDiagram: val } })}
          id="useCaseDiagram"
        />

        <DiagramViewer
          label="ERD Diagram"
          value={value.analysisDesign.erdDiagram}
          onChange={(val) => onChange({ ...value, analysisDesign: { ...value.analysisDesign, erdDiagram: val } })}
          id="erdDiagram"
        />

        <DiagramViewer
          label="System Architecture (C4 Level 1)"
          value={value.analysisDesign.systemArchitecture}
          onChange={(val) => onChange({ ...value, analysisDesign: { ...value.analysisDesign, systemArchitecture: val } })}
          id="systemArchitecture"
        />

        <DiagramViewer
          label="Container Diagram (C4 Level 2)"
          value={value.analysisDesign.containerDiagram}
          onChange={(val) => onChange({ ...value, analysisDesign: { ...value.analysisDesign, containerDiagram: val } })}
          id="containerDiagram"
        />

        <DiagramViewer
          label="Sequence Diagram"
          value={value.analysisDesign.sequenceDiagram}
          onChange={(val) => onChange({ ...value, analysisDesign: { ...value.analysisDesign, sequenceDiagram: val } })}
          id="sequenceDiagram"
        />

        <MarkdownField
          label="UI/UX Mockup"
          value={value.analysisDesign.uiUxMockup}
          onChange={(val) => onChange({ ...value, analysisDesign: { ...value.analysisDesign, uiUxMockup: val } })}
          placeholder="UI/UX mockup description or link..."
          minHeight="100px"
        />

        <DiagramViewer
          label="Deployment Architecture"
          value={value.analysisDesign.deploymentArchitecture}
          onChange={(val) => onChange({ ...value, analysisDesign: { ...value.analysisDesign, deploymentArchitecture: val } })}
          id="deploymentArchitecture"
        />
      </TabsContent>

      {/* Test Scenario Tab */}
      <TabsContent value="test" className="space-y-4 mt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Project Name</Label>
            <Input
              value={value.testScenario.projectName}
              onChange={(e) => onChange({ ...value, testScenario: { ...value.testScenario, projectName: e.target.value } })}
              placeholder="Enter project name"
            />
          </div>
          <div className="space-y-2">
            <Label>Version</Label>
            <Input
              value={value.testScenario.version}
              onChange={(e) => onChange({ ...value, testScenario: { ...value.testScenario, version: e.target.value } })}
              placeholder="1.0"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              value={value.testScenario.date}
              onChange={(e) => onChange({ ...value, testScenario: { ...value.testScenario, date: e.target.value } })}
              placeholder="YYYY-MM-DD"
            />
          </div>
          <div className="space-y-2">
            <Label>Prepared By</Label>
            <Input
              value={value.testScenario.preparedBy}
              onChange={(e) => onChange({ ...value, testScenario: { ...value.testScenario, preparedBy: e.target.value } })}
              placeholder="Name"
            />
          </div>
        </div>

        <MarkdownField
          label="Objective"
          value={value.testScenario.objective}
          onChange={(val) => onChange({ ...value, testScenario: { ...value.testScenario, objective: val } })}
          placeholder="Testing objectives..."
          minHeight="100px"
        />

        <EditableList
          label="In Scope"
          value={value.testScenario.inScope}
          onChange={(arr) => onChange({ ...value, testScenario: { ...value.testScenario, inScope: arr } })}
          placeholder="e.g., Functional testing"
        />

        <EditableList
          label="Out of Scope"
          value={value.testScenario.outOfScope}
          onChange={(arr) => onChange({ ...value, testScenario: { ...value.testScenario, outOfScope: arr } })}
          placeholder="e.g., Performance testing"
        />

        <MarkdownField
          label="Acceptance Criteria"
          value={value.testScenario.acceptanceCriteria}
          onChange={(val) => onChange({ ...value, testScenario: { ...value.testScenario, acceptanceCriteria: val } })}
          placeholder="Define test acceptance criteria..."
          minHeight="100px"
        />
      </TabsContent>
    </Tabs>
  )
}
