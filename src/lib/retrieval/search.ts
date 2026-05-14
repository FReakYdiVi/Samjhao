import type { StoredChunk } from "@/lib/db/queries";
import { scoreBm25 } from "@/lib/retrieval/bm25";
import { cosineSimilarity } from "@/lib/retrieval/embeddings";
import { buildRetrievalPlan } from "@/lib/retrieval/planner";
import {
  markdownToPlainText,
  normalizeText,
  rankMatch,
  splitIntoSentences,
  tokenize,
} from "@/lib/utils/text";

export interface HybridRetrievedChunk extends StoredChunk {
  bm25Score: number;
  lexicalScore: number;
  vectorScore: number;
  hybridScore: number;
  citationLabel: string;
}

interface QuestionTypeOptions {
  questionType: "definition" | "comparison" | "explanation" | "factoid";
}

function normalizeScore(value: number, maxValue: number) {
  if (!Number.isFinite(value) || maxValue <= 0) {
    return 0;
  }

  return value / maxValue;
}

function maxSentenceMatch(text: string, queries: string[]) {
  const sentences = splitIntoSentences(text);

  if (sentences.length === 0) {
    return 0;
  }

  let best = 0;

  for (const sentence of sentences) {
    for (const query of queries) {
      best = Math.max(best, rankMatch(query, sentence));
    }
  }

  return best;
}

function phrasePresenceScore(text: string, phrases: string[]) {
  const normalizedText = normalizeText(text);

  let score = 0;
  for (const phrase of phrases) {
    const normalizedPhrase = normalizeText(phrase).trim();

    if (normalizedPhrase && normalizedText.includes(normalizedPhrase)) {
      score += normalizedPhrase.split(/\s+/).length >= 3 ? 0.22 : 0.12;
    }
  }

  return score;
}

function conceptCoverageScore(text: string, conceptGroups: string[][]) {
  if (conceptGroups.length === 0) {
    return 0;
  }

  const textTokens = new Set(tokenize(text));
  let coveredGroups = 0;

  for (const group of conceptGroups) {
    if (group.some((token) => textTokens.has(token))) {
      coveredGroups += 1;
    }
  }

  return coveredGroups / conceptGroups.length;
}

function isVisualQuestion(question: string) {
  const normalized = normalizeText(question);
  return /\b(map|image|figure|visual|diagram|chart|picture|photo|caption|poster|painting|print)\b/.test(
    normalized,
  );
}

function definitionStyleBoost(
  chunk: StoredChunk,
  question: string,
  focusPhrase: string | null,
  questionType: QuestionTypeOptions["questionType"],
) {
  if (!focusPhrase || (questionType !== "definition" && questionType !== "explanation")) {
    return 0;
  }

  const normalizedText = normalizeText(
    `${chunk.section}. ${markdownToPlainText(chunk.content)}`,
  );
  const normalizedFocus = normalizeText(focusPhrase).trim();

  if (!normalizedFocus || !normalizedText.includes(normalizedFocus)) {
    return 0;
  }

  const definitionPatterns = [
    `${normalizedFocus} is`,
    `${normalizedFocus} was`,
    `${normalizedFocus} refers to`,
    `${normalizedFocus} means`,
    `${normalizedFocus} emerged as`,
  ];

  if (definitionPatterns.some((pattern) => normalizedText.includes(pattern))) {
    return 0.32;
  }

  return rankMatch(question, `${chunk.section}\n${chunk.preview}`) * 0.12;
}

function sectionSpecificityBoost(
  chunk: StoredChunk,
  focusPhrase: string | null,
  focusTerms: string[],
  questionType: QuestionTypeOptions["questionType"],
) {
  const normalizedSection = normalizeText(chunk.section);
  let boost = 0;

  if (focusPhrase) {
    const normalizedFocus = normalizeText(focusPhrase).trim();
    if (normalizedFocus && normalizedSection.includes(normalizedFocus)) {
      boost += questionType === "definition" || questionType === "explanation" ? 0.44 : 0.28;
    }
  }

  const matchingTerms = focusTerms.filter((term) => normalizedSection.includes(term)).length;
  if (matchingTerms > 0) {
    boost += Math.min(0.24, matchingTerms * 0.08);
  }

  return boost;
}

function boilerplatePenalty(chunk: StoredChunk) {
  const text = normalizeText(
    `${chunk.section}\n${chunk.preview}\n${chunk.content.slice(0, 420)}`,
  );
  const patterns = [
    /\bchapter\s+\d+\b/,
    /\bthis chapter\b/,
    /\btopics covered\b/,
    /\bdeals with\b/,
    /\bwill look at\b/,
    /\bintroduction\b/,
    /\boverview\b/,
    /\blearning objectives\b/,
    /\bvisualised by\b/,
  ];

  return patterns.reduce(
    (penalty, pattern) => penalty + (pattern.test(text) ? 0.14 : 0),
    0,
  );
}

function isGenericChapterChunk(chunk: StoredChunk) {
  const sectionText = normalizeText(chunk.section);
  const combined = normalizeText(`${chunk.section}\n${chunk.preview}\n${chunk.content.slice(0, 220)}`);

  return (
    /\bchapter\s+\d+\b/.test(sectionText) ||
    /\boverview\b/.test(sectionText) ||
    /\bchapter\s+\d+\b/.test(combined) ||
    /\bthis chapter\b/.test(combined) ||
    /\btopics covered\b/.test(combined) ||
    /\bdeals with\b/.test(combined) ||
    /\bwill look at\b/.test(combined)
  );
}

function hasExactSectionHit(chunks: StoredChunk[], focusPhrase: string | null, focusTerms: string[]) {
  const normalizedFocus = normalizeText(focusPhrase || "").trim();

  return chunks.some((chunk) => {
    const normalizedSection = normalizeText(chunk.section);

    if (normalizedFocus && normalizedSection.includes(normalizedFocus)) {
      return true;
    }

    const matchingTerms = focusTerms.filter((term) => normalizedSection.includes(term)).length;
    return matchingTerms >= 2;
  });
}

function noisyChunkPenalty(chunk: StoredChunk, question: string) {
  const normalizedContent = normalizeText(chunk.content);
  const flattened = markdownToPlainText(chunk.content);
  let penalty = 0;

  if (/data:image|base64|\/9j\/4aaq/i.test(chunk.content)) {
    penalty += 1.8;
  }

  if (/byju s the learning app|https byjus com/i.test(normalizedContent)) {
    penalty += 0.18;
  }

  if (
    !isVisualQuestion(question) &&
    /\b(map|image|figure|caption|colou?r|green|red|blue|yellow|shade|labelled|shown)\b/.test(
      normalizedContent,
    )
  ) {
    penalty += 0.62;
  }

  if (
    !isVisualQuestion(question) &&
    /चित्र|मानचित्र|रंग|दिखाया|दर्शाता|मुख्य विशेषताएं|भौगोलिक विशेषताएं/.test(
      flattened,
    )
  ) {
    penalty += 0.62;
  }

  const bulletCount = (chunk.content.match(/[-*]\s+/g) ?? []).length;
  if (bulletCount >= 4) {
    penalty += 0.28;
  }

  const commaCount = (flattened.match(/,/g) ?? []).length;
  if (commaCount >= 12) {
    penalty += 0.18;
  }

  if (flattened.trim().length < 40) {
    penalty += 0.18;
  }

  return penalty;
}

function jaccardSimilarity(left: string, right: string) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

function selectDiverseChunks(chunks: HybridRetrievedChunk[], limit: number) {
  const selected: HybridRetrievedChunk[] = [];

  for (const candidate of chunks) {
    const isNearDuplicate = selected.some((chosen) => {
      const similarity = jaccardSimilarity(
        `${candidate.section} ${candidate.preview}`,
        `${chosen.section} ${chosen.preview}`,
      );

      return similarity > 0.72;
    });

    if (!isNearDuplicate) {
      selected.push(candidate);
    }

    if (selected.length >= limit) {
      break;
    }
  }

  if (selected.length >= limit) {
    return selected;
  }

  for (const candidate of chunks) {
    if (!selected.find((selectedChunk) => selectedChunk.id === candidate.id)) {
      selected.push(candidate);
    }

    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

export function findRelevantChunks(
  question: string,
  chunks: StoredChunk[],
  options?: {
    candidateLimit?: number;
    finalLimit?: number;
    preferredDocumentId?: string | null;
    queryEmbedding?: number[] | null;
  },
) {
  const candidateLimit = Math.max(options?.candidateLimit ?? 10, 1);
  const finalLimit = Math.max(options?.finalLimit ?? 5, 1);
  const plan = buildRetrievalPlan(question);
  const candidateChunks =
    options?.preferredDocumentId
      ? chunks.filter((chunk) => chunk.documentId === options.preferredDocumentId)
      : chunks;

  if (candidateChunks.length === 0) {
    return [] as HybridRetrievedChunk[];
  }

  const queryVariants = plan.queryVariants.length > 0
    ? plan.queryVariants
    : [{ text: question, weight: 1, kind: "original" as const }];

  const bm25Maps = queryVariants.map((variant) =>
    scoreBm25(
      variant.text,
      candidateChunks.map((chunk) => ({
        id: chunk.id,
        text: chunk.contextualizedContent || `${chunk.section}\n${chunk.content}`,
      })),
    ),
  );

  const lexicalMaps = queryVariants.map((variant) =>
    new Map(
      candidateChunks.map((chunk) => {
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

  const vectorMaps = queryVariants.map(
    () =>
      new Map(
        candidateChunks.map((chunk) => [
          chunk.id,
          options?.queryEmbedding && chunk.embedding.length > 0
            ? cosineSimilarity(options.queryEmbedding, chunk.embedding)
            : 0,
        ]),
      ),
  );

  const maxBm25 = bm25Maps.map((map) => Math.max(0, ...Array.from(map.values())));
  const maxLexical = lexicalMaps.map((map) => Math.max(0, ...Array.from(map.values())));
  const maxVector = vectorMaps.map((map) => Math.max(0, ...Array.from(map.values())));
  const focusPhrases = [
    plan.focusPhrase,
    ...plan.queryVariants
      .filter((variant) => variant.kind !== "original")
      .map((variant) => variant.text),
  ].filter(Boolean) as string[];

  const scored = candidateChunks.map((chunk) => {
    const flattenedText = markdownToPlainText(
      `${chunk.section}\n${chunk.preview}\n${chunk.content}`,
    );

    let bm25Score = 0;
    let lexicalScore = 0;
    let vectorScore = 0;

    queryVariants.forEach((variant, index) => {
      bm25Score +=
        normalizeScore(bm25Maps[index].get(chunk.id) ?? 0, maxBm25[index]) *
        variant.weight;
      lexicalScore +=
        normalizeScore(lexicalMaps[index].get(chunk.id) ?? 0, maxLexical[index]) *
        variant.weight;
      vectorScore +=
        normalizeScore(vectorMaps[index].get(chunk.id) ?? 0, maxVector[index]) *
        variant.weight;
    });

    const sentenceScore = maxSentenceMatch(
      flattenedText,
      queryVariants.map((variant) => variant.text),
    );
    const phraseScore = phrasePresenceScore(flattenedText, focusPhrases);
    const coverageScore = conceptCoverageScore(flattenedText, plan.conceptGroups);
    const introPenalty = boilerplatePenalty(chunk);
    const noisePenalty = noisyChunkPenalty(chunk, question);
    const sectionBoost = sectionSpecificityBoost(
      chunk,
      plan.focusPhrase,
      plan.focusTerms,
      plan.questionType,
    );
    const definitionBoost = definitionStyleBoost(
      chunk,
      question,
      plan.focusPhrase,
      plan.questionType,
    );
    const preferredBoost =
      options?.preferredDocumentId && chunk.documentId === options.preferredDocumentId
        ? 0.18
        : 0;

    const hybridScore =
      bm25Score * 0.34 +
      lexicalScore * 0.27 +
      vectorScore * 0.12 +
      sentenceScore * 0.16 +
      phraseScore * 0.24 +
      coverageScore * 0.18 +
      sectionBoost +
      definitionBoost +
      preferredBoost -
      introPenalty -
      noisePenalty;

    return {
      ...chunk,
      bm25Score,
      lexicalScore,
      vectorScore,
      hybridScore,
      citationLabel: `${chunk.documentName} · ${chunk.sourceRef}`,
    } satisfies HybridRetrievedChunk;
  });

  const exactSectionHitExists = hasExactSectionHit(scored, plan.focusPhrase, plan.focusTerms);
  const adjustedScored = exactSectionHitExists
    ? scored.map((chunk) => ({
        ...chunk,
        hybridScore:
          chunk.hybridScore - (isGenericChapterChunk(chunk) ? 0.36 : 0),
      }))
    : scored;

  const rankedAll = adjustedScored
    .sort((a, b) => b.hybridScore - a.hybridScore || a.rank - b.rank)
  const rankedCandidates = exactSectionHitExists
    ? [
        ...rankedAll.filter((chunk) => !isGenericChapterChunk(chunk)),
        ...rankedAll.filter((chunk) => isGenericChapterChunk(chunk)),
      ].slice(0, candidateLimit)
    : rankedAll.slice(0, candidateLimit);

  return selectDiverseChunks(rankedCandidates, finalLimit);
}
