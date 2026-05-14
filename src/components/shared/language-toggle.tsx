"use client";

import { cn } from "@/lib/utils";
import { explanationLanguages, getLanguageLabel, type LearnerProfile } from "@/lib/tutor/learner-profile";

export function LanguageToggle({
  value,
  onChange,
}: {
  value: LearnerProfile["explanationLanguage"];
  onChange: (value: LearnerProfile["explanationLanguage"]) => void;
}) {
  return (
    <div className="grid grid-cols-3 rounded-full border border-[#e2d6c7] bg-white/60 p-1 dark:border-white/10 dark:bg-white/6">
      {explanationLanguages.map((language) => (
        <button
          key={language}
          type="button"
          className={cn(
            "rounded-full px-3 py-2 text-sm transition-colors",
            value === language
              ? "bg-primary text-primary-foreground shadow-[0_8px_18px_rgba(234,156,32,0.18)]"
              : "text-neutral-600 hover:bg-[#fbf1e2] hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white",
          )}
          onClick={() => onChange(language)}
        >
          {getLanguageLabel(language)}
        </button>
      ))}
    </div>
  );
}
