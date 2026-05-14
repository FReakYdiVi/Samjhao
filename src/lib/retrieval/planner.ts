import { getSarvamClient } from "@/lib/sarvam/client";
import {
  buildRetrievalQueryPlannerSystemPrompt,
  buildRetrievalQueryPlannerUserPrompt,
} from "@/lib/tutor/prompts";
import { normalizeText, tokenize } from "@/lib/utils/text";

export interface RetrievalQueryVariant {
  text: string;
  weight: number;
  kind: "original" | "focus" | "concept";
}

export interface RetrievalPlan {
  questionType: "definition" | "comparison" | "explanation" | "factoid";
  normalizedQuestion: string;
  focusTerms: string[];
  focusPhrase: string | null;
  conceptGroups: string[][];
  queryVariants: RetrievalQueryVariant[];
}

export interface RetrievalWorkflowPlan extends RetrievalPlan {
  plannerMode: "model" | "heuristic";
}

const QUERY_NOISE = new Set([
  "what",
  "why",
  "how",
  "tell",
  "explain",
  "define",
  "describe",
  "difference",
  "between",
  "simple",
  "simply",
  "please",
  "topic",
  "concept",
  "meaning",
  "samjhao",
  "batao",
  "samjha",
  "me",
  "about",
  "aur",
  "ka",
  "ki",
  "ke",
  "hai",
  "kya",
  "isko",
  "isko",
  "in",
  "notes",
  "according",
  "hisab",
  "hisaab",
]);

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function cleanWords(question: string) {
  return normalizeText(question)
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 1);
}

function extractFocusTerms(question: string) {
  const tokens = tokenize(question).filter((token) => !QUERY_NOISE.has(token));
  return unique(tokens).slice(0, 6);
}

function extractFocusPhrase(question: string) {
  const words = cleanWords(question).filter((word) => !QUERY_NOISE.has(word));

  if (words.length === 0) {
    return null;
  }

  if (words.length <= 4) {
    return words.join(" ");
  }

  return words.slice(0, 4).join(" ");
}

function detectComparisonGroups(question: string) {
  const normalized = normalizeText(question);
  const betweenMatch = normalized.match(/\bbetween\s+(.+?)\s+and\s+(.+)$/);

  if (betweenMatch) {
    return [betweenMatch[1], betweenMatch[2]]
      .map((part) =>
        tokenize(part).filter((token) => !QUERY_NOISE.has(token)).slice(0, 3),
      )
      .filter((group) => group.length > 0);
  }

  const versusMatch = normalized.match(/\b(.+?)\s+(?:vs|versus|aur)\s+(.+)$/);

  if (versusMatch) {
    return [versusMatch[1], versusMatch[2]]
      .map((part) =>
        tokenize(part).filter((token) => !QUERY_NOISE.has(token)).slice(0, 3),
      )
      .filter((group) => group.length > 0);
  }

  return [] as string[][];
}

export function buildRetrievalPlan(question: string): RetrievalPlan {
  const normalizedQuestion = normalizeText(question).trim();
  const focusTerms = extractFocusTerms(question);
  const focusPhrase = extractFocusPhrase(question);
  const conceptGroups = detectComparisonGroups(question);
  const isComparison = conceptGroups.length >= 2;
  const isFactoid =
    /\b(who|when|where|which|name)\b/.test(normalizedQuestion);
  const isDefinition =
    /\b(what is|meaning|define|matlab|kya hai|samjhao|explain)\b/.test(
      normalizedQuestion,
    );

  const queryVariants: RetrievalQueryVariant[] = [
    {
      text: question,
      weight: 1,
      kind: "original",
    },
  ];

  if (focusPhrase && focusPhrase !== normalizedQuestion) {
    queryVariants.push({
      text: focusPhrase,
      weight: 1.2,
      kind: "focus",
    });
  }

  if (focusTerms.length > 1) {
    queryVariants.push({
      text: focusTerms.join(" "),
      weight: 1.05,
      kind: "concept",
    });
  }

  for (const group of conceptGroups) {
    if (group.length > 0) {
      queryVariants.push({
        text: group.join(" "),
        weight: 0.92,
        kind: "concept",
      });
    }
  }

  return {
    questionType: isComparison
      ? "comparison"
      : isFactoid
        ? "factoid"
        : isDefinition
          ? "definition"
          : "explanation",
    normalizedQuestion,
    focusTerms,
    focusPhrase,
    conceptGroups,
    queryVariants: unique(queryVariants.map((variant) => JSON.stringify(variant))).map(
      (variant) => JSON.parse(variant) as RetrievalQueryVariant,
    ),
  };
}

function dedupeVariants(variants: RetrievalQueryVariant[]) {
  return unique(variants.map((variant) => JSON.stringify(variant))).map(
    (variant) => JSON.parse(variant) as RetrievalQueryVariant,
  );
}

function parsePlannerQueries(raw: string) {
  try {
    const cleaned = raw
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "");
    const parsed = JSON.parse(cleaned) as {
      searchQueries?: unknown;
    };

    if (!Array.isArray(parsed.searchQueries)) {
      return [] as string[];
    }

    return parsed.searchQueries
      .map((item) => String(item).trim())
      .filter(Boolean)
      .slice(0, 5);
  } catch {
    return [] as string[];
  }
}

function buildHeuristicSearchQueries(plan: RetrievalPlan, question: string) {
  const baseQueries = plan.queryVariants.map((variant) => variant.text);
  const exactSectionStyle =
    plan.focusPhrase && !baseQueries.includes(plan.focusPhrase)
      ? [plan.focusPhrase]
      : [];
  const yearMatches = normalizeText(question).match(/\b(1[0-9]{3}|20[0-9]{2})\b/g) ?? [];
  const yearQueries = yearMatches
    .slice(0, 2)
    .map((year) =>
      plan.focusPhrase ? `${plan.focusPhrase} ${year}` : `${question} ${year}`,
    );

  return unique([...baseQueries, ...exactSectionStyle, ...yearQueries]).slice(0, 5);
}

export async function buildRetrievalWorkflowPlan(params: {
  question: string;
  documentName?: string;
  sections?: string[];
  languageCode?: string;
}) {
  const basePlan = buildRetrievalPlan(params.question);
  const heuristicQueries = buildHeuristicSearchQueries(basePlan, params.question);
  const client = getSarvamClient();

  if (!client) {
    return {
      ...basePlan,
      queryVariants: dedupeVariants(
        heuristicQueries.map((text, index) => ({
          text,
          weight: index === 0 ? 1.22 : 1.04,
          kind: index === 0 ? "original" : "focus",
        })),
      ),
      plannerMode: "heuristic",
    } satisfies RetrievalWorkflowPlan;
  }

  try {
    const response = await client.chat.completions({
      model: "sarvam-30b",
      temperature: 0.1,
      max_tokens: 240,
      reasoning_effort: "low",
      messages: [
        {
          role: "system",
          content: buildRetrievalQueryPlannerSystemPrompt(),
        },
        {
          role: "user",
          content: buildRetrievalQueryPlannerUserPrompt(params),
        },
      ],
    });

    const plannedQueries = parsePlannerQueries(response.choices[0]?.message.content || "");
    const combinedQueries = unique([
      ...plannedQueries,
      ...heuristicQueries,
    ]).slice(0, 5);

    return {
      ...basePlan,
      queryVariants: dedupeVariants(
        combinedQueries.map((text, index) => ({
          text,
          weight: index === 0 ? 1.28 : index === 1 ? 1.14 : 1.02,
          kind: index === 0 ? "original" : text === basePlan.focusPhrase ? "focus" : "concept",
        })),
      ),
      plannerMode: "model",
    } satisfies RetrievalWorkflowPlan;
  } catch {
    return {
      ...basePlan,
      queryVariants: dedupeVariants(
        heuristicQueries.map((text, index) => ({
          text,
          weight: index === 0 ? 1.22 : 1.04,
          kind: index === 0 ? "original" : "focus",
        })),
      ),
      plannerMode: "heuristic",
    } satisfies RetrievalWorkflowPlan;
  }
}
