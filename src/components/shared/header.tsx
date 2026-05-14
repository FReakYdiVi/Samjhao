"use client";

import { DemoViewerChip } from "@/components/shared/demo-viewer-chip";
import { SamjhaoMark } from "@/components/shared/samjhao-mark";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Badge } from "@/components/ui/badge";

export function Header({ hasSarvamKey }: { hasSarvamKey: boolean }) {
  return (
    <header className="notebook-panel flex flex-wrap items-center justify-between gap-4 rounded-[1.9rem] px-6 py-5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(37,41,49,0.96),rgba(20,24,31,0.92))] dark:shadow-[0_26px_60px_rgba(0,0,0,0.28)]">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <SamjhaoMark className="h-11 w-11 sm:h-12 sm:w-12" />
            <h1 className="font-heading text-[2rem] font-semibold tracking-[-0.04em] text-neutral-950 dark:text-white sm:text-[2.35rem]">
              Samjhao
            </h1>
          </div>
          <Badge
            variant="secondary"
            className="rounded-full border border-[#e7d6be] bg-[#fff4df] px-3 py-1 text-sm text-[#8b5e16] dark:border-white/10 dark:bg-white/6 dark:text-neutral-200"
          >
            Grounded notebook
          </Badge>
        </div>
        <p className="max-w-3xl text-base text-neutral-600 dark:text-neutral-300">
          Ask from your own source and read answers with compact inline citations.
        </p>
        <DemoViewerChip />
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <Badge
          variant="outline"
          className={
            hasSarvamKey
              ? "rounded-full border-emerald-300 bg-emerald-50 px-4 py-1.5 text-sm text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300"
              : "rounded-full border-amber-300 bg-amber-50 px-4 py-1.5 text-sm text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300"
          }
        >
          {hasSarvamKey ? "Sarvam connected" : "Demo mode"}
        </Badge>
      </div>
    </header>
  );
}
