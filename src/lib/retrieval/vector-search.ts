import type { StoredChunk } from "@/lib/db/queries";
import { cosineSimilarity, embedQuery, hasEmbeddingProvider } from "@/lib/retrieval/embeddings";
import type { RetrievalQueryVariant } from "@/lib/retrieval/planner";

export interface VectorSearchHit extends StoredChunk {
  vectorScore: number;
  matchedQueries: string[];
  bestQuery: string;
}

function normalizeScore(value: number, maxValue: number) {
  if (!Number.isFinite(value) || maxValue <= 0) {
    return 0;
  }

  return value / maxValue;
}

export async function vectorSearch(
  queries: RetrievalQueryVariant[],
  chunks: StoredChunk[],
  options?: {
    limit?: number;
  },
) {
  if (!hasEmbeddingProvider() || chunks.length === 0 || queries.length === 0) {
    return [] as VectorSearchHit[];
  }

  const embeddedQueries = await Promise.all(
    queries.map(async (variant) => ({
      variant,
      embedding: await embedQuery(variant.text).catch(() => null),
    })),
  );

  const usableQueries = embeddedQueries.filter(
    (entry) => entry.embedding && entry.embedding.length > 0,
  ) as Array<{ variant: RetrievalQueryVariant; embedding: number[] }>;

  if (usableQueries.length === 0) {
    return [] as VectorSearchHit[];
  }

  const similarityMaps = usableQueries.map(({ embedding }) =>
    new Map(
      chunks.map((chunk) => [
        chunk.id,
        chunk.embedding.length > 0 ? cosineSimilarity(embedding, chunk.embedding) : 0,
      ]),
    ),
  );

  const maxSimilarities = similarityMaps.map((map) => Math.max(0, ...Array.from(map.values())));

  return chunks
    .map((chunk) => {
      let vectorScore = 0;
      let bestQuery = usableQueries[0]?.variant.text || "";
      let bestWeightedScore = -1;
      const matchedQueries: string[] = [];

      usableQueries.forEach(({ variant }, index) => {
        const weightedScore =
          normalizeScore(similarityMaps[index].get(chunk.id) ?? 0, maxSimilarities[index]) *
          variant.weight;

        vectorScore += weightedScore;

        if (weightedScore > bestWeightedScore) {
          bestWeightedScore = weightedScore;
          bestQuery = variant.text;
        }

        if (weightedScore >= 0.12) {
          matchedQueries.push(variant.text);
        }
      });

      return {
        ...chunk,
        vectorScore,
        matchedQueries: Array.from(new Set(matchedQueries)),
        bestQuery,
      } satisfies VectorSearchHit;
    })
    .sort((left, right) => right.vectorScore - left.vectorScore || left.rank - right.rank)
    .slice(0, Math.max(options?.limit ?? 12, 1));
}
