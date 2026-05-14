"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MisconceptionCard({ text }: { text: string }) {
  return (
    <Card className="border-white/10 bg-white/6 text-white shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Helpful note</CardTitle>
      </CardHeader>
      <CardContent className="text-sm leading-7 text-white/75">{text}</CardContent>
    </Card>
  );
}
