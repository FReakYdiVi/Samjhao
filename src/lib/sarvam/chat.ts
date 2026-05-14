import type { StoredChunk } from "@/lib/db/queries";
import type { LearnerProfile } from "@/lib/tutor/learner-profile";
import {
  buildTutorSystemPrompt,
  buildTutorUserPrompt,
  inferRequestedAnswerDepth,
} from "@/lib/tutor/prompts";
import {
  parseTutorResponse,
  type TutorResponse,
} from "@/lib/tutor/response-schema";
import {
  dedupeRepeatedSentencesPreserveBreaks,
  markdownToPlainText,
  truncateText,
} from "@/lib/utils/text";

import { getSarvamClient } from "./client";
import { ensureTextLanguage, isHindiCompliant, isHinglishCompliant } from "./language";

interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

interface LatestTutorSnapshot {
  answer: string;
  sourceSnippets: string[];
}

function needsLanguageCorrection(response: TutorResponse, profile: LearnerProfile) {
  if (profile.explanationLanguage === "hindi") {
    return !isHindiCompliant(response.answer);
  }

  if (profile.explanationLanguage === "hinglish") {
    return !isHinglishCompliant(response.answer);
  }

  return false;
}

function resolveActualResponseLanguage(
  answer: string,
  preferred: LearnerProfile["explanationLanguage"],
): TutorResponse["responseLanguage"] {
  if (preferred === "hindi" && isHindiCompliant(answer)) {
    return "hindi";
  }

  if (preferred === "hinglish" && isHinglishCompliant(answer)) {
    return "hinglish";
  }

  return "english";
}

async function enforceLanguageCompliance(params: {
  response: TutorResponse;
  profile: LearnerProfile;
}) {
  if (!needsLanguageCorrection(params.response, params.profile)) {
    return {
      ...params.response,
      responseLanguage: resolveActualResponseLanguage(
        params.response.answer,
        params.profile.explanationLanguage,
      ),
    };
  }

  try {
    if (params.profile.explanationLanguage === "hindi") {
      const [answer, audioText, suggestedFollowups] = await Promise.all([
        ensureTextLanguage(params.response.answer, "hindi"),
        ensureTextLanguage(params.response.audioText || params.response.answer, "hindi"),
        Promise.all(params.response.suggestedFollowups.map((followup) => ensureTextLanguage(followup, "hindi"))),
      ]);

      if (!answer) {
        throw new Error("Could not produce a Hindi-compliant answer.");
      }

      return sanitizeTutorResponse({
        ...params.response,
        answer,
        audioText: audioText || (() => {
          throw new Error("Could not produce Hindi audio text.");
        })(),
        suggestedFollowups: suggestedFollowups.map((followup) => {
          if (!followup) {
            throw new Error("Could not produce Hindi follow-up questions.");
          }

          return followup;
        }),
        responseLanguage: "hindi",
      });
    }

    if (params.profile.explanationLanguage === "hinglish") {
      const [answer, audioText, suggestedFollowups] = await Promise.all([
        ensureTextLanguage(params.response.answer, "hinglish"),
        ensureTextLanguage(params.response.audioText || params.response.answer, "hinglish"),
        Promise.all(params.response.suggestedFollowups.map((followup) => ensureTextLanguage(followup, "hinglish"))),
      ]);

      if (!answer) {
        throw new Error("Could not produce a Hinglish-compliant answer.");
      }

      return sanitizeTutorResponse({
        ...params.response,
        answer,
        audioText: audioText || (() => {
          throw new Error("Could not produce Hinglish audio text.");
        })(),
        suggestedFollowups: suggestedFollowups.map((followup) => {
          if (!followup) {
            throw new Error("Could not produce Hinglish follow-up questions.");
          }

          return followup;
        }),
        responseLanguage: "hinglish",
      });
    }

    return {
      ...params.response,
      responseLanguage: resolveActualResponseLanguage(
        params.response.answer,
        params.profile.explanationLanguage,
      ),
    };
  } catch {
    throw new Error("Could not localize the answer into the requested language.");
  }
}

function toPromptReadyText(input: string) {
  return truncateText(markdownToPlainText(input), 2800);
}

const translatedLabelLeakPattern =
  /\b(?:source snippets?|supporting snippets?|suggested follow(?:\s|-)?ups?|follow(?:\s|-)?ups?|confidence|srot ke ansh|srot ansh|sujhaye gaye agle prashn|agle prashn|vishwas)\b\s*:?.*$/i;

function stripTranslatedLabelLeakage(input: string) {
  const plain = dedupeRepeatedSentencesPreserveBreaks(input).trim();
  const match = plain.match(translatedLabelLeakPattern);

  if (!match?.index && match?.index !== 0) {
    return plain;
  }

  return plain.slice(0, match.index).trim();
}

function sanitizeTutorResponse(response: TutorResponse): TutorResponse {
  return {
    ...response,
    answer: stripTranslatedLabelLeakage(response.answer),
    sourceSnippets: Array.from(
      new Set(
        response.sourceSnippets
          .map((snippet) => stripTranslatedLabelLeakage(snippet))
          .filter(Boolean),
      ),
    ),
    suggestedFollowups: Array.from(
      new Set(
        response.suggestedFollowups
          .map((followup) => stripTranslatedLabelLeakage(followup))
          .filter(Boolean),
      ),
    ),
    audioText: stripTranslatedLabelLeakage(response.audioText),
  };
}

function buildSourceAppendix(chunks: StoredChunk[]) {
  return chunks
    .slice(0, 3)
    .map(
      (chunk, index) =>
        `Source ${index + 1}\nSection: ${chunk.section}\nSourceRef: ${chunk.documentName} · ${chunk.sourceRef}\nExcerpt: ${truncateText(markdownToPlainText(chunk.contextualizedContent || chunk.content), 900)}`,
    )
    .join("\n\n---\n\n");
}

function getTutorTokenBudget(question: string) {
  return inferRequestedAnswerDepth(question) === "detailed" ? 4000 : 3200;
}

function buildRetrievedContext(chunks: StoredChunk[]) {
  return chunks
    .map(
      (chunk, index) =>
        `Context ${index + 1}\nSection: ${chunk.section}\nSource: ${chunk.documentName} · ${chunk.sourceRef}\nExcerpt:\n${toPromptReadyText(chunk.contextualizedContent || chunk.content)}`,
    )
    .join("\n\n---\n\n");
}

export async function generateTutorReply(params: {
  question: string;
  profile: LearnerProfile;
  chunks: StoredChunk[];
  history?: ConversationTurn[];
  latestTutor?: LatestTutorSnapshot | null;
}) {
  const client = getSarvamClient();
  if (!client) {
    throw new Error("SARVAM_API_KEY is required to generate a tutor response.");
  }

  const tutorTokenBudget = getTutorTokenBudget(params.question);
  const retrievedContext = buildRetrievedContext(params.chunks);
  const sourceAppendix = buildSourceAppendix(params.chunks);

  const response = await client.chat.completions({
    model: "sarvam-30b",
    temperature: 0.12,
    max_tokens: tutorTokenBudget,
    reasoning_effort: "low",
    messages: [
      {
        role: "system",
        content: buildTutorSystemPrompt(params.profile),
      },
        {
          role: "user",
          content: buildTutorUserPrompt({
            question: params.question,
            profile: params.profile,
            retrievedContext,
            sourceAppendix,
            history: params.history,
            latestTutor: params.latestTutor,
        }),
      },
    ],
  });

  const message = response.choices[0]?.message;
  const content = message?.content?.trim() || "";
  const reasoningContent = message?.reasoning_content?.trim() || "";
  const parseCandidate = content || reasoningContent;
  const parsedResponse = parseTutorResponse(parseCandidate);
  const parsed = parsedResponse ? sanitizeTutorResponse(parsedResponse) : null;

  if (!parsed || parsed.answer.trim().length < 8 || parsed.answer.trim().startsWith("{")) {
    const finishReason = response.choices[0]?.finish_reason;

    if (finishReason === "length" && !content && reasoningContent) {
      throw new Error(
        "Tutor model hit the token limit in reasoning before emitting final JSON.",
      );
    }

    throw new Error("Tutor model did not return valid JSON in the required shape.");
  }

  const compliant = await enforceLanguageCompliance({
    response: {
      ...parsed,
      responseLanguage: resolveActualResponseLanguage(
        parsed.answer,
        params.profile.explanationLanguage,
      ),
      answerMode: "live",
    },
    profile: params.profile,
  });

  return {
    ...compliant,
    responseLanguage: compliant.responseLanguage,
    answerMode: "live",
  };
}
