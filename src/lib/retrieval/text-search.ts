import type { StoredChunk } from "@/lib/db/queries";
import { scoreBm25 } from "@/lib/retrieval/bm25";
import type { RetrievalQueryVariant } from "@/lib/retrieval/planner";
import { rankMatch } from "@/lib/utils/text";

export interface TextSearchHit extends StoredChunk {
  textScore: number;
  lexicalScore: number;
  matchedQueries: string[];
  bestQuery: string;
}

function normalizeScore(value: number, maxValue: number) {
  if (!Number.isFinite(value) || maxValue <= 0) {
    return 0;
  }

  return value / maxValue;
}

export function textSearch(
  queries: RetrievalQueryVariant[],
  chunks: StoredChunk[],
  options?: {
    limit?: number;
  },
) {
  if (chunks.length === 0 || queries.length === 0) {
    return [] as TextSearchHit[];
  }

  const bm25Maps = queries.map((variant) =>
    scoreBm25(
      variant.text,
      chunks.map((chunk) => ({
        id: chunk.id,
        text: chunk.contextualizedContent || `${chunk.section}\n${chunk.content}`,
      })),
    ),
  );

  const lexicalMaps = queries.map((variant) =>
    new Map(
      chunks.map((chunk) => {
        const contextualScore = rankMatch(
          variant.text,
          `${chunk.documentName}\n${chunk.section}\n${chunk.contextualizedContent}`,
        );
        const exactScore = rankMatch(variant.text, `${chunk.section}\n${chunk.content}`);
        const sectionScore = rankMatch(variant.text, chunk.section);
        const summaryScore = rankMatch(variant.text, chunk.documentSummary);

        return [
          chunk.id,
          contextualScore * 0.36 +
            exactScore * 0.34 +
            sectionScore * 0.22 +
            summaryScore * 0.08,
        ];
      }),
    ),
  );

  const maxBm25 = bm25Maps.map((map) => Math.max(0, ...Array.from(map.values())));
  const maxLexical = lexicalMaps.map((map) => Math.max(0, ...Array.from(map.values())));

  return chunks
    .map((chunk) => {
      let textScore = 0;
      let lexicalScore = 0;
      let bestQuery = queries[0]?.text || "";
      let bestWeightedScore = -1;
      const matchedQueries: string[] = [];

      queries.forEach((variant, index) => {
        const normalizedBm25 =
          normalizeScore(bm25Maps[index].get(chunk.id) ?? 0, maxBm25[index]) *
          variant.weight;
        const normalizedLexical =
          normalizeScore(lexicalMaps[index].get(chunk.id) ?? 0, maxLexical[index]) *
          variant.weight;
        const weightedScore = normalizedBm25 * 0.58 + normalizedLexical * 0.42;

        textScore += normalizedBm25;
        lexicalScore += normalizedLexical;

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
        textScore,
        lexicalScore,
        matchedQueries: Array.from(new Set(matchedQueries)),
        bestQuery,
      } satisfies TextSearchHit;
    })
    .sort(
      (left, right) =>
        right.textScore + right.lexicalScore - (left.textScore + left.lexicalScore) ||
        left.rank - right.rank,
    )
    .slice(0, Math.max(options?.limit ?? 12, 1));
}
