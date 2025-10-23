// This file contains markdown generation functions that can be used on both client and server
// Note: Types are imported from spec-editor.tsx

import type {
  URDData,
  ANDData,
  TestScenarioData,
  SpecData,
} from "@/components/spec-editor";

export function urdToMarkdown(urd: URDData, summary?: string): string {
  const lines: string[] = [];

  if (summary) {
    lines.push("# Summary", "", summary, "");
  }

  lines.push("# User Requirement Document (URD)", "");
  lines.push(`**Project Name:** ${urd.projectName}`);
  lines.push(`**Date:** ${urd.date}`);
  lines.push(`**Prepared by:** ${urd.preparedBy}`);
  lines.push(`**Reviewed by:** ${urd.reviewedBy}`);
  lines.push(`**Version:** ${urd.version}`, "");

  if (urd.background) {
    lines.push("## 1. Background", "", urd.background, "");
  }
  if (urd.objective) {
    lines.push("## 2. Objective", "", urd.objective, "");
  }

  if (urd.inScope.length || urd.outOfScope.length) {
    lines.push("## 3. Scope", "");
    if (urd.inScope.length) {
      lines.push("**In Scope:**");
      urd.inScope.forEach((item) => lines.push(`- ${item}`));
      lines.push("");
    }
    if (urd.outOfScope.length) {
      lines.push("**Out of Scope:**");
      urd.outOfScope.forEach((item) => lines.push(`- ${item}`));
      lines.push("");
    }
  }

  if (urd.functionalRequirements.length) {
    lines.push("## 4. Functional Requirements", "");
    urd.functionalRequirements.forEach((fr) => {
      lines.push(`### ${fr.id}: ${fr.requirement}`);
      lines.push(`- **Description:** ${fr.description}`);
      lines.push(`- **Priority:** ${fr.priority}`, "");
    });
  }

  if (urd.nonFunctionalRequirements.length) {
    lines.push("## 5. Non-Functional Requirements", "");
    urd.nonFunctionalRequirements.forEach((nfr) => {
      lines.push(`### ${nfr.id}: ${nfr.aspect}`);
      lines.push(`${nfr.requirement}`, "");
    });
  }

  if (urd.userRoles.length) {
    lines.push("## 6. User Roles & Access", "");
    urd.userRoles.forEach((role) => {
      lines.push(`### ${role.role}`);
      lines.push(`- **Description:** ${role.description}`);
      lines.push(`- **Access Rights:** ${role.accessRights}`, "");
    });
  }

  if (urd.businessFlow) {
    lines.push("## 7. Business Flow", "", urd.businessFlow, "");
  }

  if (urd.integrationPoints.length) {
    lines.push("## 8. Integration Points", "");
    urd.integrationPoints.forEach((ip) => {
      lines.push(`### ${ip.system}`);
      lines.push(`- **Direction:** ${ip.direction}`);
      lines.push(`- **Data:** ${ip.data}`);
      lines.push(`- **Protocol:** ${ip.protocol}`, "");
    });
  }

  if (urd.acceptanceCriteria) {
    lines.push("## 9. Acceptance Criteria", "", urd.acceptanceCriteria, "");
  }

  return lines.join("\n");
}

export function analysisDesignToMarkdown(ad: ANDData): string {
  const lines: string[] = [];

  lines.push("# Analysis & Design Document (A&D)", "");
  lines.push(`**Project:** ${ad.projectName}`);
  lines.push(`**Date:** ${ad.date}`);
  lines.push(`**Version:** ${ad.version}`);
  lines.push(`**Prepared by:** ${ad.preparedBy}`, "");

  if (ad.objective) {
    lines.push("## 1. Objective", "", ad.objective, "");
  }

  if (ad.asIsProcess) {
    lines.push("## 2. Business Process Flow (AS-IS)", "", ad.asIsProcess, "");
  }

  if (ad.toBeProcess) {
    lines.push("## 3. Business Process Flow (TO-BE)", "", ad.toBeProcess, "");
  }

  if (ad.useCaseDiagram) {
    lines.push(
      "## 4. Use Case Diagram",
      "",
      "```mermaid",
      ad.useCaseDiagram,
      "```",
      ""
    );
  }

  if (ad.erdDiagram) {
    lines.push(
      "## 5. Entity Relationship Diagram (ERD)",
      "",
      "```mermaid",
      ad.erdDiagram,
      "```",
      ""
    );
  }

  if (ad.systemArchitecture) {
    lines.push(
      "## 6. System Architecture (C4 – Level 1)",
      "",
      "```mermaid",
      ad.systemArchitecture,
      "```",
      ""
    );
  }

  if (ad.containerDiagram) {
    lines.push(
      "## 7. High-Level Design (C4 – Level 2)",
      "",
      "```mermaid",
      ad.containerDiagram,
      "```",
      ""
    );
  }

  if (ad.technologyStack.length) {
    lines.push("## 8. Technology Stack", "");
    ad.technologyStack.forEach((tech) => {
      lines.push(`### ${tech.component}`);
      lines.push(`- **Technology:** ${tech.technology}`);
      lines.push(`- **Description:** ${tech.description}`, "");
    });
  }

  if (ad.sequenceDiagram) {
    lines.push(
      "## 9. Sequence Diagram",
      "",
      "```mermaid",
      ad.sequenceDiagram,
      "```",
      ""
    );
  }

  if (ad.uiUxMockup) {
    lines.push("## 10. UI/UX Mockup", "", ad.uiUxMockup, "");
  }

  if (ad.nonFunctionalDesign.length) {
    lines.push("## 11. Non-Functional Design", "");
    ad.nonFunctionalDesign.forEach((nfd) => {
      lines.push(`### ${nfd.aspect}`);
      lines.push(`${nfd.specification}`, "");
    });
  }

  if (ad.deploymentArchitecture) {
    lines.push(
      "## 12. Deployment Architecture",
      "",
      "```mermaid",
      ad.deploymentArchitecture,
      "```",
      ""
    );
  }

  return lines.join("\n");
}

export function testScenarioToMarkdown(ts: TestScenarioData): string {
  const lines: string[] = [];

  lines.push("# Test Scenario Document", "");
  lines.push(`**Project:** ${ts.projectName}`);
  lines.push(`**Version:** ${ts.version}`);
  lines.push(`**Date:** ${ts.date}`);
  lines.push(`**Prepared by:** ${ts.preparedBy}`, "");

  if (ts.objective) {
    lines.push("## 1. Objective", "", ts.objective, "");
  }

  if (ts.referenceDocuments.length) {
    lines.push("## 2. Reference Documents", "");
    ts.referenceDocuments.forEach((doc, idx) => {
      lines.push(
        `${idx + 1}. **${doc.name}** (Version ${doc.version}, ${doc.date})`
      );
    });
    lines.push("");
  }

  if (ts.inScope.length || ts.outOfScope.length) {
    lines.push("## 3. Scope", "");
    if (ts.inScope.length) {
      lines.push("**In Scope:**");
      ts.inScope.forEach((item) => lines.push(`- ${item}`));
      lines.push("");
    }
    if (ts.outOfScope.length) {
      lines.push("**Out of Scope:**");
      ts.outOfScope.forEach((item) => lines.push(`- ${item}`));
      lines.push("");
    }
  }

  if (ts.functionalScenarios.length) {
    lines.push("## 4. Functional Test Scenarios", "");
    ts.functionalScenarios.forEach((scenario) => {
      lines.push(`### ${scenario.id}: ${scenario.description}`);
      lines.push(`- **URD Reference:** ${scenario.urdReference}`);
      lines.push(`- **Expected Result:** ${scenario.expectedResult}`);
      lines.push(`- **Category:** ${scenario.category}`, "");
    });
  }

  if (ts.nonFunctionalScenarios.length) {
    lines.push("## 5. Non-Functional Test Scenarios", "");
    ts.nonFunctionalScenarios.forEach((nfts) => {
      lines.push(`### ${nfts.id}: ${nfts.description}`);
      lines.push(`- **Aspect:** ${nfts.aspect}`);
      lines.push(`- **Expected Result:** ${nfts.expectedResult}`, "");
    });
  }

  if (ts.testData.length) {
    lines.push("## 6. Test Data Requirements", "");
    ts.testData.forEach((td) => {
      lines.push(`### ${td.dataType}`);
      lines.push(`- **Example:** ${td.example}`);
      lines.push(`- **Remarks:** ${td.remarks}`, "");
    });
  }

  if (ts.acceptanceCriteria) {
    lines.push("## 7. Acceptance Criteria", "", ts.acceptanceCriteria, "");
  }

  return lines.join("\n");
}

export function specToMarkdown(spec: SpecData, summary?: string): string {
  const lines: string[] = [];

  if (summary) {
    lines.push("# Summary", "", summary, "");
  }

  // URD Section
  lines.push("---", "", "# User Requirement Document (URD)", "");
  lines.push(`**Project Name:** ${spec.urd.projectName}`);
  lines.push(`**Date:** ${spec.urd.date}`);
  lines.push(`**Prepared by:** ${spec.urd.preparedBy}`);
  lines.push(`**Reviewed by:** ${spec.urd.reviewedBy}`);
  lines.push(`**Version:** ${spec.urd.version}`, "");

  if (spec.urd.background) {
    lines.push("## 1. Background", "", spec.urd.background, "");
  }
  if (spec.urd.objective) {
    lines.push("## 2. Objective", "", spec.urd.objective, "");
  }

  if (spec.urd.inScope.length || spec.urd.outOfScope.length) {
    lines.push("## 3. Scope", "");
    if (spec.urd.inScope.length) {
      lines.push("**In Scope:**");
      spec.urd.inScope.forEach((item) => lines.push(`- ${item}`));
      lines.push("");
    }
    if (spec.urd.outOfScope.length) {
      lines.push("**Out of Scope:**");
      spec.urd.outOfScope.forEach((item) => lines.push(`- ${item}`));
      lines.push("");
    }
  }

  if (spec.urd.functionalRequirements.length) {
    lines.push("## 4. Functional Requirements", "");
    spec.urd.functionalRequirements.forEach((fr) => {
      lines.push(`### ${fr.id}: ${fr.requirement}`);
      lines.push(`- **Description:** ${fr.description}`);
      lines.push(`- **Priority:** ${fr.priority}`, "");
    });
  }

  if (spec.urd.nonFunctionalRequirements.length) {
    lines.push("## 5. Non-Functional Requirements", "");
    spec.urd.nonFunctionalRequirements.forEach((nfr) => {
      lines.push(`### ${nfr.id}: ${nfr.aspect}`);
      lines.push(`${nfr.requirement}`, "");
    });
  }

  if (spec.urd.userRoles.length) {
    lines.push("## 6. User Roles & Access", "");
    spec.urd.userRoles.forEach((role) => {
      lines.push(`### ${role.role}`);
      lines.push(`- **Description:** ${role.description}`);
      lines.push(`- **Access Rights:** ${role.accessRights}`, "");
    });
  }

  if (spec.urd.businessFlow) {
    lines.push("## 7. Business Flow", "", spec.urd.businessFlow, "");
  }

  if (spec.urd.integrationPoints.length) {
    lines.push("## 8. Integration Points", "");
    spec.urd.integrationPoints.forEach((ip) => {
      lines.push(`### ${ip.system}`);
      lines.push(`- **Direction:** ${ip.direction}`);
      lines.push(`- **Data:** ${ip.data}`);
      lines.push(`- **Protocol:** ${ip.protocol}`, "");
    });
  }

  if (spec.urd.acceptanceCriteria) {
    lines.push(
      "## 9. Acceptance Criteria",
      "",
      spec.urd.acceptanceCriteria,
      ""
    );
  }

  // A&D Section
  lines.push("---", "", "# Analysis & Design Document (A&D)", "");
  lines.push(`**Project:** ${spec.analysisDesign.projectName}`);
  lines.push(`**Date:** ${spec.analysisDesign.date}`);
  lines.push(`**Version:** ${spec.analysisDesign.version}`);
  lines.push(`**Prepared by:** ${spec.analysisDesign.preparedBy}`, "");

  if (spec.analysisDesign.objective) {
    lines.push("## 1. Objective", "", spec.analysisDesign.objective, "");
  }

  if (spec.analysisDesign.asIsProcess) {
    lines.push(
      "## 2. Business Process Flow (AS-IS)",
      "",
      spec.analysisDesign.asIsProcess,
      ""
    );
  }

  if (spec.analysisDesign.toBeProcess) {
    lines.push(
      "## 3. Business Process Flow (TO-BE)",
      "",
      spec.analysisDesign.toBeProcess,
      ""
    );
  }

  if (spec.analysisDesign.useCaseDiagram) {
    lines.push(
      "## 4. Use Case Diagram",
      "",
      "```mermaid",
      spec.analysisDesign.useCaseDiagram,
      "```",
      ""
    );
  }

  if (spec.analysisDesign.erdDiagram) {
    lines.push(
      "## 5. Entity Relationship Diagram (ERD)",
      "",
      "```mermaid",
      spec.analysisDesign.erdDiagram,
      "```",
      ""
    );
  }

  if (spec.analysisDesign.systemArchitecture) {
    lines.push(
      "## 6. System Architecture (C4 – Level 1)",
      "",
      "```mermaid",
      spec.analysisDesign.systemArchitecture,
      "```",
      ""
    );
  }

  if (spec.analysisDesign.containerDiagram) {
    lines.push(
      "## 7. High-Level Design (C4 – Level 2)",
      "",
      "```mermaid",
      spec.analysisDesign.containerDiagram,
      "```",
      ""
    );
  }

  if (spec.analysisDesign.technologyStack.length) {
    lines.push("## 8. Technology Stack", "");
    spec.analysisDesign.technologyStack.forEach((tech) => {
      lines.push(`### ${tech.component}`);
      lines.push(`- **Technology:** ${tech.technology}`);
      lines.push(`- **Description:** ${tech.description}`, "");
    });
  }

  if (spec.analysisDesign.sequenceDiagram) {
    lines.push(
      "## 9. Sequence Diagram",
      "",
      "```mermaid",
      spec.analysisDesign.sequenceDiagram,
      "```",
      ""
    );
  }

  if (spec.analysisDesign.uiUxMockup) {
    lines.push("## 10. UI/UX Mockup", "", spec.analysisDesign.uiUxMockup, "");
  }

  if (spec.analysisDesign.nonFunctionalDesign.length) {
    lines.push("## 11. Non-Functional Design", "");
    spec.analysisDesign.nonFunctionalDesign.forEach((nfd) => {
      lines.push(`### ${nfd.aspect}`);
      lines.push(`${nfd.specification}`, "");
    });
  }

  if (spec.analysisDesign.deploymentArchitecture) {
    lines.push(
      "## 12. Deployment Architecture",
      "",
      "```mermaid",
      spec.analysisDesign.deploymentArchitecture,
      "```",
      ""
    );
  }

  // Test Scenario Section
  lines.push("---", "", "# Test Scenario Document", "");
  lines.push(`**Project:** ${spec.testScenario.projectName}`);
  lines.push(`**Version:** ${spec.testScenario.version}`);
  lines.push(`**Date:** ${spec.testScenario.date}`);
  lines.push(`**Prepared by:** ${spec.testScenario.preparedBy}`, "");

  if (spec.testScenario.objective) {
    lines.push("## 1. Objective", "", spec.testScenario.objective, "");
  }

  if (spec.testScenario.referenceDocuments.length) {
    lines.push("## 2. Reference Documents", "");
    spec.testScenario.referenceDocuments.forEach((doc, idx) => {
      lines.push(
        `${idx + 1}. **${doc.name}** (Version ${doc.version}, ${doc.date})`
      );
    });
    lines.push("");
  }

  if (spec.testScenario.inScope.length || spec.testScenario.outOfScope.length) {
    lines.push("## 3. Scope", "");
    if (spec.testScenario.inScope.length) {
      lines.push("**In Scope:**");
      spec.testScenario.inScope.forEach((item) => lines.push(`- ${item}`));
      lines.push("");
    }
    if (spec.testScenario.outOfScope.length) {
      lines.push("**Out of Scope:**");
      spec.testScenario.outOfScope.forEach((item) => lines.push(`- ${item}`));
      lines.push("");
    }
  }

  if (spec.testScenario.functionalScenarios.length) {
    lines.push("## 4. Functional Test Scenarios", "");
    spec.testScenario.functionalScenarios.forEach((scenario) => {
      lines.push(`### ${scenario.id}: ${scenario.description}`);
      lines.push(`- **URD Reference:** ${scenario.urdReference}`);
      lines.push(`- **Expected Result:** ${scenario.expectedResult}`);
      lines.push(`- **Category:** ${scenario.category}`, "");
    });
  }

  if (spec.testScenario.nonFunctionalScenarios.length) {
    lines.push("## 5. Non-Functional Test Scenarios", "");
    spec.testScenario.nonFunctionalScenarios.forEach((nfts) => {
      lines.push(`### ${nfts.id}: ${nfts.description}`);
      lines.push(`- **Aspect:** ${nfts.aspect}`);
      lines.push(`- **Expected Result:** ${nfts.expectedResult}`, "");
    });
  }

  if (spec.testScenario.testData.length) {
    lines.push("## 6. Test Data Requirements", "");
    spec.testScenario.testData.forEach((td) => {
      lines.push(`### ${td.dataType}`);
      lines.push(`- **Example:** ${td.example}`);
      lines.push(`- **Remarks:** ${td.remarks}`, "");
    });
  }

  if (spec.testScenario.acceptanceCriteria) {
    lines.push(
      "## 7. Acceptance Criteria",
      "",
      spec.testScenario.acceptanceCriteria,
      ""
    );
  }

  return lines.join("\n");
}
