"use client";

import { SendHorizonal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { VoiceRecorder } from "./voice-recorder";

export function Composer({
  value,
  inputDisabled,
  submitDisabled,
  busy,
  transcriptionBusy,
  onChange,
  onSubmit,
  onRecord,
}: {
  value: string;
  inputDisabled?: boolean;
  submitDisabled?: boolean;
  busy?: boolean;
  transcriptionBusy?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onRecord: (blob: Blob) => Promise<void>;
}) {
  return (
    <div className="rounded-[1.5rem] border border-[#e3d7c9] bg-white/72 px-4 py-3 dark:border-white/10 dark:bg-white/6">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-neutral-500 dark:text-neutral-300">
          Ask in Hinglish, Hindi, or English. Answers stay linked to the source.
        </p>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Input
            type="text"
            value={value}
            disabled={inputDisabled || busy}
            placeholder="Ask a question or create something from this source."
            className="h-11 flex-1 rounded-full border-[#e1d5c6] bg-white/80 px-4 text-base text-neutral-900 placeholder:text-neutral-400 dark:border-white/10 dark:bg-white/8 dark:text-white dark:placeholder:text-neutral-500"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSubmit();
              }
            }}
          />
          <VoiceRecorder
            disabled={inputDisabled}
            busy={transcriptionBusy}
            onRecorded={onRecord}
          />
          <Button
            type="button"
            disabled={submitDisabled || busy || !value.trim()}
            className="h-10 rounded-full px-5"
            onClick={onSubmit}
          >
            <SendHorizonal className="mr-2 h-4 w-4" />
            {busy ? "Thinking..." : "Ask Samjhao"}
          </Button>
        </div>
      </div>
    </div>
  );
}
