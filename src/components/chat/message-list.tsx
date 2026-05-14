"use client";

import { AudioLines, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { rankMatch } from "@/lib/utils/text";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  spokenText?: string;
  sourceSnippets?: string[];
  citations?: Array<{
    documentId: string;
    documentName: string;
    sourceRef: string;
    preview: string;
    retrievalScore: number;
  }>;
  suggestedFollowups?: string[];
  responseLanguage?: "hinglish" | "hindi" | "english";
}

type Citation = NonNullable<ChatMessage["citations"]>[number];

type MessageBlock =
  | { type: "paragraph"; text: string }
  | { type: "formula"; text: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] };

function normalizeLine(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

function isFormulaLine(line: string) {
  const normalized = normalizeLine(line);

  return (
    normalized.length > 0 &&
    normalized.length <= 80 &&
    /[=]/.test(normalized) &&
    !/[.!?]$/.test(normalized)
  );
}

function parseMessageBlocks(content: string): MessageBlock[] {
  const lines = content.split(/\r?\n/);
  const blocks: MessageBlock[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    const text = paragraphBuffer.join(" ").replace(/\s+/g, " ").trim();
    if (text) {
      blocks.push({ type: "paragraph", text });
    }
    paragraphBuffer = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const line = normalizeLine(rawLine);

    if (!line) {
      flushParagraph();
      continue;
    }

    if (isFormulaLine(line)) {
      flushParagraph();
      blocks.push({ type: "formula", text: line });
      continue;
    }

    if (/^[-*•]\s+/.test(line)) {
      flushParagraph();
      const items: string[] = [];
      let cursor = index;

      while (cursor < lines.length) {
        const candidate = normalizeLine(lines[cursor] ?? "");
        if (!/^[-*•]\s+/.test(candidate)) {
          break;
        }
        items.push(candidate.replace(/^[-*•]\s+/, "").trim());
        cursor += 1;
      }

      blocks.push({ type: "unordered-list", items });
      index = cursor - 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      const items: string[] = [];
      let cursor = index;

      while (cursor < lines.length) {
        const candidate = normalizeLine(lines[cursor] ?? "");
        if (!/^\d+\.\s+/.test(candidate)) {
          break;
        }
        items.push(candidate.replace(/^\d+\.\s+/, "").trim());
        cursor += 1;
      }

      blocks.push({ type: "ordered-list", items });
      index = cursor - 1;
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();

  return blocks;
}

function pickCitationNumbers(text: string, citations: Citation[]) {
  if (citations.length === 0) {
    return [] as number[];
  }

  const ranked = citations
    .map((citation, index) => ({
      number: index + 1,
      score: Math.max(
        rankMatch(text, `${citation.preview}\n${citation.sourceRef}`),
        rankMatch(`${citation.preview}\n${citation.sourceRef}`, text),
      ),
    }))
    .sort((left, right) => right.score - left.score)
    .filter((entry) => entry.score > 0);

  if (ranked.length > 0) {
    return ranked.slice(0, 2).map((entry) => entry.number);
  }

  return [1];
}

function CitationRefs({
  numbers,
  citations,
}: {
  numbers: number[];
  citations: Citation[];
}) {
  if (numbers.length === 0) {
    return null;
  }

  return (
    <span className="ml-2 inline-flex flex-wrap items-center gap-1 align-middle">
      {numbers.map((number) => {
        const citation = citations[number - 1];

        return (
          <span
            key={number}
            className="group relative inline-flex"
          >
            <span className="inline-flex h-6 min-w-6 cursor-help items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 px-2 text-[11px] font-medium text-neutral-600 transition-colors group-hover:border-neutral-300 group-hover:bg-neutral-200 dark:border-white/10 dark:bg-white/8 dark:text-neutral-200 dark:group-hover:bg-white/14">
              {number}
            </span>
            {citation ? (
              <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-72 -translate-x-1/2 rounded-2xl border border-neutral-200 bg-white p-3 text-left shadow-[0_18px_45px_rgba(15,23,42,0.16)] group-hover:block dark:border-white/10 dark:bg-[#20242b] dark:shadow-[0_18px_45px_rgba(0,0,0,0.35)]">
                <span className="line-clamp-4 block text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                  {citation.preview}
                </span>
                <span className="mt-2 block text-xs text-neutral-500 dark:text-neutral-400">
                  {citation.sourceRef}
                </span>
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

function AssistantMessage({
  message,
  onPlay,
}: {
  message: ChatMessage;
  onPlay?: (message: ChatMessage) => void;
}) {
  const blocks = parseMessageBlocks(message.content);
  const citations = message.citations ?? [];

  return (
    <article className="rounded-[1.8rem] border border-neutral-200 bg-white px-5 py-5 sm:px-6 sm:py-5 dark:border-white/10 dark:bg-white/6">
      <div className="space-y-4 text-neutral-800 dark:text-neutral-200">
        {blocks.map((block, index) => {
          if (block.type === "formula") {
            return (
              <div
                key={`${message.id}-formula-${index}`}
                className="overflow-x-auto py-2 text-center font-serif text-[2rem] italic text-neutral-700 dark:text-neutral-100 sm:text-[2.6rem]"
              >
                {block.text}
              </div>
            );
          }

          if (block.type === "unordered-list") {
            return (
              <ul
                key={`${message.id}-ul-${index}`}
                className="space-y-3 pl-6 text-[1.05rem] leading-8"
              >
                {block.items.map((item, itemIndex) => {
                  const numbers = pickCitationNumbers(item, citations);

                  return (
                    <li key={`${message.id}-ul-item-${itemIndex}`} className="list-disc">
                      <span>{item}</span>
                      <CitationRefs numbers={numbers} citations={citations} />
                    </li>
                  );
                })}
              </ul>
            );
          }

          if (block.type === "ordered-list") {
            return (
              <ol
                key={`${message.id}-ol-${index}`}
                className="space-y-4 pl-6 text-[1.08rem] leading-8"
              >
                {block.items.map((item, itemIndex) => {
                  const numbers = pickCitationNumbers(item, citations);

                  return (
                    <li key={`${message.id}-ol-item-${itemIndex}`} className="list-decimal pl-1">
                      <span className="font-medium">{item}</span>
                      <CitationRefs numbers={numbers} citations={citations} />
                    </li>
                  );
                })}
              </ol>
            );
          }

          const numbers = pickCitationNumbers(block.text, citations);
          const isLead = index === 0;

          return (
            <p
              key={`${message.id}-p-${index}`}
              className={cn(
                "text-[1.08rem] leading-8 text-neutral-800 dark:text-neutral-200",
                isLead && "text-[1.14rem] font-medium leading-9 text-neutral-900 dark:text-white",
              )}
            >
              {block.text}
              <CitationRefs numbers={numbers} citations={citations} />
            </p>
          );
        })}
      </div>

      {message.suggestedFollowups && message.suggestedFollowups.length > 0 ? (
        <div className="mt-5 space-y-3 border-t border-neutral-200 pt-4 dark:border-white/10">
          <div className="flex flex-wrap gap-2">
            {message.suggestedFollowups.slice(0, 3).map((followup, index) => (
              <span
                key={`${followup}-${index}`}
                className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm text-neutral-700 dark:border-white/10 dark:bg-white/8 dark:text-neutral-200"
              >
                {followup}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {message.spokenText && onPlay ? (
        <div className="mt-5">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-9 rounded-full bg-neutral-100 px-3 text-neutral-800 hover:bg-neutral-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/16"
            onClick={() => onPlay(message)}
          >
            <AudioLines className="mr-1.5 h-3.5 w-3.5" />
            Play audio
          </Button>
        </div>
      ) : null}
    </article>
  );
}

export function MessageList({
  messages,
  loading,
  onPlay,
  className,
  embedded,
}: {
  messages: ChatMessage[];
  loading?: boolean;
  onPlay?: (message: ChatMessage) => void;
  className?: string;
  embedded?: boolean;
}) {
  return (
    <ScrollArea
      className={cn(
        embedded
          ? "h-[520px] px-0"
          : "h-[520px] rounded-[1.9rem] border border-neutral-200 bg-white/90 px-2",
        className,
      )}
    >
      <div className={cn("space-y-6 pb-4", embedded ? "pr-4" : "p-4 pr-4")}>
        {messages.length === 0 ? (
          <div className="rounded-[1.8rem] border border-dashed border-neutral-200 bg-neutral-50 p-6 text-base leading-8 text-neutral-500 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300">
            Your answers will appear here.
          </div>
        ) : null}

        {messages.map((message) => (
          <div key={message.id} className={cn("flex gap-3", message.role === "user" && "justify-end")}>
            {message.role === "assistant" ? (
              <AssistantMessage message={message} onPlay={onPlay} />
            ) : (
              <>
                <div className="max-w-[72%] rounded-[1.5rem] border border-neutral-200 bg-neutral-50 px-5 py-4 text-[1.05rem] leading-8 text-neutral-800 dark:border-white/10 dark:bg-white/8 dark:text-neutral-100">
                  {message.content}
                </div>
                <div className="mt-1 rounded-full border border-neutral-200 bg-white p-2 text-neutral-700 dark:border-white/10 dark:bg-white/10 dark:text-neutral-100">
                  <UserRound className="h-4 w-4" />
                </div>
              </>
            )}
          </div>
        ))}

        {loading ? (
          <div className="rounded-[1.4rem] border border-neutral-200 bg-neutral-50 px-5 py-4 text-base text-neutral-500 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300">
            Samjhao is reading the notes, choosing the best evidence, and composing a grounded answer...
          </div>
        ) : null}
      </div>
    </ScrollArea>
  );
}
