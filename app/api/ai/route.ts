import type { NextRequest } from "next/server";
import { generateText, generateObject, truncateText, extractSpeakers } from "@/lib/llm";
import { z } from "zod";

// Simplified system prompt for local models
const systemPreamble = `You are an expert meeting summarizer. Respond in Bahasa Indonesia. Be concise.`;

// Max transcript length for local models
const MAX_TRANSCRIPT_LENGTH = 250000;
// Simplified MoM schema for local models
const momReviewSchema = z.object({
  projectName: z.string(),
  meetingTitle: z.string(),
  meetingObjective: z.string(),
  meetingDate: z.string(),
  meetingTime: z.string(),
  meetingLocation: z.string(),
  attendees: z.array(z.object({
    name: z.string(),
    role: z.string(),
  })),
  topics: z.array(z.object({
    topic: z.string(),
    keyPoints: z.string(),
    decision: z.string(),
  })),
  actionItems: z.array(z.object({
    action: z.string(),
    pic: z.string(),
    dueDate: z.string(),
  })),
  risks: z.array(z.object({
    risk: z.string(),
    impact: z.string(),
    mitigation: z.string(),
  })),
  openIssues: z.array(z.object({
    question: z.string(),
    owner: z.string(),
  })),
  nextMeeting: z.object({
    date: z.string(),
    agenda: z.string(),
    expectedOutcome: z.string(),
  }),
});

type MomReviewData = z.infer<typeof momReviewSchema>;

// Simplified clarification schema
const momClarificationSchema = z.object({
  id: z.string(),
  fieldPath: z.string(),
  prompt: z.string(),
  currentValue: z.string().optional(),
  answerType: z.enum(["text", "list", "date"]).default("text"),
  formatHint: z.string().optional(),
  suggestions: z.array(z.string()).optional(),
  severity: z.enum(["high", "medium", "low"]).default("medium"),
});

const clarificationAnswerSchema = z.object({
  id: z.string(),
  fieldPath: z.string(),
  prompt: z.string(),
  answer: z.string().optional(),
});

type ClarificationAnswer = z.infer<typeof clarificationAnswerSchema>;

// Simplified template format
const defaultTemplateFormat = `
Format output:
- Project: nama proyek
- Meeting Title: judul
- Date: tanggal
- Time: waktu
- Location: lokasi
- Facilitator: nama
- Note Taker: nama

📌 Meeting Objective
(1-2 kalimat)

🧑‍💻 Attendees
| Name | Role |
| --- | --- |

📄 Discussion Summary
| Topic | Key Points | Decision |
| --- | --- | --- |

✏️ Notes
(bullet list)

🤹️ Tasks
| Action | PIC | Due Date |
| --- | --- | --- |

✏️ Open Questions
| No | Question | Owner |
| --- | --- | --- |

✏️ Risks & Issues
| No | Risk | Impact | Mitigation |
| --- | --- | --- | --- |

✏️ Next Meeting
- Date: tanggal
- Agenda: agenda
- Expected Outcome: hasil
`;

// Optimized summarize prompt for local models
const summarizePrompt = (
  text: string,
  review?: MomReviewData,
  clarifications?: ClarificationAnswer[],
  customTemplate?: string
) => {
  const truncatedText = truncateText(text, MAX_TRANSCRIPT_LENGTH);
  const template = customTemplate || defaultTemplateFormat;

  let prompt = `Buat Minutes of Meeting dari transkrip berikut.
Format: ${template}
Bahasa: Indonesia
Jika info tidak ada, tulis "Tidak disebutkan".
`;

  if (review) {
    prompt += `\nData terverifikasi:\n${JSON.stringify(review, null, 2)}\n`;
  }

  if (clarifications?.length) {
    prompt += `\nKlarifikasi:\n${clarifications.map((c, i) => `${i + 1}. ${c.fieldPath}: ${c.answer || "(kosong)"}`).join("\n")}\n`;
  }

  prompt += `\nTranscript:\n${truncatedText}`;
  return prompt;
};

// Optimized MoM review prompt for local models
const momReviewPrompt = (text: string, detectedSpeakers: string[]) => {
  const truncatedText = truncateText(text, MAX_TRANSCRIPT_LENGTH);
  
  return `Analisis transkrip rapat ini dan buat JSON dengan struktur berikut.

Speakers terdeteksi: ${detectedSpeakers.slice(0, 15).join(", ")}

Output JSON (tanpa markdown):
{
  "review": {
    "projectName": "string",
    "meetingTitle": "string",
    "meetingObjective": "string",
    "meetingDate": "string",
    "meetingTime": "string",
    "meetingLocation": "string",
    "attendees": [{"name": "string", "role": "string"}],
    "topics": [{"topic": "string", "keyPoints": "string", "decision": "string"}],
    "actionItems": [{"action": "string", "pic": "string", "dueDate": "string"}],
    "risks": [{"risk": "string", "impact": "string", "mitigation": "string"}],
    "openIssues": [{"question": "string", "owner": "string"}],
    "nextMeeting": {"date": "string", "agenda": "string", "expectedOutcome": "string"}
  },
  "clarifications": [
    {
      "id": "1",
      "fieldPath": "meetingDate",
      "prompt": "Konfirmasi tanggal rapat",
      "currentValue": "17 Desember 2024",
      "answerType": "date",
      "suggestions": ["2024-12-17", "17 Desember 2024", "December 17, 2024"],
      "severity": "medium"
    },
    {
      "id": "2",
      "fieldPath": "meetingLocation",
      "prompt": "Konfirmasi lokasi rapat",
      "currentValue": "Tidak disebutkan",
      "answerType": "text",
      "suggestions": ["Ruang Meeting Lt. 3", "Google Meet", "Zoom Meeting"],
      "severity": "low"
    }
  ]
}

PENTING untuk clarifications:
- "currentValue": WAJIB string biasa yang mudah dibaca manusia (bukan JSON), contoh: "Andi, Budi, Citra" atau "Tidak disebutkan"
- "suggestions": WAJIB berisi nilai KONKRET yang bisa langsung dipilih user, bukan instruksi meta (❌ "Verifikasi nama", ✅ "John Doe, Jane Smith")
- Hanya buat clarification jika ada informasi ambigu atau hilang
- Maks 5 clarifications

Isi semua field review. Gunakan "Tidak disebutkan" jika tidak ada info.

Transcript:
${truncatedText}`;
};

// Simplified spec prompt for local models
const specPrompt = (text: string) => {
  const truncatedText = truncateText(text, MAX_TRANSCRIPT_LENGTH);
  return `Dari transkrip rapat, buat dokumen teknis.
Bahasa: Indonesia
Output: JSON

Transcript:
${truncatedText}`;
};

// Simplified schemas for local models
const listField = () => z.array(z.string());

const urdSchema = z.object({
  projectName: z.string(),
  date: z.string(),
  preparedBy: z.string(),
  reviewedBy: z.string(),
  version: z.string(),
  background: z.string(),
  objective: z.string(),
  inScope: listField(),
  outOfScope: listField(),
  functionalRequirements: z.array(z.object({
    id: z.string(),
    requirement: z.string(),
    description: z.string(),
    priority: z.string(),
  })),
  nonFunctionalRequirements: z.array(z.object({
    id: z.string(),
    aspect: z.string(),
    requirement: z.string(),
  })),
  userRoles: z.array(z.object({
    role: z.string(),
    description: z.string(),
    accessRights: z.string(),
  })),
  businessFlow: z.string(),
  integrationPoints: z.array(z.object({
    system: z.string(),
    direction: z.string(),
    data: z.string(),
    protocol: z.string(),
  })),
  acceptanceCriteria: z.string(),
});

const andSchema = z.object({
  projectName: z.string(),
  date: z.string(),
  version: z.string(),
  preparedBy: z.string(),
  objective: z.string(),
  asIsProcess: z.string(),
  toBeProcess: z.string(),
  useCaseDiagram: z.string(),
  erdDiagram: z.string(),
  systemArchitecture: z.string(),
  containerDiagram: z.string(),
  technologyStack: z.array(z.object({
    component: z.string(),
    technology: z.string(),
    description: z.string(),
  })),
  sequenceDiagram: z.string(),
  uiUxMockup: z.string(),
  nonFunctionalDesign: z.array(z.object({
    aspect: z.string(),
    specification: z.string(),
  })),
  deploymentArchitecture: z.string(),
});

const testScenarioSchema = z.object({
  projectName: z.string(),
  version: z.string(),
  date: z.string(),
  preparedBy: z.string(),
  objective: z.string(),
  referenceDocuments: z.array(z.object({
    name: z.string(),
    version: z.string(),
    date: z.string(),
  })),
  inScope: listField(),
  outOfScope: listField(),
  functionalScenarios: z.array(z.object({
    id: z.string(),
    description: z.string(),
    urdReference: z.string(),
    expectedResult: z.string(),
    category: z.string(),
  })),
  nonFunctionalScenarios: z.array(z.object({
    id: z.string(),
    description: z.string(),
    aspect: z.string(),
    expectedResult: z.string(),
  })),
  testData: z.array(z.object({
    dataType: z.string(),
    example: z.string(),
    remarks: z.string(),
  })),
  acceptanceCriteria: z.string(),
});

const specSchema = z.object({
  summary: z.string(),
  urd: urdSchema,
  analysisDesign: andSchema,
  testScenario: testScenarioSchema,
});

type SpecResult = z.infer<typeof specSchema>;

export async function POST(req: NextRequest) {
  const {
    text,
    mode,
    step,
    prompt,
    fieldLabel,
    stage,
    review,
    clarificationAnswers,
    customTemplate,
  } = await req.json();
  
  if (!text || !mode) {
    return new Response(JSON.stringify({ error: "Missing text or mode" }), {
      status: 400,
    });
  }

  try {
    // Edit mode - simplified prompt
    if (mode === "edit") {
      if (!prompt) {
        return new Response(
          JSON.stringify({ error: "Missing prompt for edit mode" }),
          { status: 400 }
        );
      }

      const editPrompt = `Edit konten berikut sesuai instruksi.
Field: ${fieldLabel || "Content"}
Bahasa: Indonesia

Konten:
${truncateText(text, 5000)}

Instruksi: ${prompt}

Output dalam markdown.`;

      const out = await generateText(editPrompt, {
        systemPrompt: systemPreamble,
        maxInputChars: MAX_TRANSCRIPT_LENGTH,
      });

      return new Response(JSON.stringify({ result: out?.trim() || "" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Summarize mode (MoM)
    if (mode === "summarize") {
      if (stage === "analyze") {
        // Extract speakers first for better context
        const speakers = extractSpeakers(text);
        const promptText = momReviewPrompt(text, speakers);
        
        const resultSchema = z.object({
          review: momReviewSchema,
          clarifications: z.array(momClarificationSchema),
        }) as z.ZodType<{ 
          review: MomReviewData; 
          clarifications: z.infer<typeof momClarificationSchema>[] 
        }>;

        const result = await generateObject<{ 
          review: MomReviewData; 
          clarifications: z.infer<typeof momClarificationSchema>[] 
        }>(promptText, {
          systemPrompt: systemPreamble,
          temperature: 0.2,
          maxInputChars: MAX_TRANSCRIPT_LENGTH,
          schema: resultSchema,
        });

        return new Response(
          JSON.stringify({
            stage: "clarify",
            review: result.review,
            clarifications: result.clarifications || [],
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      if (stage === "finalize") {
        if (!review) {
          return new Response(
            JSON.stringify({ error: "Missing review data for finalize stage" }),
            { status: 400 }
          );
        }

        const verifiedReview = momReviewSchema.parse(review);
        const parsedClarifications = clarificationAnswers
          ? clarificationAnswerSchema.array().parse(clarificationAnswers)
          : [];

        const out = await generateText(
          summarizePrompt(text, verifiedReview, parsedClarifications, customTemplate),
          { 
            systemPrompt: systemPreamble,
            maxInputChars: MAX_TRANSCRIPT_LENGTH,
          }
        );
        
        return new Response(
          JSON.stringify({
            summary: out?.trim() || "",
            review: verifiedReview,
            clarifications: parsedClarifications,
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      // Direct summarize without analysis
      const out = await generateText(
        summarizePrompt(text, undefined, undefined, customTemplate),
        { 
          systemPrompt: systemPreamble,
          maxInputChars: MAX_TRANSCRIPT_LENGTH,
        }
      );
      return new Response(JSON.stringify({ summary: out?.trim() || "" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Spec mode - generate technical documents
    if (mode === "spec") {
      const truncatedText = truncateText(text, MAX_TRANSCRIPT_LENGTH);
      
      if (step === "urd") {
        const urdPrompt = `Buat User Requirement Document (URD) dari transkrip rapat.
Bahasa: Indonesia

WAJIB gunakan struktur JSON PERSIS seperti ini:
{
  "urd": {
    "projectName": "nama project",
    "date": "tanggal hari ini",
    "preparedBy": "nama pembuat",
    "reviewedBy": "nama reviewer",
    "version": "1.0",
    "background": "latar belakang project",
    "objective": "tujuan project",
    "inScope": ["item dalam scope 1", "item 2"],
    "outOfScope": ["item di luar scope 1"],
    "functionalRequirements": [{"id": "FR-001", "requirement": "judul", "description": "deskripsi", "priority": "High/Medium/Low"}],
    "nonFunctionalRequirements": [{"id": "NFR-001", "aspect": "Performance/Security/dll", "requirement": "deskripsi"}],
    "userRoles": [{"role": "nama role", "description": "deskripsi", "accessRights": "hak akses"}],
    "businessFlow": "alur bisnis dalam bentuk teks atau mermaid",
    "integrationPoints": [{"system": "nama sistem", "direction": "Inbound/Outbound", "data": "jenis data", "protocol": "REST/SOAP/dll"}],
    "acceptanceCriteria": "kriteria penerimaan"
  }
}

Transcript:
${truncatedText}`;

        const result = await generateObject<{ urd: z.infer<typeof urdSchema> }>(urdPrompt, {
          systemPrompt: systemPreamble,
          temperature: 0.2,
          maxInputChars: MAX_TRANSCRIPT_LENGTH,
          schema: z.object({ urd: urdSchema }),
        });
        return new Response(JSON.stringify({ urd: result.urd }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (step === "analysisDesign") {
        const andPrompt = `Buat Analysis & Design Document dari transkrip rapat.
Bahasa: Indonesia

WAJIB gunakan struktur JSON PERSIS seperti ini:
{
  "analysisDesign": {
    "projectName": "nama project",
    "date": "tanggal",
    "version": "1.0",
    "preparedBy": "nama",
    "objective": "tujuan",
    "asIsProcess": "proses saat ini",
    "toBeProcess": "proses yang diinginkan",
    "useCaseDiagram": "mermaid code untuk use case",
    "erdDiagram": "mermaid code untuk ERD",
    "systemArchitecture": "mermaid code arsitektur",
    "containerDiagram": "mermaid code container",
    "technologyStack": [{"component": "Backend", "technology": "Node.js", "description": "..."}],
    "sequenceDiagram": "mermaid code sequence",
    "uiUxMockup": "deskripsi UI/UX",
    "nonFunctionalDesign": [{"aspect": "Performance", "specification": "..."}],
    "deploymentArchitecture": "mermaid code deployment"
  }
}

Semua diagram WAJIB menggunakan sintaks Mermaid yang valid.

Transcript:
${truncatedText}`;

        const result = await generateObject<{ analysisDesign: z.infer<typeof andSchema> }>(andPrompt, {
          systemPrompt: systemPreamble,
          temperature: 0.2,
          maxInputChars: MAX_TRANSCRIPT_LENGTH,
          schema: z.object({ analysisDesign: andSchema }),
        });

        // Post-process diagrams
        const processedDesign = {
          ...result.analysisDesign,
          useCaseDiagram: result.analysisDesign.useCaseDiagram?.replace(/\\n/g, "\n") || "",
          erdDiagram: result.analysisDesign.erdDiagram?.replace(/\\n/g, "\n") || "",
          systemArchitecture: result.analysisDesign.systemArchitecture?.replace(/\\n/g, "\n") || "",
          containerDiagram: result.analysisDesign.containerDiagram?.replace(/\\n/g, "\n") || "",
          sequenceDiagram: result.analysisDesign.sequenceDiagram?.replace(/\\n/g, "\n") || "",
          deploymentArchitecture: result.analysisDesign.deploymentArchitecture?.replace(/\\n/g, "\n") || "",
        };

        return new Response(JSON.stringify({ analysisDesign: processedDesign }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (step === "testScenario") {
        const testPrompt = `Buat Test Scenario Document dari transkrip rapat.
Bahasa: Indonesia

WAJIB gunakan struktur JSON PERSIS seperti ini:
{
  "testScenario": {
    "projectName": "nama project",
    "version": "1.0",
    "date": "tanggal",
    "preparedBy": "nama",
    "objective": "tujuan testing",
    "referenceDocuments": [{"name": "URD", "version": "1.0", "date": "tanggal"}],
    "inScope": ["item dalam scope"],
    "outOfScope": ["item di luar scope"],
    "functionalScenarios": [{"id": "TC-001", "description": "deskripsi test", "urdReference": "FR-001", "expectedResult": "hasil", "category": "Functional"}],
    "nonFunctionalScenarios": [{"id": "NF-001", "description": "deskripsi", "aspect": "Performance", "expectedResult": "hasil"}],
    "testData": [{"dataType": "User Data", "example": "contoh", "remarks": "keterangan"}],
    "acceptanceCriteria": "kriteria penerimaan"
  }
}

Transcript:
${truncatedText}`;

        const result = await generateObject<{ testScenario: z.infer<typeof testScenarioSchema> }>(testPrompt, {
          systemPrompt: systemPreamble,
          temperature: 0.2,
          maxInputChars: MAX_TRANSCRIPT_LENGTH,
          schema: z.object({ testScenario: testScenarioSchema }),
        });
        return new Response(JSON.stringify({ testScenario: result.testScenario }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Generate all at once (fallback) - not recommended for local models
      const fullPrompt = `${specPrompt(text)}
Output: JSON dengan struktur {summary, urd, analysisDesign, testScenario}`;

      const result = await generateObject<SpecResult>(fullPrompt, {
        systemPrompt: systemPreamble,
        temperature: 0.2,
        maxInputChars: MAX_TRANSCRIPT_LENGTH,
        schema: specSchema,
      });

      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unsupported mode" }), {
      status: 400,
    });
  } catch (err: unknown) {
    console.error("AI API Error:", err);
    const message = err instanceof Error ? err.message : "AI processing error";
    
    // Provide more helpful error messages
    if (message.includes("timeout")) {
      return new Response(
        JSON.stringify({ 
          error: "Request timeout. Try with shorter transcript or simpler request.",
          details: message 
        }), 
        { status: 504 }
      );
    }
    
    if (message.includes("parse") || message.includes("JSON")) {
      return new Response(
        JSON.stringify({ 
          error: "Failed to parse AI response. Try again or simplify your request.",
          details: message 
        }), 
        { status: 500 }
      );
    }
    
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
