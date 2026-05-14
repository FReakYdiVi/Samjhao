"use client";

import { Quote } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TutorResponse } from "@/lib/tutor/response-schema";

export function SourceEvidence({
  source,
  sourceRef,
  citations,
}: {
  source: string;
  sourceRef: string;
  citations?: TutorResponse["citations"];
}) {
  return (
    <Card className="border-white/10 bg-white/6 text-white shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span>From your notes</span>
          <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-normal text-white/60">
            {sourceRef}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-7 text-white/75">
        <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
          <Quote className="mb-2 h-4 w-4 text-primary" />
          <p>{source}</p>
        </div>
        {citations && citations.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">
              Retrieval citations
            </p>
            <div className="space-y-2">
              {citations.slice(0, 3).map((citation, index) => (
                <div
                  key={`${citation.documentId}-${citation.sourceRef}-${index}`}
                  className="rounded-2xl border border-white/10 bg-white/4 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">
                      {citation.documentName}
                    </p>
                    <span className="text-xs text-white/45">
                      score {citation.retrievalScore.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-white/55">{citation.sourceRef}</p>
                  <p className="mt-1 text-sm leading-6 text-white/68">
                    {citation.preview}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
