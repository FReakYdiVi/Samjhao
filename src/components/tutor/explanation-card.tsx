"use client";

import { Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ExplanationCard({
  title,
  directAnswer,
  text,
  keyPoints,
  formulaLines,
}: {
  title?: string;
  directAnswer?: string;
  text: string;
  keyPoints?: string[];
  formulaLines?: string[];
}) {
  return (
    <Card className="border-white/10 bg-white/6 text-white shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          {title || "Simple explanation"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-7 text-white/75">
        {directAnswer ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/8 p-4 text-white">
            <p className="text-xs uppercase tracking-[0.18em] text-primary/80">
              Direct answer
            </p>
            <p className="mt-2 text-sm leading-7 text-white/88">{directAnswer}</p>
          </div>
        ) : null}

        <div className="whitespace-pre-line">{text}</div>

        {keyPoints && keyPoints.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">
              Key points
            </p>
            <ul className="space-y-2">
              {keyPoints.map((point, index) => (
                <li key={`${point}-${index}`} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {formulaLines && formulaLines.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">
              Formulas from the notes
            </p>
            <div className="space-y-2">
              {formulaLines.map((line, index) => (
                <div
                  key={`${line}-${index}`}
                  className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 font-medium text-white/84"
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
