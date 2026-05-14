"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Languages, Sparkles, UserRound } from "lucide-react";

import { SamjhaoMark } from "@/components/shared/samjhao-mark";
import { Button } from "@/components/ui/button";

interface DemoViewerProfile {
  fullName: string;
  profession: string;
  language: string;
}

const professionSuggestions = [
  "Hindi medium student",
  "English medium student",
  "Houseworking wife",
  "Farmer",
];

const languageSuggestions = ["Hindi", "Hinglish", "English", "Punjabi", "Marathi"];

export function DemoIntake() {
  const router = useRouter();
  const [form, setForm] = useState<DemoViewerProfile>({
    fullName: "",
    profession: "",
    language: "",
  });

  function updateField(field: keyof DemoViewerProfile, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      fullName: form.fullName.trim(),
      profession: form.profession.trim(),
      language: form.language.trim(),
    };

    if (!payload.fullName || !payload.profession || !payload.language) {
      return;
    }

    window.localStorage.setItem("samjhao-demo-viewer", JSON.stringify(payload));
    router.push("/workspace");
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1480px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <main className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <section className="notebook-panel relative overflow-hidden rounded-[2.2rem] px-7 py-8 sm:px-10 sm:py-10 dark:border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,187,86,0.18),transparent_28%),radial-gradient(circle_at_82%_22%,rgba(122,181,255,0.14),transparent_24%)]" />
          <div className="relative space-y-7">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#ead8bf] bg-[#fff6e4] px-4 py-1.5 text-sm text-[#8b5e16] dark:border-white/10 dark:bg-white/6 dark:text-neutral-200">
                <Sparkles className="h-4 w-4" />
                Built with Sarvam for grounded multilingual tutoring
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <SamjhaoMark className="h-14 w-14 sm:h-16 sm:w-16" />
                  <h1 className="max-w-2xl font-heading text-5xl font-semibold tracking-[-0.05em] text-neutral-950 dark:text-white sm:text-6xl">
                    Samjhao
                  </h1>
                </div>
                <p className="max-w-2xl text-lg leading-8 text-neutral-700 dark:text-neutral-200">
                  Samjhao turns uploaded notes and PDFs into a grounded study workspace. It retrieves the
                  most relevant source chunks, explains them in Hindi, Hinglish, or English, and keeps the
                  answer tied to the learner&apos;s material instead of drifting into generic chat.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.6rem] border border-[#eadcc8] bg-white/72 p-4 dark:border-white/10 dark:bg-white/6">
                <p className="text-xs uppercase tracking-[0.22em] text-neutral-500 dark:text-neutral-400">
                  Grounded
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                  Answers stay anchored to the uploaded source with traceable references.
                </p>
              </div>
              <div className="rounded-[1.6rem] border border-[#eadcc8] bg-white/72 p-4 dark:border-white/10 dark:bg-white/6">
                <p className="text-xs uppercase tracking-[0.22em] text-neutral-500 dark:text-neutral-400">
                  Multilingual
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                  Built around Sarvam so learners can read explanations in the language that feels natural.
                </p>
              </div>
              <div className="rounded-[1.6rem] border border-[#eadcc8] bg-white/72 p-4 dark:border-white/10 dark:bg-white/6">
                <p className="text-xs uppercase tracking-[0.22em] text-neutral-500 dark:text-neutral-400">
                  India-first
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                  Built for Indian learners, families, and everyday users who need clear explanations in the
                  language they actually use.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="notebook-panel-soft rounded-[2rem] px-6 py-7 sm:px-8 sm:py-8 dark:border-white/10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.22em] text-neutral-500 dark:text-neutral-400">
                Getting started
              </p>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-neutral-950 dark:text-white">
                Tell us about yourself
              </h2>
              <p className="text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                A few details help us shape the workspace around you from the start.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-sm font-medium text-neutral-800 dark:text-neutral-100">
                <UserRound className="h-4 w-4" />
                Your name
              </span>
              <input
                type="text"
                value={form.fullName}
                onChange={(event) => updateField("fullName", event.target.value)}
                placeholder="Enter your full name"
                className="w-full rounded-[1.2rem] border border-[#dfd2bf] bg-white/82 px-4 py-3 text-base text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-[#d89a30] dark:border-white/10 dark:bg-white/6 dark:text-white dark:placeholder:text-neutral-500"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100">Your profession</span>
              <input
                type="text"
                value={form.profession}
                onChange={(event) => updateField("profession", event.target.value)}
                placeholder="Hindi medium student, English medium student, houseworking wife, farmer..."
                className="w-full rounded-[1.2rem] border border-[#dfd2bf] bg-white/82 px-4 py-3 text-base text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-[#d89a30] dark:border-white/10 dark:bg-white/6 dark:text-white dark:placeholder:text-neutral-500"
              />
              <div className="flex flex-wrap gap-2">
                {professionSuggestions.map((profession) => (
                  <button
                    key={profession}
                    type="button"
                    className="rounded-full border border-[#e5d7c5] bg-white/72 px-3 py-1.5 text-xs text-neutral-600 transition-colors hover:bg-[#f8eddc] hover:text-neutral-900 dark:border-white/10 dark:bg-white/6 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
                    onClick={() => updateField("profession", profession)}
                  >
                    {profession}
                  </button>
                ))}
              </div>
            </label>

            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-sm font-medium text-neutral-800 dark:text-neutral-100">
                <Languages className="h-4 w-4" />
                Language you speak
              </span>
              <input
                type="text"
                value={form.language}
                onChange={(event) => updateField("language", event.target.value)}
                placeholder="Hindi, Hinglish, English..."
                className="w-full rounded-[1.2rem] border border-[#dfd2bf] bg-white/82 px-4 py-3 text-base text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-[#7caef5] dark:border-white/10 dark:bg-white/6 dark:text-white dark:placeholder:text-neutral-500"
              />
              <div className="flex flex-wrap gap-2">
                {languageSuggestions.map((language) => (
                  <button
                    key={language}
                    type="button"
                    className="rounded-full border border-[#dbe7f9] bg-[#f3f8ff] px-3 py-1.5 text-xs text-[#4e6f99] transition-colors hover:bg-[#e8f1ff] dark:border-white/10 dark:bg-white/6 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
                    onClick={() => updateField("language", language)}
                  >
                    {language}
                  </button>
                ))}
              </div>
            </label>

            <div className="rounded-[1.4rem] border border-dashed border-[#e0d3c1] bg-white/65 p-4 text-sm leading-6 text-neutral-600 dark:border-white/10 dark:bg-white/4 dark:text-neutral-300">
              We&apos;ll use your first name, profession, and spoken language to personalize the workspace.
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                size="lg"
                className="rounded-full bg-[#f0aa2f] px-5 text-neutral-950 hover:bg-[#e59c20] dark:bg-[#f0aa2f] dark:text-neutral-950 dark:hover:bg-[#e59c20]"
                disabled={!form.fullName.trim() || !form.profession.trim() || !form.language.trim()}
              >
                Continue to workspace
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
