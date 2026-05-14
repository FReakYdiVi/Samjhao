import { NextResponse } from "next/server";

import {
  getChatSessionById,
  getDocumentById,
  getLatestChatSession,
  getLatestDocument,
  listChatSessions,
  listDocuments,
  listMessagesForSession,
} from "@/lib/db/queries";
import { hasSarvamKey } from "@/lib/sarvam/client";
import { defaultLearnerProfile } from "@/lib/tutor/learner-profile";
import { toDocumentSummary } from "@/lib/tutor/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const documents = listDocuments().map(toDocumentSummary);
  const { searchParams } = new URL(request.url);
  const requestedDocumentId = searchParams.get("documentId");
  const requestedSessionId = searchParams.get("sessionId");
  const requestedDocument = requestedDocumentId ? getDocumentById(requestedDocumentId) : null;
  const requestedSession = requestedSessionId ? getChatSessionById(requestedSessionId) : null;
  const latestDocument = getLatestDocument();
  const activeDocumentId =
    requestedDocument?.id ??
    requestedSession?.documentId ??
    latestDocument?.id ??
    null;
  const chatSessions = listChatSessions(activeDocumentId);
  const activeChatSession =
    requestedSession && requestedSession.documentId === activeDocumentId
      ? requestedSession
      : getLatestChatSession(activeDocumentId);
  const activeMessages = activeChatSession
    ? listMessagesForSession(activeChatSession.id).map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        spokenText: message.audioText,
        sourceSnippets: message.sourceSnippets,
        citations: message.citations,
        suggestedFollowups: message.suggestedFollowups,
        answerMode: message.answerMode,
        responseLanguage: message.responseLanguage,
        createdAt: message.createdAt,
      }))
    : [];

  return NextResponse.json({
    hasSarvamKey: hasSarvamKey(),
    activeDocumentId,
    activeChatSessionId: activeChatSession?.id ?? null,
    documents,
    chatSessions,
    activeMessages,
    sampleQuestions: [],
    profileDefaults: defaultLearnerProfile,
  });
}
