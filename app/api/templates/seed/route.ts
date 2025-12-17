import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/db"
import { templates, users } from "@/db/schema"
import { eq } from "drizzle-orm"

const defaultTemplates = [
  {
    name: "Minutes of Meeting (MoM)",
    description: "Template standar untuk notulen rapat dengan format lengkap",
    type: "mom" as const,
    markdown: `# Minutes of Meeting

## Informasi Rapat
- **Project:** [nama project]
- **Meeting Title:** [judul meeting]
- **Date:** [tanggal]
- **Time:** [waktu]
- **Location:** [lokasi]
- **Facilitator:** [nama]
- **Note Taker:** [nama]

## 📌 Meeting Objective
[1-2 kalimat tujuan rapat]

## 🧑‍💻 Attendees
| Name | Role |
|------|------|
| [nama] | [role] |

## 📄 Discussion Summary
| Topic | Key Points | Decision |
|-------|------------|----------|
| [topik] | [poin penting] | [keputusan] |

## ✅ Action Items
| No | Action | PIC | Due Date |
|----|--------|-----|----------|
| 1 | [action item] | [nama] | [tanggal] |

## ❓ Open Questions
| No | Question | Owner |
|----|----------|-------|
| 1 | [pertanyaan] | [nama] |

## ⚠️ Risks & Issues
| No | Risk/Issue | Impact | Mitigation |
|----|------------|--------|------------|
| 1 | [risiko] | [dampak] | [mitigasi] |

## 📅 Next Meeting
- **Date:** [tanggal]
- **Agenda:** [agenda]
- **Expected Outcome:** [hasil yang diharapkan]`,
    visibility: "public" as const,
    isSystem: true,
  },
  {
    name: "IT Specification - URD",
    description: "User Requirement Document untuk dokumentasi kebutuhan pengguna",
    type: "urd" as const,
    markdown: `# User Requirement Document (URD)

## Document Info
- **Project Name:** [nama project]
- **Version:** [versi]
- **Date:** [tanggal]
- **Prepared By:** [nama]
- **Reviewed By:** [nama]

## 1. Background
[Latar belakang project dan konteks bisnis]

## 2. Objective
[Tujuan utama dari project ini]

## 3. Scope

### 3.1 In Scope
- [item 1]
- [item 2]

### 3.2 Out of Scope
- [item 1]
- [item 2]

## 4. Functional Requirements
| ID | Requirement | Description | Priority |
|----|-------------|-------------|----------|
| FR-001 | [judul] | [deskripsi] | High/Medium/Low |

## 5. Non-Functional Requirements
| ID | Aspect | Requirement |
|----|--------|-------------|
| NFR-001 | Performance | [deskripsi] |
| NFR-002 | Security | [deskripsi] |

## 6. User Roles
| Role | Description | Access Rights |
|------|-------------|---------------|
| [role] | [deskripsi] | [hak akses] |

## 7. Business Flow
[Deskripsi alur bisnis atau diagram]

## 8. Integration Points
| System | Direction | Data | Protocol |
|--------|-----------|------|----------|
| [sistem] | Inbound/Outbound | [data] | [protocol] |

## 9. Acceptance Criteria
[Kriteria penerimaan project]`,
    visibility: "public" as const,
    isSystem: true,
  },
  {
    name: "IT Specification - Analysis & Design",
    description: "Analysis & Design Document untuk dokumentasi teknis",
    type: "analysis_design" as const,
    markdown: `# Analysis & Design Document

## Document Info
- **Project Name:** [nama project]
- **Version:** [versi]
- **Date:** [tanggal]
- **Prepared By:** [nama]

## 1. Objective
[Tujuan dokumen ini]

## 2. Current Process (As-Is)
[Deskripsi proses saat ini]

## 3. Proposed Process (To-Be)
[Deskripsi proses yang diusulkan]

## 4. Use Case Diagram
\`\`\`mermaid
graph TD
    A[Actor] --> B[Use Case 1]
    A --> C[Use Case 2]
\`\`\`

## 5. Entity Relationship Diagram
\`\`\`mermaid
erDiagram
    ENTITY1 ||--o{ ENTITY2 : relationship
\`\`\`

## 6. System Architecture
\`\`\`mermaid
graph TB
    Client --> API
    API --> Database
\`\`\`

## 7. Technology Stack
| Component | Technology | Description |
|-----------|------------|-------------|
| Frontend | [tech] | [deskripsi] |
| Backend | [tech] | [deskripsi] |
| Database | [tech] | [deskripsi] |

## 8. Sequence Diagram
\`\`\`mermaid
sequenceDiagram
    Actor->>System: Request
    System->>Database: Query
    Database-->>System: Response
    System-->>Actor: Result
\`\`\`

## 9. UI/UX Mockup
[Deskripsi atau referensi mockup]

## 10. Non-Functional Design
| Aspect | Specification |
|--------|---------------|
| Performance | [spesifikasi] |
| Security | [spesifikasi] |
| Scalability | [spesifikasi] |

## 11. Deployment Architecture
\`\`\`mermaid
graph TB
    subgraph Production
        LB[Load Balancer]
        App1[App Server 1]
        App2[App Server 2]
        DB[(Database)]
    end
\`\`\``,
    visibility: "public" as const,
    isSystem: true,
  },
  {
    name: "IT Specification - Test Scenario",
    description: "Test Scenario Document untuk dokumentasi pengujian",
    type: "test_scenario" as const,
    markdown: `# Test Scenario Document

## Document Info
- **Project Name:** [nama project]
- **Version:** [versi]
- **Date:** [tanggal]
- **Prepared By:** [nama]

## 1. Objective
[Tujuan pengujian]

## 2. Reference Documents
| Document | Version | Date |
|----------|---------|------|
| URD | [versi] | [tanggal] |
| A&D | [versi] | [tanggal] |

## 3. Test Scope

### 3.1 In Scope
- [item 1]
- [item 2]

### 3.2 Out of Scope
- [item 1]

## 4. Functional Test Scenarios
| ID | Description | URD Ref | Expected Result | Category |
|----|-------------|---------|-----------------|----------|
| TC-001 | [deskripsi] | FR-001 | [hasil] | Functional |

## 5. Non-Functional Test Scenarios
| ID | Description | Aspect | Expected Result |
|----|-------------|--------|-----------------|
| NF-001 | [deskripsi] | Performance | [hasil] |
| NF-002 | [deskripsi] | Security | [hasil] |

## 6. Test Data
| Data Type | Example | Remarks |
|-----------|---------|---------|
| [tipe data] | [contoh] | [keterangan] |

## 7. Acceptance Criteria
[Kriteria penerimaan pengujian]`,
    visibility: "public" as const,
    isSystem: true,
  },
]

// POST /api/templates/seed - Seed default templates
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const results = []
    
    for (const template of defaultTemplates) {
      // Check if already exists
      const existing = await db
        .select({ id: templates.id })
        .from(templates)
        .where(eq(templates.name, template.name))
        .limit(1)

      if (existing.length > 0) {
        results.push({ name: template.name, status: "skipped", message: "Already exists" })
        continue
      }

      // Create template
      await db.insert(templates).values({
        ...template,
        userId: session.user.id,
        isActive: true,
      })
      
      results.push({ name: template.name, status: "created" })
    }

    return NextResponse.json({ 
      message: "Seed completed",
      results 
    })
  } catch (error) {
    console.error("Error seeding templates:", error)
    return NextResponse.json(
      { error: "Failed to seed templates" },
      { status: 500 }
    )
  }
}
