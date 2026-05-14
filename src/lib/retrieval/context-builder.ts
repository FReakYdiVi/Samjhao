import type { StoredChunk } from "@/lib/db/queries";

export function buildContextPreview(chunks: StoredChunk[]) {
  return chunks
    .map(
      (chunk, index) =>
        `Snippet ${index + 1} · ${chunk.sourceRef}\n${chunk.content}`,
    )
    .join("\n\n---\n\n");
}
