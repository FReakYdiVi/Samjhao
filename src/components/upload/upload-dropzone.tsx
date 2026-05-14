"use client";

import { useRef } from "react";
import { FileUp, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export function UploadDropzone({
  disabled,
  onFileSelected,
  onLoadDemo,
  compact,
}: {
  disabled?: boolean;
  onFileSelected: (file: File) => void;
  onLoadDemo: () => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (compact) {
    return (
      <div className="space-y-2 rounded-[1.4rem] border border-[#e1d5c6] bg-white/55 p-2 dark:border-white/10 dark:bg-white/5">
        <Button
          type="button"
          size="icon"
          variant="secondary"
          disabled={disabled}
          className="h-11 w-full rounded-[1rem] bg-white/85 text-neutral-800 hover:bg-[#f6ead8] dark:bg-white/8 dark:text-white dark:hover:bg-white/12"
          title="Choose source"
          onClick={() => inputRef.current?.click()}
        >
          <FileUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          disabled={disabled}
          className="h-11 w-full rounded-[1rem] bg-white/85 text-neutral-800 hover:bg-[#f6ead8] dark:bg-white/8 dark:text-white dark:hover:bg-white/12"
          title="Load demo notes"
          onClick={onLoadDemo}
        >
          <Sparkles className="h-4 w-4" />
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              onFileSelected(file);
              event.currentTarget.value = "";
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-[1.7rem] border border-dashed border-[#e1d5c6] bg-white/58 p-5 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-[#fff0cf] p-3 text-[#c27a05] dark:bg-[#f0bf56]/14 dark:text-[#ffd08a]">
          <FileUp className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-medium text-neutral-900 dark:text-white">Add a source</h3>
          <p className="text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            Bring in the PDF you want the notebook to stay grounded in.
            For the cleanest demo, you can also load the built-in physics notes
            and start exploring the workspace immediately.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Choose source
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          className="bg-white/88 text-neutral-800 hover:bg-[#f6ead8] dark:bg-white/8 dark:text-white dark:hover:bg-white/12"
          onClick={onLoadDemo}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Load demo notes
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onFileSelected(file);
            event.currentTarget.value = "";
          }
        }}
      />
    </div>
  );
}
