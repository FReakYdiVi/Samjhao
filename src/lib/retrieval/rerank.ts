import type { MergedSearchCandidate } from "@/lib/retrieval/merge-results";
import type { RetrievalWorkflowPlan } from "@/lib/retrieval/planner";
import { markdownToPlainText, normalizeText, rankMatch, splitIntoSentences, tokenize } from "@/lib/utils/text";

export interface WorkflowRetrievedChunk extends MergedSearchCandidate {
  hybridScore: number;
  citationLabel: string;
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
  chunk: MergedSearchCandidate,
  question: string,
  focusPhrase: string | null,
  questionType: RetrievalWorkflowPlan["questionType"],
) {
  if (!focusPhrase || (questionType !== "definition" && questionType !== "explanation")) {
    return 0;
  }

  const normalizedText = normalizeText(`${chunk.section}. ${markdownToPlainText(chunk.content)}`);
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
  chunk: MergedSearchCandidate,
  focusPhrase: string | null,
  focusTerms: string[],
  questionType: RetrievalWorkflowPlan["questionType"],
) {
  const normalizedSection = normalizeText(chunk.section);
  let boost = 0;

  if (focusPhrase) {
    const normalizedFocus = normalizeText(focusPhrase).trim();
    if (normalizedFocus && normalizedSection.includes(normalizedFocus)) {
      boost += questionType === "definition" || questionType === "explanation" ? 0.46 : 0.3;
    }
  }

  const matchingTerms = focusTerms.filter((term) => normalizedSection.includes(term)).length;
  if (matchingTerms > 0) {
    boost += Math.min(0.24, matchingTerms * 0.08);
  }

  return boost;
}

function boilerplatePenalty(chunk: MergedSearchCandidate) {
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

  return patterns.reduce((penalty, pattern) => penalty + (pattern.test(text) ? 0.14 : 0), 0);
}

function isGenericChapterChunk(chunk: MergedSearchCandidate) {
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

function hasExactSectionHit(
  chunks: MergedSearchCandidate[],
  focusPhrase: string | null,
  focusTerms: string[],
) {
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

function noisyChunkPenalty(chunk: MergedSearchCandidate, question: string) {
  const normalizedContent = normalizeText(chunk.content);
  const flattened = markdownToPlainText(chunk.content);
  let penalty = 0;

  if (/data:image|base64|\/9j\/4aaq/i.test(chunk.content)) {
    penalty += 1.8;
  }

  if (/byju s the learning app|https byjus com/i.test(normalizedContent)) {
    penalty += 0.28;
  }

  if (!isVisualQuestion(question) &&
    /\b(map|image|figure|caption|colou?r|green|red|blue|yellow|shade|labelled|shown)\b/.test(
      normalizedContent,
    )) {
    penalty += 0.62;
  }

  if (
    !isVisualQuestion(question) &&
    /चित्र|मानचित्र|रंग|दिखाया|दर्शाता|मुख्य विशेषताएं|भौगोलिक विशेषताएं/.test(flattened)
  ) {
    penalty += 0.62;
  }

  if (/^the learning app$/i.test(flattened.trim())) {
    penalty += 1.2;
  }

  if (flattened.trim().length < 30) {
    penalty += 0.24;
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

function selectDiverseChunks(chunks: WorkflowRetrievedChunk[], limit: number) {
  const selected: WorkflowRetrievedChunk[] = [];

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

export function rerankSearchResults(params: {
  question: string;
  plan: RetrievalWorkflowPlan;
  candidates: MergedSearchCandidate[];
  candidateLimit?: number;
  finalLimit?: number;
  preferredDocumentId?: string | null;
}) {
  const candidateLimit = Math.max(params.candidateLimit ?? 10, 1);
  const finalLimit = Math.max(params.finalLimit ?? 5, 1);
  const focusPhrases = [
    params.plan.focusPhrase,
    ...params.plan.queryVariants
      .filter((variant) => variant.kind !== "original")
      .map((variant) => variant.text),
  ].filter(Boolean) as string[];
  const queryTexts = params.plan.queryVariants.map((variant) => variant.text);

  const scored = params.candidates.map((chunk) => {
    const flattenedText = markdownToPlainText(`${chunk.section}\n${chunk.preview}\n${chunk.content}`);
    const sentenceScore = maxSentenceMatch(flattenedText, queryTexts);
    const phraseScore = phrasePresenceScore(flattenedText, focusPhrases);
    const coverageScore = conceptCoverageScore(flattenedText, params.plan.conceptGroups);
    const introPenalty = boilerplatePenalty(chunk);
    const noisePenalty = noisyChunkPenalty(chunk, params.question);
    const sectionBoost = sectionSpecificityBoost(
      chunk,
      params.plan.focusPhrase,
      params.plan.focusTerms,
      params.plan.questionType,
    );
    const definitionBoost = definitionStyleBoost(
      chunk,
      params.question,
      params.plan.focusPhrase,
      params.plan.questionType,
    );
    const preferredBoost =
      params.preferredDocumentId && chunk.documentId === params.preferredDocumentId
        ? 0.18
        : 0;
    const multiQueryBoost = Math.min(0.18, chunk.matchedQueries.length * 0.05);

    const hybridScore =
      chunk.textScore * 0.26 +
      chunk.lexicalScore * 0.18 +
      chunk.vectorScore * 0.14 +
      chunk.mergedScore * 0.22 +
      sentenceScore * 0.16 +
      phraseScore * 0.24 +
      coverageScore * 0.18 +
      sectionBoost +
      definitionBoost +
      preferredBoost +
      multiQueryBoost -
      introPenalty -
      noisePenalty;

    return {
      ...chunk,
      hybridScore,
      citationLabel: `${chunk.documentName} · ${chunk.sourceRef}`,
    } satisfies WorkflowRetrievedChunk;
  });

  const exactSectionHitExists = hasExactSectionHit(
    scored,
    params.plan.focusPhrase,
    params.plan.focusTerms,
  );
  const adjustedScored = exactSectionHitExists
    ? scored.map((chunk) => ({
        ...chunk,
        hybridScore: chunk.hybridScore - (isGenericChapterChunk(chunk) ? 0.38 : 0),
      }))
    : scored;

  const rankedAll = adjustedScored.sort(
    (left, right) => right.hybridScore - left.hybridScore || left.rank - right.rank,
  );
  const rankedCandidates = exactSectionHitExists
    ? [
        ...rankedAll.filter((chunk) => !isGenericChapterChunk(chunk)),
        ...rankedAll.filter((chunk) => isGenericChapterChunk(chunk)),
      ].slice(0, candidateLimit)
    : rankedAll.slice(0, candidateLimit);

  return selectDiverseChunks(rankedCandidates, finalLimit);
}
