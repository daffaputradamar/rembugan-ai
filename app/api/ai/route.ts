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
const summarizePrompt = (text: string) => `
${systemPreamble}

Task: Summarize the following meeting transcript into a concise, human-readable summary in Bahasa Indonesia.
- Tangkap ide utama, keputusan, pemangku kepentingan, dan tantangan.
- Usahakan tetap di bawah 200 kata jika memungkinkan.

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
  const { text, mode, step, prompt, fieldLabel } = await req.json();
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
        fieldLabel && /diagram/i.test(fieldLabel)
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
