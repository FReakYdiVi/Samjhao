import { getChunksForDocument, type StoredDocument } from "@/lib/db/queries";
import type { DocumentSummary } from "@/lib/tutor/response-schema";

export function toDocumentSummary(document: StoredDocument): DocumentSummary {
  const chunks = getChunksForDocument(document.id);
  const sections = Array.from(new Set(chunks.map((chunk) => chunk.section))).slice(0, 6);

  return {
    id: document.id,
    name: document.name,
    mimeType: document.mimeType,
    languageCode: document.languageCode,
    summary: document.summary,
    createdAt: document.createdAt,
    sections,
  };
}
