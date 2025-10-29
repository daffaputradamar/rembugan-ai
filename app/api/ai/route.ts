import type { NextRequest } from "next/server";
import { generateObject, generateText } from "ai";
import { google } from "@ai-sdk/google";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

// Note: Next.js handles provider configuration via the AI Gateway. You only pass a model string.
const MODEL = google("gemini-2.5-flash");

const systemPreamble = `
You are an expert product manager and technical writer.
Return concise, clear results grounded in the provided transcript.
Respond exclusively in Bahasa Indonesia.
`;

const mermaidInstruction = readFileSync(
  join(process.cwd(), "docs", "Mermaid.md"),
  "utf8"
).trim();
const momReviewSchema = z.object({
  projectName: z.string().describe("Nama proyek atau inisiatif"),
  meetingTitle: z.string().describe("Judul rapat"),
  meetingObjective: z.string().describe("Tujuan rapat"),
  meetingDate: z.string().describe("Tanggal rapat"),
  meetingTime: z.string().describe("Waktu rapat"),
  meetingLocation: z.string().describe("Lokasi atau platform rapat"),
  attendees: z
    .array(
      z.object({
        name: z.string().describe("Nama peserta"),
        role: z.string().describe("Peran peserta"),
      })
    )
    .describe("Daftar peserta dan peran"),
  topics: z
    .array(
      z.object({
        topic: z.string().describe("Topik utama"),
        keyPoints: z.string().describe("Ringkasan pembahasan"),
        decision: z
          .string()
          .describe("Keputusan atau hasil (gunakan 'Tidak ada keputusan' jika tidak ada)"),
      })
    )
    .describe("Daftar topik utama, ringkasan, dan keputusan"),
  actionItems: z
    .array(
      z.object({
        action: z.string().describe("Item aksi"),
        pic: z.string().describe("Penanggung jawab"),
        dueDate: z
          .string()
          .describe("Tenggat (gunakan 'Tidak disebutkan' bila tidak ada)")
          .default("Tidak disebutkan"),
      })
    )
    .describe("Daftar action item beserta PIC dan tenggat"),
  risks: z
    .array(
      z.object({
        risk: z.string().describe("Risiko atau isu"),
        impact: z
          .string()
          .describe("Dampak jika risiko terjadi (boleh 'Tidak disebutkan')"),
        mitigation: z
          .string()
          .describe("Mitigasi atau rencana tindak lanjut"),
      })
    )
    .describe("Daftar risiko dan mitigasinya"),
  openIssues: z
    .array(
      z.object({
        question: z.string().describe("Pertanyaan atau isu terbuka"),
        owner: z.string().describe("Penanggung jawab lanjutan"),
      })
    )
    .describe("Isu atau pertanyaan terbuka"),
  nextMeeting: z
    .object({
      date: z.string().describe("Tanggal pertemuan selanjutnya"),
      agenda: z.string().describe("Agenda pertemuan selanjutnya"),
      expectedOutcome: z.string().describe("Harapan hasil pertemuan selanjutnya"),
    })
    .describe("Rencana pertemuan berikutnya"),
});

type MomReviewData = z.infer<typeof momReviewSchema>;

const momClarificationSchema = z.object({
  id: z.string().describe("ID unik untuk klarifikasi"),
  fieldPath: z
    .enum([
      "projectName",
      "meetingTitle",
      "meetingObjective",
      "meetingDate",
      "meetingTime",
      "meetingLocation",
      "attendees",
      "topics",
      "actionItems",
      "risks",
      "openIssues",
      "nextMeeting",
      "nextMeeting.date",
      "nextMeeting.agenda",
      "nextMeeting.expectedOutcome",
    ])
    .describe("Lokasi field yang perlu diklarifikasi"),
  prompt: z
    .string()
    .describe(
      "Pertanyaan natural yang akan ditampilkan ke pengguna untuk melengkapi informasi"
    ),
  currentValue: z
    .string()
    .describe("Nilai saat ini yang dianggap kurang akurat atau tidak lengkap")
    .optional(),
  answerType: z
    .enum(["text", "list", "date"])
    .default("text")
    .describe("Jenis jawaban yang diharapkan"),
  formatHint: z
    .string()
    .describe(
      "Petunjuk singkat mengenai format jawaban yang diharapkan (mis. 'Nama - Peran')"
    )
    .optional(),
  suggestions: z
    .array(z.string())
    .describe("Contoh jawaban atau opsi yang dapat dipilih pengguna")
    .optional(),
  severity: z
    .enum(["high", "medium", "low"])
    .default("medium")
    .describe("Tingkat pentingnya klarifikasi"),
});

const momAnalysisSchema = z.object({
  review: momReviewSchema,
  clarifications: z.array(momClarificationSchema),
});

const clarificationAnswerSchema = z.object({
  id: z.string(),
  fieldPath: momClarificationSchema.shape.fieldPath,
  prompt: z.string(),
  answer: z.string().optional(),
});

type ClarificationAnswer = z.infer<typeof clarificationAnswerSchema>;

const summarizePrompt = (
  text: string,
  review?: MomReviewData,
  clarifications?: ClarificationAnswer[]
) => `
${systemPreamble}

Tugas: Ubah transkrip rapat berikut menjadi Minutes of Meeting (MoM) terstruktur dalam format Markdown.

Panduan format (ikuti urutan dan heading yang sama, gunakan emoji persis seperti di bawah):

Project: <nama proyek>
Meeting Title: <judul rapat>
Date: <tanggal lengkap dalam Bahasa Indonesia, mis. 23 Oktober 2025>
Time: <rentang waktu, mis. 14:00 – 15:00 WIB>
Location: <lokasi atau platform>
Facilitator: <nama & jabatan>
Note Taker: <nama & jabatan>
Tambahkan kalimat "Add meeting date here." tepat setelah metadata.

📌 Meeting Objective
<paragraf ringkas, 1-3 kalimat>

🧑‍💻 Attendees

| Name | Role |
| --- | --- |
| ... |

📄 Discussion Summary

| Topic | Key Points | Decision / Agreement |
| --- | --- | --- |
| ... |

✏️ Notes
<bullet list atau "- Tidak ada catatan tambahan." jika kosong>

🤹️ Tasks

| Action | PIC | Due Date |
| --- | --- | --- |
| ... |

✏️ Open Question

| No | Question | Owner |
| --- | --- | --- |
| ... |

✏️ Risk & Issues

| No | Risk | Impact | Mitigation |
| --- | --- | --- | --- |
| ... |

✏️ Next Meeting

Date: <tanggal selanjutnya>
Agenda: <agenda>
Expected Outcome: <hasil yang diharapkan>

Aturan tambahan:
- Jika informasi terverifikasi tersedia, jadikan itu rujukan utama. Jangan mengubah nilai yang sudah dikonfirmasi pengguna kecuali bertentangan jelas dengan transkrip.
- Gunakan Bahasa Indonesia yang formal namun ringkas.
- Isi setiap kolom sebaik mungkin. Jika informasi tidak ada di transkrip, tulis "Tidak disebutkan".
- Pastikan tabel selaras.
- Jaga agar setiap kolom "Due Date" menggunakan format tanggal lokal (mis. 26 Okt 2025).
- Jangan gunakan tag HTML apa pun (mis. <br/>, <br>, <p>). Gunakan baris kosong untuk pemisah.
- Jika transkrip mengandung tag HTML (seperti <br/>), konversi menjadi baris baru biasa dan hilangkan tag tersebut pada hasil akhir.
- Output wajib murni Markdown tanpa elemen HTML.

${review ? `
Informasi terverifikasi berikut berasal dari konfirmasi pengguna. Gunakan sebagai acuan utama. Jika ada hal yang tidak ditemukan dalam transkrip, biarkan sebagaimana adanya.

Data terverifikasi (JSON):
${JSON.stringify(review, null, 2)}
` : ""}

${clarifications && clarifications.length
  ? `Klarifikasi tambahan dari pengguna:
${clarifications
  .map(
    (item, idx) =>
      `${idx + 1}. Field: ${item.fieldPath}
   Pertanyaan: ${item.prompt}
   Jawaban pengguna: ${item.answer?.trim() || "(Pengguna memilih tetap menggunakan data awal)"}`
  )
  .join("\n")}

Gunakan jawaban tersebut untuk memperbarui data sebelum membuat MoM. Jika jawaban kosong, pertahankan nilai pada data terverifikasi.`
  : ""}

Transcript:
"""
${text}
"""
`

const momReviewPrompt = (text: string) => `
${systemPreamble}

Tugas: Baca seluruh transkrip rapat berikut dan susun data terstruktur untuk dikonfirmasi ke pengguna sebelum membuat Minutes of Meeting.

Format keluaran JSON:
{
  "review": {
    "projectName": string,
    "meetingTitle": string,
    "meetingObjective": string,
    "meetingDate": string,
    "meetingTime": string,
    "meetingLocation": string,
    "attendees": [
      { "name": string, "role": string }
    ],
    "topics": [
      { "topic": string, "keyPoints": string, "decision": string }
    ],
    "actionItems": [
      { "action": string, "pic": string, "dueDate": string }
    ],
    "risks": [
      { "risk": string, "impact": string, "mitigation": string }
    ],
    "openIssues": [
      { "question": string, "owner": string }
    ],
    "nextMeeting": { "date": string, "agenda": string, "expectedOutcome": string }
  },
  "clarifications": [
    {
      "id": string,
      "fieldPath": one of "projectName", "meetingTitle", "meetingObjective", "meetingDate", "meetingTime", "meetingLocation", "attendees", "topics", "actionItems", "risks", "openIssues", "nextMeeting", "nextMeeting.date", "nextMeeting.agenda", "nextMeeting.expectedOutcome",
      "prompt": string,
      "currentValue": string,
      "answerType": "text" | "list" | "date",
      "formatHint": string,
      "suggestions": string[],
      "severity": "high" | "medium" | "low"
    }
  ]
}

Panduan:
- Baca seluruh transkrip, identifikasi informasi relevan sesuai struktur di atas.
- Isi semua field pada "review"; gunakan "Tidak disebutkan" bila benar-benar tidak ditemukan.
- Bangun daftar "clarifications" hanya untuk bagian yang masih meragukan, tidak lengkap, atau bertentangan. Hindari menanyakan ulang informasi yang sudah jelas.
- **PENTING**: Selalu buat klarifikasi untuk "attendees" jika ada nama peserta yang terdeteksi, karena pengguna perlu memastikan ejaan nama dan peran yang benar. Gunakan fieldPath "attendees" dan berikan formatHint "Tulis setiap peserta dengan format: Nama Lengkap - Peran/Jabatan (satu baris per peserta)".
- Batasi klarifikasi maksimal 7 pertanyaan (termasuk attendees), urutkan dari prioritas tertinggi.
- Tulis "prompt" dalam gaya percakapan santun dan hangat.
- "currentValue" harus merefleksikan nilai yang dianggap tidak akurat agar pengguna tahu konteksnya.
- Gunakan "answerType" dan "formatHint" untuk memandu format jawaban.
- Jika tidak ada bagian yang membutuhkan klarifikasi, kembalikan array "clarifications" kosong.

Transcript:
"""
${text}
"""
`;

const specPrompt = (text: string) => `
${systemPreamble}

Tugas: Dari transkrip rapat berikut, buat 3 dokumen lengkap: URD (User Requirement Document), A&D (Analysis & Design Document), dan Test Scenario Document.
- Isi semua field dengan data yang relevan dari transkrip
- Gunakan format yang profesional dan terstruktur
- Jika informasi tidak ada di transkrip, buat asumsi yang masuk akal
- Semua diagram pada dokumen A&D harus menggunakan sintaks Mermaid valid (mis. flowchart, erDiagram, sequenceDiagram) dan tidak boleh memakai escape \\n.
${mermaidInstruction}

Transcript:
"""
${text}
"""
`;

const listField = (description: string) =>
  z.array(z.string().min(1).describe(description)).describe(description);

const urdSchema = z.object({
  projectName: z.string().describe("Nama proyek"),
  date: z.string().describe("Tanggal pembuatan dokumen"),
  preparedBy: z.string().describe("Tim yang menyiapkan"),
  reviewedBy: z.string().describe("Pihak yang mereview"),
  version: z.string().describe("Versi dokumen"),
  background: z.string().describe("Latar belakang kebutuhan proyek"),
  objective: z.string().describe("Tujuan dari proyek"),
  inScope: listField("Item yang termasuk dalam scope proyek"),
  outOfScope: listField("Item yang tidak termasuk dalam scope"),
  functionalRequirements: z
    .array(
      z.object({
        id: z.string().describe("ID requirement (e.g., FR-01)"),
        requirement: z.string().describe("Nama requirement"),
        description: z.string().describe("Deskripsi detail"),
        priority: z.string().describe("Prioritas: High, Medium, atau Low"),
      })
    )
    .describe("Daftar functional requirements"),
  nonFunctionalRequirements: z
    .array(
      z.object({
        id: z.string().describe("ID requirement (e.g., NFR-01)"),
        aspect: z
          .string()
          .describe("Aspek non-functional (Security, Performance, dll)"),
        requirement: z.string().describe("Deskripsi requirement"),
      })
    )
    .describe("Daftar non-functional requirements"),
  userRoles: z
    .array(
      z.object({
        role: z.string().describe("Nama role"),
        description: z.string().describe("Deskripsi role"),
        accessRights: z.string().describe("Hak akses"),
      })
    )
    .describe("Daftar user role dan akses"),
  businessFlow: z.string().describe("Alur bisnis proses dalam bentuk teks"),
  integrationPoints: z
    .array(
      z.object({
        system: z.string().describe("Nama sistem eksternal"),
        direction: z.string().describe("Inbound atau Outbound"),
        data: z.string().describe("Jenis data yang diintegrasikan"),
        protocol: z.string().describe("Protokol komunikasi"),
      })
    )
    .describe("Titik integrasi dengan sistem lain"),
  acceptanceCriteria: z.string().describe("Kriteria penerimaan proyek"),
});

const andSchema = z.object({
  projectName: z.string().describe("Nama proyek"),
  date: z.string().describe("Tanggal pembuatan dokumen"),
  version: z.string().describe("Versi dokumen"),
  preparedBy: z.string().describe("Tim yang menyiapkan"),
  objective: z.string().describe("Tujuan dokumen analisis dan desain"),
  asIsProcess: z.string().describe("Proses bisnis saat ini (AS-IS)"),
  toBeProcess: z.string().describe("Proses bisnis yang akan datang (TO-BE)"),
  useCaseDiagram: z
    .string()
    .describe(
      "Diagram use case dalam format Mermaid (mis. diawali flowchart LR atau graph TD). Gunakan newline nyata, hindari escape \\n."
    ),
  erdDiagram: z
    .string()
    .describe(
      "Entity Relationship Diagram dalam format Mermaid (gunakan blok erDiagram). Gunakan newline nyata, hindari escape \\n."
    ),
  systemArchitecture: z
    .string()
    .describe(
      "Arsitektur sistem (C4 Level 1) dalam Mermaid (mis. graph, flowchart, atau diagram C4 resmi). Gunakan newline nyata, hindari escape \\n."
    ),
  containerDiagram: z
    .string()
    .describe(
      "Container diagram (C4 Level 2) dalam Mermaid (mis. C4Container, flowchart, atau graph). Gunakan newline nyata, hindari escape \\n."
    ),
  technologyStack: z
    .array(
      z.object({
        component: z.string().describe("Nama komponen"),
        technology: z.string().describe("Teknologi yang digunakan"),
        description: z.string().describe("Deskripsi komponen"),
      })
    )
    .describe("Stack teknologi yang digunakan"),
  sequenceDiagram: z
    .string()
    .describe(
      "Sequence diagram untuk proses utama dalam Mermaid (diawali sequenceDiagram). Gunakan newline nyata, hindari escape \\n."
    ),
  uiUxMockup: z.string().describe("Deskripsi mockup UI/UX"),
  nonFunctionalDesign: z
    .array(
      z.object({
        aspect: z
          .string()
          .describe("Aspek desain (Security, Performance, dll)"),
        specification: z.string().describe("Spesifikasi desain"),
      })
    )
    .describe("Desain non-functional"),
  deploymentArchitecture: z
    .string()
    .describe(
      "Arsitektur deployment dalam Mermaid (mis. flowchart atau graph). Gunakan newline nyata, hindari escape \\n."
    ),
});

const testScenarioSchema = z.object({
  projectName: z.string().describe("Nama proyek"),
  version: z.string().describe("Versi dokumen"),
  date: z.string().describe("Tanggal pembuatan dokumen"),
  preparedBy: z.string().describe("Tim yang menyiapkan"),
  objective: z.string().describe("Tujuan dokumen test scenario"),
  referenceDocuments: z
    .array(
      z.object({
        name: z.string().describe("Nama dokumen referensi"),
        version: z.string().describe("Versi dokumen"),
        date: z.string().describe("Tanggal dokumen"),
      })
    )
    .describe("Dokumen referensi"),
  inScope: listField("Item yang termasuk dalam scope testing"),
  outOfScope: listField("Item yang tidak termasuk dalam scope testing"),
  functionalScenarios: z
    .array(
      z.object({
        id: z.string().describe("ID skenario (e.g., TS-01)"),
        description: z.string().describe("Deskripsi skenario"),
        urdReference: z.string().describe("Referensi ke URD"),
        expectedResult: z.string().describe("Hasil yang diharapkan"),
        category: z.string().describe("Kategori (Fungsional, Workflow, dll)"),
      })
    )
    .describe("Skenario test fungsional"),
  nonFunctionalScenarios: z
    .array(
      z.object({
        id: z.string().describe("ID skenario (e.g., TS-NF-01)"),
        description: z.string().describe("Deskripsi skenario"),
        aspect: z.string().describe("Aspek yang diuji"),
        expectedResult: z.string().describe("Hasil yang diharapkan"),
      })
    )
    .describe("Skenario test non-fungsional"),
  testData: z
    .array(
      z.object({
        dataType: z.string().describe("Jenis data"),
        example: z.string().describe("Contoh data"),
        remarks: z.string().describe("Keterangan"),
      })
    )
    .describe("Data yang diperlukan untuk testing"),
  acceptanceCriteria: z.string().describe("Kriteria penerimaan testing"),
});

const specSchema = z.object({
  summary: z
    .string()
    .min(1)
    .max(800)
    .describe("Ringkasan rapat dalam Bahasa Indonesia, maksimum 150 kata."),
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
    includeMermaidContext,
    stage,
    review,
    clarificationAnswers,
  } = await req.json();
  if (!text || !mode) {
    return new Response(JSON.stringify({ error: "Missing text or mode" }), {
      status: 400,
    });
  }

  try {
    if (mode === "edit") {
      if (!prompt) {
        return new Response(
          JSON.stringify({ error: "Missing prompt for edit mode" }),
          { status: 400 }
        );
      }

      const mermaidContext =
        includeMermaidContext || (fieldLabel && /diagram/i.test(fieldLabel))
          ? `
Ikuti panduan Mermaid berikut:
${mermaidInstruction}`
          : "";

      const editPrompt = `
${systemPreamble}

Tugas: Edit konten berikut berdasarkan instruksi pengguna.
- Field yang sedang diedit: ${fieldLabel || "Content"}
- Pertahankan format markdown jika ada
- Terapkan perubahan sesuai instruksi dengan akurat
- Jika konten kosong, buat konten baru sesuai instruksi
${mermaidContext}

Konten saat ini:
"""
${text}
"""

Instruksi pengguna:
"""
${prompt}
"""

Berikan hasil editan dalam format markdown yang rapi.
`;

      const { text: out } = await generateText({
        model: MODEL,
        prompt: editPrompt,
      });

      return new Response(JSON.stringify({ result: out?.trim() || "" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (mode === "summarize") {
      if (stage === "analyze") {
        const result = await generateObject({
          model: MODEL,
          schema: momAnalysisSchema,
          prompt: momReviewPrompt(text),
        });

        return new Response(
          JSON.stringify({
            stage: "clarify",
            review: result.object.review,
            clarifications: result.object.clarifications,
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
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

        const { text: out } = await generateText({
          model: MODEL,
          prompt: summarizePrompt(text, verifiedReview, parsedClarifications),
        });
        return new Response(
          JSON.stringify({
            summary: out?.trim() || "",
            review: verifiedReview,
            clarifications: parsedClarifications,
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const { text: out } = await generateText({
        model: MODEL,
        prompt: summarizePrompt(text),
      });
      return new Response(JSON.stringify({ summary: out?.trim() || "" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (mode === "spec") {
      // If step is provided, generate only that specific document
      if (step === "urd") {
        const result = await generateObject({
          model: MODEL,
          schema: z.object({ urd: urdSchema }),
          prompt: `${systemPreamble}\n\nTugas: Dari transkrip rapat berikut, buat User Requirement Document (URD) yang lengkap.\n\nTranscript:\n"""\n${text}\n"""`,
        });
        return new Response(JSON.stringify({ urd: result.object.urd }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (step === "analysisDesign") {
        const result = await generateObject({
          model: MODEL,
          schema: z.object({ analysisDesign: andSchema }),
          prompt: `${systemPreamble}

Tugas: Dari transkrip rapat berikut, buat Analysis & Design Document (A&D) yang lengkap.

Instruksi penting untuk diagram:
- Semua diagram WAJIB menggunakan sintaks Mermaid yang valid.
- Gunakan newline sebenarnya untuk setiap baris dan hindari escape \\n.
- Pilih tipe diagram yang sesuai: flowchart/graph untuk use case & arsitektur, erDiagram untuk ERD, C4Container atau flowchart untuk container diagram, sequenceDiagram untuk sequence, dan flowchart/graph untuk deployment.
- Sertakan label atau komentar seperlunya untuk menjaga keterbacaan.

Contoh format Mermaid:
${mermaidInstruction}

Transcript:
"""
${text}
"""`,
        });

        // Post-process to convert any \\n to actual newlines
        const processedDesign = {
          ...result.object.analysisDesign,
          useCaseDiagram: result.object.analysisDesign.useCaseDiagram.replace(
            /\\n/g,
            "\n"
          ),
          erdDiagram: result.object.analysisDesign.erdDiagram.replace(
            /\\n/g,
            "\n"
          ),
          systemArchitecture:
            result.object.analysisDesign.systemArchitecture.replace(
              /\\n/g,
              "\n"
            ),
          containerDiagram:
            result.object.analysisDesign.containerDiagram.replace(/\\n/g, "\n"),
          sequenceDiagram: result.object.analysisDesign.sequenceDiagram.replace(
            /\\n/g,
            "\n"
          ),
          deploymentArchitecture:
            result.object.analysisDesign.deploymentArchitecture.replace(
              /\\n/g,
              "\n"
            ),
        };

        return new Response(
          JSON.stringify({ analysisDesign: processedDesign }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (step === "testScenario") {
        const result = await generateObject({
          model: MODEL,
          schema: z.object({ testScenario: testScenarioSchema }),
          prompt: `${systemPreamble}\n\nTugas: Dari transkrip rapat berikut, buat Test Scenario Document yang lengkap.\n\nTranscript:\n"""\n${text}\n"""`,
        });
        return new Response(
          JSON.stringify({ testScenario: result.object.testScenario }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Original behavior: generate all at once (fallback)
      const result = await generateObject({
        model: MODEL,
        schema: specSchema,
        prompt: specPrompt(text),
      });

      const data: SpecResult = result.object;
      const { summary, urd, analysisDesign, testScenario } = data;

      return new Response(
        JSON.stringify({ summary, urd, analysisDesign, testScenario }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Unsupported mode" }), {
      status: 400,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "AI error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
