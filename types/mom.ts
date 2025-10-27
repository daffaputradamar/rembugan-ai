export type ClarificationFieldPath =
  | "projectName"
  | "meetingTitle"
  | "meetingObjective"
  | "meetingDate"
  | "meetingTime"
  | "meetingLocation"
  | "attendees"
  | "topics"
  | "actionItems"
  | "risks"
  | "openIssues"
  | "nextMeeting"
  | "nextMeeting.date"
  | "nextMeeting.agenda"
  | "nextMeeting.expectedOutcome"

export type MomAttendee = { name: string; role: string }
export type MomTopic = { topic: string; keyPoints: string; decision: string }
export type MomActionItem = { action: string; pic: string; dueDate: string }
export type MomRisk = { risk: string; impact: string; mitigation: string }
export type MomOpenIssue = { question: string; owner: string }
export type MomNextMeeting = { date: string; agenda: string; expectedOutcome: string }

export type MomReview = {
  projectName: string
  meetingTitle: string
  meetingObjective: string
  meetingDate: string
  meetingTime: string
  meetingLocation: string
  attendees: MomAttendee[]
  topics: MomTopic[]
  actionItems: MomActionItem[]
  risks: MomRisk[]
  openIssues: MomOpenIssue[]
  nextMeeting: MomNextMeeting
}

export type MomClarification = {
  id: string
  fieldPath: ClarificationFieldPath
  prompt: string
  currentValue?: string
  answerType: "text" | "list" | "date"
  formatHint?: string
  suggestions?: string[]
  severity: "high" | "medium" | "low"
}

export type ClarificationAnswer = {
  id: string
  fieldPath: ClarificationFieldPath
  prompt: string
  answer?: string
}

export type SummaryPhase = "idle" | "review" | "finalized"
export type AiMode = "summarize" | "spec"
export type Step = "input" | "summary" | "spec"
