import type { StoredChunk } from "@/lib/db/queries";
import type { TextSearchHit } from "@/lib/retrieval/text-search";
import type { VectorSearchHit } from "@/lib/retrieval/vector-search";

export interface MergedSearchCandidate extends StoredChunk {
  textScore: number;
  lexicalScore: number;
  vectorScore: number;
  mergedScore: number;
  matchedQueries: string[];
  bestQuery: string;
}

export function mergeSearchResults(
  textHits: TextSearchHit[],
  vectorHits: VectorSearchHit[],
) {
  const merged = new Map<string, MergedSearchCandidate>();

  for (const hit of textHits) {
    merged.set(hit.id, {
      ...hit,
      vectorScore: 0,
      mergedScore: hit.textScore * 0.62 + hit.lexicalScore * 0.38,
      matchedQueries: hit.matchedQueries,
      bestQuery: hit.bestQuery,
    });
  }

  for (const hit of vectorHits) {
    const existing = merged.get(hit.id);

    if (existing) {
      merged.set(hit.id, {
        ...existing,
        vectorScore: hit.vectorScore,
        mergedScore: existing.mergedScore + hit.vectorScore * 0.52,
        matchedQueries: Array.from(new Set([...existing.matchedQueries, ...hit.matchedQueries])),
        bestQuery: existing.mergedScore >= hit.vectorScore ? existing.bestQuery : hit.bestQuery,
      });
      continue;
    }

    merged.set(hit.id, {
      ...hit,
      textScore: 0,
      lexicalScore: 0,
      mergedScore: hit.vectorScore,
      matchedQueries: hit.matchedQueries,
      bestQuery: hit.bestQuery,
    });
  }

  return Array.from(merged.values()).sort(
    (left, right) => right.mergedScore - left.mergedScore || left.rank - right.rank,
  );
}
