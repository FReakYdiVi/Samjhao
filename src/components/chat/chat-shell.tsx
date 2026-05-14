"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

import { Composer } from "@/components/chat/composer";
import { MessageList, type ChatMessage } from "@/components/chat/message-list";
import { Header } from "@/components/shared/header";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { DocumentStatus } from "@/components/upload/document-status";
import { UploadDropzone } from "@/components/upload/upload-dropzone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { defaultLearnerProfile, learnerProfileSchema, type LearnerProfile } from "@/lib/tutor/learner-profile";
import { sessionStateSchema, tutorResponseSchema, type SessionState } from "@/lib/tutor/response-schema";
import { cn } from "@/lib/utils";

function isBrowserAudioSupported() {
  return typeof window !== "undefined" && typeof Audio !== "undefined";
}

function makeId() {
  return globalThis.crypto.randomUUID();
}

function toChatMessage(
  message: SessionState["activeMessages"][number],
): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    spokenText: message.spokenText ?? undefined,
    sourceSnippets: message.sourceSnippets,
    citations: message.citations,
    suggestedFollowups: message.suggestedFollowups,
    responseLanguage: message.responseLanguage ?? undefined,
  };
}

export function ChatShell() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedChatSessionId, setSelectedChatSessionId] = useState<string | null>(null);
  const [profile, setProfile] = useState<LearnerProfile>(defaultLearnerProfile);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [managingSources, setManagingSources] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);

  const workspaceBusy = uploading || asking || transcribing || managingSources;

  const activeDocument = useMemo(
    () => session?.documents.find((document) => document.id === selectedDocumentId) ?? null,
    [selectedDocumentId, session?.documents],
  );

  const chatSessions = useMemo(
    () =>
      session?.chatSessions.filter((chatSession) => chatSession.documentId === selectedDocumentId) ?? [],
    [selectedDocumentId, session?.chatSessions],
  );

  async function fetchSession(options?: {
    documentId?: string | null;
    sessionId?: string | null;
  }) {
    const searchParams = new URLSearchParams();

    if (options?.documentId) {
      searchParams.set("documentId", options.documentId);
    }

    if (options?.sessionId) {
      searchParams.set("sessionId", options.sessionId);
    }

    const query = searchParams.toString();
    const response = await fetch(query ? `/api/session?${query}` : "/api/session");
    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error || "Could not load the workspace.");
    }

    const nextSession = sessionStateSchema.parse(json);

    startTransition(() => {
      setSession(nextSession);
      setSelectedDocumentId(nextSession.activeDocumentId);
      setSelectedChatSessionId(nextSession.activeChatSessionId);
      setMessages(nextSession.activeMessages.map(toChatMessage));
      setProfile((current) => learnerProfileSchema.parse({ ...nextSession.profileDefaults, ...current }));
    });
  }

  useEffect(() => {
    void fetchSession().catch((loadError: Error) => {
      setError(loadError.message);
    });
  }, []);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("languageCode", "hi-IN");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Upload failed.");
      }

      await fetchSession({ documentId: json.document.id });
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleLoadDemo() {
    setUploading(true);
    setError(null);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ demo: true }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Could not load demo notes.");
      }

      await fetchSession({ documentId: json.document.id });
    } catch (demoError) {
      setError(
        demoError instanceof Error ? demoError.message : "Could not load demo notes.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveDocument(documentId: string) {
    setManagingSources(true);
    setError(null);

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Could not remove that source.");
      }

      await fetchSession();
      setDraft("");
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Could not remove that source.",
      );
    } finally {
      setManagingSources(false);
    }
  }

  async function handleClearAllDocuments() {
    setManagingSources(true);
    setError(null);

    try {
      const response = await fetch("/api/documents", {
        method: "DELETE",
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Could not clear saved sources.");
      }

      await fetchSession();
      setDraft("");
    } catch (clearError) {
      setError(
        clearError instanceof Error
          ? clearError.message
          : "Could not clear saved sources.",
      );
    } finally {
      setManagingSources(false);
    }
  }

  async function speakIfPossible(
    spokenText: string,
    responseLanguage: ChatMessage["responseLanguage"] = profile.explanationLanguage,
  ) {
    try {
      const response = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: spokenText,
          languageCode: responseLanguage === "english" ? "en-IN" : "hi-IN",
        }),
      });

      const json = await response.json();
      if (json.audioUrl && isBrowserAudioSupported()) {
        const audio = new Audio(json.audioUrl as string);
        await audio.play().catch(() => undefined);
      }
    } catch {
      // Audio is optional. The workspace should stay usable even if playback fails.
    }
  }

  async function handlePlayMessage(message: ChatMessage) {
    if (!message.spokenText) {
      return;
    }

    await speakIfPossible(message.spokenText, message.responseLanguage);
  }

  async function handleSelectDocument(documentId: string) {
    setError(null);

    try {
      await fetchSession({ documentId });
    } catch (selectionError) {
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : "Could not load that source.",
      );
    }
  }

  async function handleSelectChatSession(sessionId: string) {
    setError(null);

    try {
      await fetchSession({ sessionId });
    } catch (selectionError) {
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : "Could not load that chat session.",
      );
    }
  }

  async function handleCreateChatSession() {
    if (!selectedDocumentId) {
      return;
    }

    setManagingSources(true);
    setError(null);

    try {
      const response = await fetch("/api/chat-sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId: selectedDocumentId,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Could not create a new chat.");
      }

      await fetchSession({
        documentId: selectedDocumentId,
        sessionId: json.chatSession.id,
      });
      setDraft("");
    } catch (sessionError) {
      setError(
        sessionError instanceof Error
          ? sessionError.message
          : "Could not create a new chat.",
      );
    } finally {
      setManagingSources(false);
    }
  }

  async function submitQuestion(question = draft) {
    if (!question.trim() || !selectedDocumentId) {
      return;
    }

    setAsking(true);
    setError(null);

    const userMessage: ChatMessage = {
      id: makeId(),
      role: "user",
      content: question.trim(),
    };

    setMessages((current) => [...current, userMessage]);
    setDraft("");

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId: selectedDocumentId,
          sessionId: selectedChatSessionId ?? undefined,
          question: question.trim(),
          profile,
          history: messages.slice(-6).map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Tutor request failed.");
      }

      const tutor = tutorResponseSchema.parse(json.tutor);
      const nextSessionId =
        typeof json.sessionId === "string" ? json.sessionId : selectedChatSessionId;

      setMessages((current) => [
        ...current,
        {
          id: makeId(),
          role: "assistant",
          content: tutor.answer,
          sourceSnippets: tutor.sourceSnippets,
          citations: tutor.citations,
          suggestedFollowups: tutor.suggestedFollowups,
          spokenText: tutor.audioText,
          responseLanguage: tutor.responseLanguage,
        },
      ]);

      if (nextSessionId) {
        await fetchSession({
          documentId: selectedDocumentId,
          sessionId: nextSessionId,
        });
      }
    } catch (askError) {
      setError(askError instanceof Error ? askError.message : "Tutor request failed.");
    } finally {
      setAsking(false);
    }
  }

  async function handleRecordedAudio(blob: Blob) {
    setTranscribing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("audio", blob, "student-doubt.webm");

      const response = await fetch("/api/speech-to-text", {
        method: "POST",
        body: formData,
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Could not transcribe audio.");
      }

      setDraft(json.transcript || "");
    } catch (recordError) {
      setError(
        recordError instanceof Error
          ? recordError.message
          : "Could not transcribe audio.",
      );
    } finally {
      setTranscribing(false);
    }
  }

  const panelClass =
    "notebook-panel rounded-[1.8rem]";
  const softPanelClass =
    "notebook-panel-soft rounded-[1.6rem]";

  return (
    <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <Header hasSarvamKey={session?.hasSarvamKey ?? false} />

      <div className="flex flex-col gap-4 xl:flex-row">
        <aside
          className={cn(
            "shrink-0 transition-all duration-300 xl:sticky xl:top-5 xl:self-start",
            sourcesCollapsed ? "xl:w-[92px]" : "xl:w-[320px]",
          )}
        >
          <div className={cn("overflow-hidden rounded-[1.9rem] dark:text-neutral-100", panelClass)}>
            <div
              className={cn(
                "flex items-center border-b border-[#e5d8c6] dark:border-white/10",
                sourcesCollapsed ? "justify-center px-2 py-3" : "justify-between px-4 py-4",
              )}
            >
              {!sourcesCollapsed ? (
                <div className="space-y-1">
                  <p className="text-xl font-semibold tracking-[-0.02em] text-neutral-900 dark:text-white">Sources</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-300">
                    Keep this rail open while picking materials, then collapse it for a wider answer view.
                  </p>
                </div>
              ) : null}

              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-full text-neutral-600 hover:bg-[#f5ead8] hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
                onClick={() => setSourcesCollapsed((current) => !current)}
              >
                {sourcesCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className={cn("space-y-4", sourcesCollapsed ? "p-2" : "p-4")}>
              <UploadDropzone
                compact={sourcesCollapsed}
                disabled={uploading}
                onFileSelected={handleUpload}
                onLoadDemo={handleLoadDemo}
              />
              <DocumentStatus
                compact={sourcesCollapsed}
                documents={session?.documents ?? []}
                activeDocumentId={selectedDocumentId}
                onSelect={(documentId) => void handleSelectDocument(documentId)}
                onRemove={(documentId) => void handleRemoveDocument(documentId)}
                onClearAll={() => void handleClearAllDocuments()}
                busy={workspaceBusy}
              />
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0">
              <div className={cn("overflow-hidden dark:text-neutral-100", panelClass)}>
                <div className="px-4 pt-4 sm:px-5">
                  <MessageList
                    messages={messages}
                    loading={asking}
                    onPlay={(message) => void handlePlayMessage(message)}
                    embedded
                    className="h-[min(78vh,900px)]"
                  />
                </div>

                {error ? (
                  <div className="border-t border-amber-200 bg-amber-50/90 px-5 py-3 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
                    {error}
                  </div>
                ) : null}

                <div className="border-t border-[#e5d8c6] bg-[rgba(255,251,245,0.82)] px-4 py-3 sm:px-5 dark:border-white/10 dark:bg-[rgba(24,27,34,0.82)]">
                  <Composer
                    value={draft}
                    inputDisabled={uploading}
                    submitDisabled={!selectedDocumentId || uploading}
                    busy={asking}
                    transcriptionBusy={transcribing}
                    onChange={setDraft}
                    onSubmit={() => void submitQuestion()}
                    onRecord={handleRecordedAudio}
                  />
                </div>
              </div>
            </div>

            <aside className="space-y-3">
              <div className={cn("p-4 dark:text-neutral-100", softPanelClass)}>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-[#6b5a46] text-white hover:bg-[#6b5a46] dark:bg-white/12 dark:text-white dark:hover:bg-white/12">
                      {selectedChatSessionId ? "Session active" : "Fresh thread"}
                    </Badge>
                    <Badge className="h-auto max-w-full whitespace-normal break-words px-3 py-1 text-left [overflow-wrap:anywhere] bg-[#fff4df] text-[#b57609] hover:bg-[#fff4df] dark:bg-white/8 dark:text-[#ffd08a] dark:hover:bg-white/8">
                      {activeDocument ? activeDocument.name : "No active source"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-[#e2d4c0] bg-white/70 text-neutral-600 dark:border-white/10 dark:bg-white/6 dark:text-neutral-300"
                    >
                      {messages.length} turns
                    </Badge>
                  </div>
                  <p className="text-sm leading-6 break-words [overflow-wrap:anywhere] text-neutral-500 dark:text-neutral-300">
                    {activeDocument
                      ? activeDocument.summary
                      : "Choose a source from the left and the chat will stay grounded in that material."}
                  </p>
                </div>
              </div>

              <div className={cn("p-4", softPanelClass)}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-medium text-neutral-900 dark:text-white">Language</p>
                    <Badge variant="outline" className="border-[#e2d4c0] bg-white/70 text-neutral-600 dark:border-white/10 dark:bg-white/6 dark:text-neutral-300">
                      {profile.learnerLevel}
                    </Badge>
                  </div>
                  <LanguageToggle
                    value={profile.explanationLanguage}
                    onChange={(value) =>
                      setProfile((current) => ({ ...current, explanationLanguage: value }))
                    }
                  />
                </div>
              </div>

              <div className={cn("p-4", softPanelClass)}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-base font-medium text-neutral-900 dark:text-white">Chats</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="rounded-full bg-white/80 px-3 text-neutral-800 hover:bg-[#f5ead8] dark:bg-white/8 dark:text-white dark:hover:bg-white/12"
                    disabled={!selectedDocumentId || workspaceBusy}
                    onClick={() => void handleCreateChatSession()}
                  >
                    New chat
                  </Button>
                </div>

                <div className="mt-3 space-y-2">
                  {chatSessions.length === 0 ? (
                    <div className="rounded-[1.3rem] border border-dashed border-[#e2d6c7] bg-white/52 p-4 text-sm leading-6 text-neutral-500 dark:border-white/10 dark:bg-white/4 dark:text-neutral-300">
                      Your chats for this source will appear here after the first question.
                    </div>
                  ) : (
                    chatSessions.map((chatSession) => {
                      const isActive = chatSession.id === selectedChatSessionId;

                      return (
                        <button
                          key={chatSession.id}
                          type="button"
                          onClick={() => void handleSelectChatSession(chatSession.id)}
                          className={`w-full rounded-[1.2rem] border px-3 py-3 text-left transition-colors ${
                            isActive
                              ? "border-[#f0bf56] bg-[#fff2d6] text-neutral-900 dark:border-[#f0bf56]/60 dark:bg-[#f0bf56]/12 dark:text-white"
                              : "border-[#e2d6c7] bg-white/65 text-neutral-700 hover:bg-[#f7ecdc] dark:border-white/10 dark:bg-white/6 dark:text-neutral-200 dark:hover:bg-white/10"
                          }`}
                        >
                          <p className="line-clamp-2 break-words [overflow-wrap:anywhere] text-sm font-medium">
                            {chatSession.title}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            Updated {new Date(chatSession.updatedAt).toLocaleString("en-IN")}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
}
