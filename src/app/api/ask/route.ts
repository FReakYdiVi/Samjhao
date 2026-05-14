import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createChatSession,
  getChunksForDocument,
  getChatSessionById,
  getDocumentById,
  insertChatMessage,
  updateChatSessionTitle,
  updateChunkEmbeddings,
} from "@/lib/db/queries";
import { runAskRetrievalWorkflow } from "@/lib/retrieval/ask-workflow";
import { embedTexts, hasEmbeddingProvider } from "@/lib/retrieval/embeddings";
import { generateTutorReply } from "@/lib/sarvam/chat";
import { transliterateToRomanIfNeeded } from "@/lib/sarvam/transliteration";
import { learnerProfileSchema } from "@/lib/tutor/learner-profile";
import { tutorResponseSchema } from "@/lib/tutor/response-schema";
import {
  markdownToPlainText,
  rankMatch,
  splitIntoSentences,
  truncateText,
} from "@/lib/utils/text";

export const runtime = "nodejs";

function dedupeCitations(
  question: string,
  citations: Array<{
    documentId: string;
    documentName: string;
    sourceRef: string;
    preview: string;
    retrievalScore: number;
  }>,
) {
  const uniqueCitations = new Map<
    string,
    {
      documentId: string;
      documentName: string;
      sourceRef: string;
      preview: string;
      retrievalScore: number;
    }
  >();

  for (const citation of citations) {
    const key = `${citation.documentId}::${citation.sourceRef}`;
    const existing = uniqueCitations.get(key);

    if (!existing || citation.retrievalScore > existing.retrievalScore) {
      uniqueCitations.set(key, citation);
    }
  }

  return Array.from(uniqueCitations.values()).sort(
    (left, right) => rankCitationMatch(question, right) - rankCitationMatch(question, left),
  );
}

function rankCitationMatch(question: string, citation: {
  sourceRef: string;
  preview: string;
  retrievalScore: number;
}) {
  const combined = markdownToPlainText(`${citation.sourceRef} ${citation.preview}`).toLowerCase();
  const normalizedQuestion = markdownToPlainText(question).toLowerCase();
  const chapterPenalty = /\bchapter\s+\d+\b/.test(combined) ? 0.08 : 0;
  const directMatch = combined.includes(normalizedQuestion) ? 0.12 : 0;

  return (
    citation.retrievalScore + directMatch - chapterPenalty
  );
}

function bestSentencePreview(question: string, chunk: {
  section: string;
  preview: string;
  content: string;
}) {
  const sentences = splitIntoSentences(chunk.content)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 30);

  if (sentences.length === 0) {
    return truncateText(markdownToPlainText(chunk.preview || chunk.content), 220);
  }

  const rankedSentences = sentences
    .map((sentence) => ({
      sentence,
      score: rankMatch(question, `${chunk.section}\n${sentence}`),
    }))
    .sort((left, right) => right.score - left.score);

  const nonBoilerplate = rankedSentences.find(
    (entry) =>
      !/\b(this chapter|topics covered|deals with|will look at|chapter\s+\d+)\b/i.test(
        entry.sentence,
      ),
  );

  return truncateText(
    markdownToPlainText((nonBoilerplate ?? rankedSentences[0]).sentence),
    220,
  );
}

const conversationTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(5000),
});

const latestTutorSnapshotSchema = z.object({
  answer: z.string().min(1),
  sourceSnippets: z.array(z.string().min(1)).max(3),
});

const askSchema = z.object({
  documentId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  question: z.string().min(1),
  profile: learnerProfileSchema,
  history: z.array(conversationTurnSchema).max(8).optional(),
  latestTutor: latestTutorSnapshotSchema.nullable().optional(),
});

function buildSessionTitle(question: string) {
  const normalized = question.trim().replace(/\s+/g, " ");
  return truncateText(normalized, 72);
}

export async function POST(request: Request) {
  try {
    const payload = askSchema.parse(await request.json());
    const effectiveProfile = payload.profile;
    const document = getDocumentById(payload.documentId);

    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    let chatSession = payload.sessionId ? getChatSessionById(payload.sessionId) : null;

    if (chatSession && chatSession.documentId !== payload.documentId) {
      return NextResponse.json(
        { error: "That chat session belongs to a different source." },
        { status: 400 },
      );
    }

    if (!chatSession) {
      chatSession = createChatSession({
        documentId: payload.documentId,
        title: buildSessionTitle(payload.question),
      });
    } else if (chatSession.title === "New chat") {
      chatSession = updateChatSessionTitle(
        chatSession.id,
        buildSessionTitle(payload.question),
      );
    }

    if (!chatSession) {
      return NextResponse.json(
        { error: "Could not create a chat session." },
        { status: 500 },
      );
    }

    insertChatMessage({
      sessionId: chatSession.id,
      role: "user",
      content: payload.question.trim(),
    });

    const chunks = getChunksForDocument(payload.documentId);

    if (hasEmbeddingProvider()) {
      const chunksMissingEmbeddings = chunks.filter((chunk) => chunk.embedding.length === 0);

      if (chunksMissingEmbeddings.length > 0) {
        try {
          const generatedEmbeddings = await embedTexts(
            chunksMissingEmbeddings.map((chunk) => ({
              text: chunk.contextualizedContent || chunk.content,
              title: `${chunk.documentName} · ${chunk.section}`,
            })),
            { taskType: "RETRIEVAL_DOCUMENT" },
          );

          if (generatedEmbeddings) {
            chunksMissingEmbeddings.forEach((chunk, index) => {
              chunk.embedding = generatedEmbeddings[index] ?? [];
            });

            updateChunkEmbeddings(
              chunksMissingEmbeddings
                .filter((chunk) => chunk.embedding.length > 0)
                .map((chunk) => ({
                  id: chunk.id,
                  embedding: chunk.embedding,
                })),
            );
          }
        } catch {
          // Keep retrieval working even if embedding backfill fails.
        }
      }
    }

    const retrieval = await runAskRetrievalWorkflow({
      question: payload.question,
      chunks,
      candidateLimit: 10,
      finalLimit: 5,
      preferredDocumentId: payload.documentId,
      documentName: document.name,
      sections: Array.from(new Set(chunks.map((chunk) => chunk.section))).slice(0, 16),
      languageCode: document.languageCode,
    });
    const relevantChunks = retrieval.relevantChunks;

    if (relevantChunks.length === 0) {
      return NextResponse.json(
        { error: "No extracted study material was found for this document." },
        { status: 400 },
      );
    }

    const tutor = await generateTutorReply({
      question: payload.question,
      profile: effectiveProfile,
      chunks: relevantChunks,
      history: payload.history,
      latestTutor: payload.latestTutor ?? null,
    });

    const citations = dedupeCitations(
      payload.question,
      relevantChunks.map((chunk) => ({
        documentId: chunk.documentId,
        documentName: chunk.documentName,
        sourceRef: chunk.sourceRef,
        preview: bestSentencePreview(payload.question, chunk),
        retrievalScore: Number(chunk.hybridScore.toFixed(4)),
      })),
    ).slice(0, 4);

    const primaryCitation = citations[0];
    if (primaryCitation && tutor.sourceSnippets.length === 0) {
      tutor.sourceSnippets = [primaryCitation.preview];
    }

    if (effectiveProfile.explanationLanguage === "hinglish" && effectiveProfile.transliterateToRoman) {
      tutor.answer = await transliterateToRomanIfNeeded(tutor.answer);
      tutor.sourceSnippets = await Promise.all(
        tutor.sourceSnippets.map((snippet) => transliterateToRomanIfNeeded(snippet)),
      );
      tutor.suggestedFollowups = await Promise.all(
        tutor.suggestedFollowups.map((question) => transliterateToRomanIfNeeded(question)),
      );
      tutor.audioText = await transliterateToRomanIfNeeded(tutor.audioText);
    }

    const responseLanguage = tutor.responseLanguage;
    const retrievalMode = retrieval.usedVectorSearch
      ? "hybrid-contextual-bm25-embedding"
      : "hybrid-contextual-bm25";
    const answerMode = tutor.answerMode === "live" ? tutor.answerMode : undefined;

    insertChatMessage({
      sessionId: chatSession.id,
      role: "assistant",
      content: tutor.answer,
      responseLanguage,
      audioText: tutor.audioText,
      answerMode,
      sourceSnippets: tutor.sourceSnippets,
      citations,
      suggestedFollowups: tutor.suggestedFollowups,
    });

    return NextResponse.json({
      sessionId: chatSession.id,
      tutor: tutorResponseSchema.parse({
        ...tutor,
        citations,
        responseLanguage,
        retrievalMode,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not answer that doubt.",
      },
      { status: 500 },
    );
  }
}
