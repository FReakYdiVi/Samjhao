import { z } from "zod";

import { learnerProfileSchema } from "./learner-profile";

export const tutorResponseSchema = z.object({
  answer: z.string().min(1),
  sourceSnippets: z.array(z.string().min(1)).max(3).default([]),
  suggestedFollowups: z.array(z.string().min(1)).max(3).default([]),
  confidence: z.number().min(0).max(1),
  audioText: z.string().min(1),
  citations: z
    .array(
      z.object({
        documentId: z.string(),
        documentName: z.string(),
        sourceRef: z.string(),
        preview: z.string(),
        retrievalScore: z.number(),
      }),
    )
    .optional(),
  retrievalMode: z
    .enum([
      "hybrid-contextual-bm25",
      "hybrid-contextual-bm25-embedding",
    ])
    .optional(),
  responseLanguage: z.enum(["hinglish", "hindi", "english"]).default("hinglish"),
  answerMode: z.enum(["live"]).optional(),
});

export type TutorResponse = z.infer<typeof tutorResponseSchema>;

export const documentSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  languageCode: z.string(),
  summary: z.string(),
  createdAt: z.string(),
  sections: z.array(z.string()),
});

export type DocumentSummary = z.infer<typeof documentSummarySchema>;

export const chatSessionSummarySchema = z.object({
  id: z.string(),
  documentId: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ChatSessionSummary = z.infer<typeof chatSessionSummarySchema>;

export const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  spokenText: z.string().nullable().optional(),
  sourceSnippets: z.array(z.string()).default([]),
  citations: tutorResponseSchema.shape.citations.default([]),
  suggestedFollowups: z.array(z.string()).default([]),
  answerMode: z.enum(["live"]).nullable().optional(),
  responseLanguage: z.enum(["hinglish", "hindi", "english"]).nullable().optional(),
  createdAt: z.string(),
});

export type StoredChatMessagePayload = z.infer<typeof chatMessageSchema>;

export const sessionStateSchema = z.object({
  hasSarvamKey: z.boolean(),
  activeDocumentId: z.string().nullable(),
  activeChatSessionId: z.string().nullable(),
  documents: z.array(documentSummarySchema),
  chatSessions: z.array(chatSessionSummarySchema),
  activeMessages: z.array(chatMessageSchema),
  sampleQuestions: z.array(z.string()),
  profileDefaults: learnerProfileSchema,
});

export type SessionState = z.infer<typeof sessionStateSchema>;

function stripJsonFence(input: string) {
  return input
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function extractJSONObject(input: string) {
  const cleaned = stripJsonFence(input);
  const startIndex = cleaned.indexOf("{");
  const endIndex = cleaned.lastIndexOf("}");

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return cleaned;
  }

  return cleaned.slice(startIndex, endIndex + 1);
}

const leakedSchemaFieldPattern =
  /\b(?:sourceSnippets|suggestedFollowups|audioText|answerMode|responseLanguage|retrievalMode|confidence)\s*:/i;

function stripLeakedSchemaFields(input: string) {
  const match = input.match(leakedSchemaFieldPattern);

  if (match?.index === undefined) {
    return input.trim();
  }

  return input.slice(0, match.index).trim();
}

function normalizeTutorJsonShape(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const raw = input as Record<string, unknown>;
  const answer =
    typeof raw.answer === "string"
      ? raw.answer
      : typeof raw.directAnswer === "string"
        ? raw.directAnswer
        : typeof raw.response === "string"
          ? raw.response
          : "";

  const sourceSnippetsRaw =
    raw.sourceSnippets ??
    raw.source_snippets ??
    raw.sources ??
    raw.snippets;
  const suggestedFollowupsRaw =
    raw.suggestedFollowups ??
    raw.suggested_followups ??
    raw.followups ??
    raw.followUpQuestions;
  const audioTextRaw =
    raw.audioText ??
    raw.audio_text ??
    raw.spokenText ??
    raw.spoken_text;
  const confidenceRaw = raw.confidence;

  const toStringArray = (value: unknown) => {
    if (Array.isArray(value)) {
      return value
        .map((item) => String(item).trim())
        .filter(Boolean);
    }

    if (typeof value === "string" && value.trim()) {
      return [value.trim()];
    }

    return [] as string[];
  };

  const normalizedConfidence =
    typeof confidenceRaw === "number"
      ? confidenceRaw
      : typeof confidenceRaw === "string"
        ? Number.parseFloat(confidenceRaw)
        : Number.NaN;

  return {
    ...raw,
    answer,
    sourceSnippets: toStringArray(sourceSnippetsRaw).slice(0, 3),
    suggestedFollowups: toStringArray(suggestedFollowupsRaw).slice(0, 3),
    confidence:
      Number.isFinite(normalizedConfidence) && normalizedConfidence >= 0 && normalizedConfidence <= 1
        ? normalizedConfidence
        : 0.62,
    audioText:
      typeof audioTextRaw === "string" && audioTextRaw.trim().length > 0
        ? audioTextRaw.trim()
        : answer,
  };
}

export function parseTutorResponse(raw: string): TutorResponse | null {
  const cleaned = extractJSONObject(raw);

  try {
    const parsed = tutorResponseSchema.parse(normalizeTutorJsonShape(JSON.parse(cleaned)));
    return {
      ...parsed,
      answer: stripLeakedSchemaFields(parsed.answer),
      audioText: stripLeakedSchemaFields(parsed.audioText || parsed.answer),
    };
  } catch {
    return null;
  }
}
