"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";

interface DemoViewerProfile {
  fullName: string;
  profession: string;
  language: string;
}

function parseFirstName(fullName: string) {
  return fullName.trim().split(/\s+/).filter(Boolean)[0] ?? "";
}

export function DemoViewerChip() {
  const [profile, setProfile] = useState<DemoViewerProfile | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const raw = window.localStorage.getItem("samjhao-demo-viewer");
        if (!raw) {
          setMounted(true);
          return;
        }

        const parsed = JSON.parse(raw) as Partial<DemoViewerProfile>;
        if (
          typeof parsed.fullName === "string" &&
          typeof parsed.profession === "string" &&
          typeof parsed.language === "string"
        ) {
          setProfile({
            fullName: parsed.fullName,
            profession: parsed.profession,
            language: parsed.language,
          });
        }
      } catch {
        // Ignore invalid local demo state.
      } finally {
        setMounted(true);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!mounted || !profile) {
    return null;
  }

  const firstName = parseFirstName(profile.fullName);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {firstName ? (
        <Badge
          variant="secondary"
          className="rounded-full border border-[#ead8bf] bg-[#fff6e4] px-3 py-1 text-sm text-[#8b5e16] dark:border-white/10 dark:bg-white/6 dark:text-neutral-200"
        >
          {firstName}
        </Badge>
      ) : null}
      <Badge
        variant="outline"
        className="h-auto max-w-full whitespace-normal break-words px-3 py-1 text-left [overflow-wrap:anywhere] border-[#e2d4c0] bg-white/75 text-neutral-600 dark:border-white/10 dark:bg-white/6 dark:text-neutral-300"
      >
        {profile.profession}
      </Badge>
      <Badge
        variant="outline"
        className="rounded-full border-[#d7e8ff] bg-[#eff6ff] px-3 py-1 text-sm text-[#3e6795] dark:border-white/10 dark:bg-white/6 dark:text-neutral-300"
      >
        Speaks {profile.language}
      </Badge>
    </div>
  );
}
