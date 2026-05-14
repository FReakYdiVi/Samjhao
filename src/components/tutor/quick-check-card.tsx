"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function QuickCheckCard({ question }: { question: string }) {
  return (
    <Card className="border-white/10 bg-white/6 text-white shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick check</CardTitle>
      </CardHeader>
      <CardContent className="text-sm leading-7 text-white/75">
        {question}
      </CardContent>
    </Card>
  );
}
