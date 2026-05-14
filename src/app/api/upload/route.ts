import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { z } from "zod";

import { insertDocument, listDocuments, replaceChunksForDocument } from "@/lib/db/queries";
import { embedTexts } from "@/lib/retrieval/embeddings";
import { contextualizeSections } from "@/lib/retrieval/contextualize";
import {
  deriveSectionRecords,
  extractDocumentText,
  persistExtractedMarkdown,
} from "@/lib/sarvam/document-intelligence";
import { toDocumentSummary } from "@/lib/tutor/session";
import { saveUploadedFile } from "@/lib/utils/file";

export const runtime = "nodejs";
const MAX_DOCUMENTS = 3;
const PDF_MIME_TYPE = "application/pdf";

const demoPayloadSchema = z.object({
  demo: z.boolean(),
});

async function createDocumentRecord(params: {
  fileName: string;
  mimeType: string;
  storagePath: string;
  markdown: string;
  summary: string;
  languageCode: string;
  sourceType: string;
}) {
  const extractedPath = await persistExtractedMarkdown(params.fileName, params.markdown);
  const document = insertDocument({
    name: params.fileName,
    mimeType: params.mimeType,
    storagePath: params.storagePath,
    extractedPath,
    languageCode: params.languageCode,
    sourceType: params.sourceType,
    summary: params.summary,
  });

  if (!document) {
    throw new Error("Could not store the uploaded document.");
  }

  const derivedSections = deriveSectionRecords(params.markdown);
  const contextualizedSections = await contextualizeSections({
    documentName: params.fileName,
    documentSummary: params.summary,
    languageCode: params.languageCode,
    sections: derivedSections,
  });

  try {
    const embeddings = await embedTexts(
      contextualizedSections.map((section) => ({
        text: section.contextualizedContent || section.content,
        title: `${params.fileName} · ${section.section}`,
      })),
      { taskType: "RETRIEVAL_DOCUMENT" },
    );

    if (embeddings && embeddings.length === contextualizedSections.length) {
      embeddings.forEach((embedding, index) => {
        contextualizedSections[index] = {
          ...contextualizedSections[index],
          embedding,
        };
      });
    }
  } catch {
    // Keep ingestion resilient when the embedding provider is unavailable.
  }

  replaceChunksForDocument(document.id, contextualizedSections);
  return document;
}

export async function POST(request: Request) {
  try {
    const existingDocuments = listDocuments();

    if (request.headers.get("content-type")?.includes("application/json")) {
      const payload = demoPayloadSchema.parse(await request.json());
      if (!payload.demo) {
        throw new Error("Unsupported upload request.");
      }

      const existingDemo = existingDocuments.find(
        (document) =>
          document.sourceType === "demo" && document.name === "demo-physics-notes.md",
      );
      if (existingDemo) {
        return NextResponse.json({ document: toDocumentSummary(existingDemo) });
      }

      if (existingDocuments.length >= MAX_DOCUMENTS) {
        return NextResponse.json(
          {
            error:
              "Samjhao currently supports up to 3 uploaded PDFs. Remove an older one before adding more.",
          },
          { status: 400 },
        );
      }

      const demoPath = path.join(
        process.cwd(),
        "data",
        "extracted",
        "demo-physics-notes.md",
      );
      const markdown = await readFile(demoPath, "utf8");
      const document = await createDocumentRecord({
        fileName: "demo-physics-notes.md",
        mimeType: "text/markdown",
        storagePath: demoPath,
        markdown,
        summary:
          "A short physics note about current, voltage, resistance, and Ohm's law.",
        languageCode: "hi-IN",
        sourceType: "demo",
      });

      return NextResponse.json({ document: toDocumentSummary(document) });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const languageCode = String(formData.get("languageCode") || "hi-IN");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Please upload a valid file." }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    const isPdf =
      file.type === PDF_MIME_TYPE || lowerName.endsWith(".pdf");

    if (!isPdf) {
      return NextResponse.json(
        { error: "Only PDF uploads are supported right now." },
        { status: 400 },
      );
    }

    if (existingDocuments.length >= MAX_DOCUMENTS) {
      return NextResponse.json(
        {
          error:
            "Samjhao currently supports up to 3 uploaded PDFs. Remove an older one before adding more.",
        },
        { status: 400 },
      );
    }

    const saved = await saveUploadedFile(file);
    const extracted = await extractDocumentText({
      filePath: saved.filePath,
      fileName: saved.fileName,
      mimeType: saved.mimeType,
      languageCode,
      contentHash: saved.contentHash,
    });

    const document = await createDocumentRecord({
      fileName: saved.fileName,
      mimeType: saved.mimeType,
      storagePath: saved.filePath,
      markdown: extracted.markdown,
      summary: extracted.summary,
      languageCode,
      sourceType: "upload",
    });

    return NextResponse.json({ document: toDocumentSummary(document) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not process that upload.",
      },
      { status: 500 },
    );
  }
}
