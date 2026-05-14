"use client";

import { FileText, ScanSearch, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DocumentSummary } from "@/lib/tutor/response-schema";

export function DocumentStatus({
  documents,
  activeDocumentId,
  onSelect,
  onRemove,
  onClearAll,
  busy,
  compact,
}: {
  documents: DocumentSummary[];
  activeDocumentId: string | null;
  onSelect: (documentId: string) => void;
  onRemove?: (documentId: string) => void;
  onClearAll?: () => void;
  busy?: boolean;
  compact?: boolean;
}) {
  if (documents.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-[#e1d5c6] bg-white/58 p-5 text-sm text-neutral-500 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300">
        {compact
          ? "No sources yet."
          : "No sources loaded yet. Start with the demo notes or add your own material to open the notebook workspace."}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="rounded-[1.4rem] border border-[#e1d5c6] bg-white/55 p-2 dark:border-white/10 dark:bg-white/5">
        <div className="space-y-2">
          {documents.map((document) => {
            const isActive = activeDocumentId === document.id;

            return (
              <button
                key={document.id}
                type="button"
                title={document.name}
                onClick={() => onSelect(document.id)}
                className={`flex w-full items-center justify-center rounded-[1rem] border p-3 transition-colors ${
                  isActive
                    ? "border-[#f0bf56] bg-[#fff2d6] text-[#b57609] dark:border-[#f0bf56]/60 dark:bg-[#f0bf56]/12 dark:text-[#ffd08a]"
                    : "border-transparent bg-white/88 text-neutral-600 hover:border-[#e1d5c6] hover:bg-[#f7ecdc] dark:bg-white/8 dark:text-neutral-300 dark:hover:border-white/10 dark:hover:bg-white/12"
                }`}
              >
                <FileText className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[1.7rem] border border-[#e1d5c6] bg-white/58 p-2 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-1">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
          Source library
        </p>
        {onClearAll ? (
          <button
            type="button"
            disabled={busy}
            onClick={onClearAll}
            className="rounded-full border border-[#e1d5c6] bg-white/85 px-3 py-1.5 text-xs text-neutral-600 transition-colors hover:bg-[#f7ecdc] hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/8 dark:text-neutral-300 dark:hover:bg-white/12 dark:hover:text-white"
          >
            Clear all
          </button>
        ) : null}
      </div>
      <ScrollArea className="h-[388px]">
        <div className="space-y-3 p-2">
        {documents.map((document) => {
          const isActive = activeDocumentId === document.id;

          return (
            <div
              key={document.id}
              className={`w-full rounded-[1.3rem] border p-4 text-left transition-all ${
                isActive
                  ? "border-[#f0bf56] bg-[#fff3db] shadow-lg shadow-[#f0bf56]/10 dark:border-[#f0bf56]/60 dark:bg-[#f0bf56]/12 dark:shadow-none"
                  : "border-[#e1d5c6] bg-white/82 hover:bg-[#fbf3e7] dark:border-white/10 dark:bg-white/8 dark:hover:bg-white/12"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onSelect(document.id)}
                  className="min-w-0 flex-1 space-y-2 text-left"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-primary dark:text-[#ffd08a]" />
                    <p className="break-words [overflow-wrap:anywhere] text-sm font-medium text-neutral-900 dark:text-white">
                      {document.name}
                    </p>
                  </div>
                  <p className="text-sm leading-6 break-words [overflow-wrap:anywhere] text-neutral-600 dark:text-neutral-300">
                    {document.summary}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-[#e1d5c6] bg-white/82 text-[11px] text-neutral-600 dark:border-white/10 dark:bg-white/6 dark:text-neutral-300"
                  >
                    {document.languageCode}
                  </Badge>
                  {onRemove ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRemove(document.id)}
                      aria-label={`Remove ${document.name}`}
                      className="rounded-full border border-[#e1d5c6] bg-white/88 p-2 text-neutral-500 transition-colors hover:bg-[#f7ecdc] hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/8 dark:text-neutral-300 dark:hover:bg-white/12 dark:hover:text-white"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>

              {document.sections.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                    <ScanSearch className="h-3.5 w-3.5" />
                    Extracted sections
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {document.sections.slice(0, 4).map((section) => (
                      <span
                        key={`${document.id}-${section}`}
                        className="inline-flex max-w-full items-center rounded-2xl bg-[#f8eddc] px-3 py-1 text-left text-xs leading-5 whitespace-normal break-words [overflow-wrap:anywhere] text-neutral-600 dark:bg-white/8 dark:text-neutral-300"
                      >
                        {section}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        </div>
      </ScrollArea>
    </div>
  );
}
