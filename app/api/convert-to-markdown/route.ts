import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

// Suppress pdfjs warnings
const originalWarn = console.warn;
const originalLog = console.log;

function suppressPdfWarnings(message: any) {
  const msg = String(message);
  if (
    msg.includes("Setting up fake worker") ||
    msg.includes("Warning:") ||
    msg.includes("Unsupported:") ||
    msg.includes("NOT valid")
  ) {
    return;
  }
  originalWarn(message);
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only PDF and DOCX are supported." },
        { status: 400 }
      );
    }

    // Get file data as ArrayBuffer and Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    // Also provide a Node Buffer for libraries that expect it (mammoth in Node)
    const nodeBuffer = Buffer.from(uint8Array);

    // Convert based on file type
    let markdown = "";

    if (file.type === "application/pdf") {
      // Use unpdf.extractText for server-side PDF text extraction
      console.warn = suppressPdfWarnings;
      try {
        // @ts-ignore: optional runtime dependency, may not have types
        const { extractText } = (await import("unpdf")) as any;
        // extractText accepts Uint8Array
        const { text, totalPages } = await extractText(uint8Array as Uint8Array);
        // text may be array of per-page strings or a single string
        const pageText = Array.isArray(text) ? text.join("\n\n") : text;
        markdown = convertTextToMarkdown(pageText as string);
      } finally {
        console.warn = originalWarn;
      }
    } else if (
      file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      // Convert DOCX to HTML first, then to markdown
      const mammoth = await import("mammoth");
      const result = await mammoth.convertToHtml({ buffer: nodeBuffer });
      markdown = convertHtmlToMarkdown(result.value);
    }

    return NextResponse.json({
      markdown,
      filename: file.name,
    });
  } catch (error) {
    console.error("Error converting file:", error);
    return NextResponse.json(
      { error: "Failed to convert file to markdown" },
      { status: 500 }
    );
  }
}

// Helper function to convert plain text to markdown
function convertTextToMarkdown(text: string): string {
  // Split into lines
  const lines = text.split("\n");
  let markdown = "";
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      if (inList) {
        inList = false;
      }
      markdown += "\n";
      continue;
    }

    // Detect headers (lines in all caps or with specific patterns)
    if (
      line === line.toUpperCase() &&
      line.length < 100 &&
      /^[A-Z\s]+$/.test(line)
    ) {
      markdown += `## ${line}\n\n`;
      inList = false;
    }
    // Detect numbered lists
    else if (/^\d+[\.\)]/.test(line)) {
      const content = line.replace(/^\d+[\.\)]\s*/, "");
      markdown += `${line.match(/^\d+/)![0]}. ${content}\n`;
      inList = true;
    }
    // Detect bullet points
    else if (/^[•\-\*]/.test(line)) {
      const content = line.replace(/^[•\-\*]\s*/, "");
      markdown += `- ${content}\n`;
      inList = true;
    }
    // Regular paragraphs
    else {
      if (inList) {
        markdown += "\n";
        inList = false;
      }
      markdown += `${line}\n\n`;
    }
  }

  return markdown.trim();
}

// Helper function to convert HTML to markdown
function convertHtmlToMarkdown(html: string): string {
  let markdown = html;

  // Convert headings
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n");
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n");
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n");
  markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n");
  markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, "##### $1\n\n");
  markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, "###### $1\n\n");

  // Convert bold
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");

  // Convert italic
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");

  // Convert links
  markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");

  // Convert lists
  markdown = markdown.replace(/<ul[^>]*>/gi, "\n");
  markdown = markdown.replace(/<\/ul>/gi, "\n");
  markdown = markdown.replace(/<ol[^>]*>/gi, "\n");
  markdown = markdown.replace(/<\/ol>/gi, "\n");
  markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");

  // Convert paragraphs
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n");

  // Convert line breaks
  markdown = markdown.replace(/<br\s*\/?>/gi, "\n");

  // Remove remaining HTML tags
  markdown = markdown.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  markdown = markdown
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Clean up extra whitespace
  markdown = markdown.replace(/\n{3,}/g, "\n\n").trim();

  return markdown;
}
