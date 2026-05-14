import { NextResponse } from "next/server";
import { z } from "zod";

import { audioBase64ToDataUrl } from "@/lib/utils/audio";
import { synthesizeTutorSpeech } from "@/lib/sarvam/tts";

export const runtime = "nodejs";

const ttsSchema = z.object({
  text: z.string().min(1),
  languageCode: z.string().default("hi-IN"),
});

export async function POST(request: Request) {
  try {
    const payload = ttsSchema.parse(await request.json());
    const audioBase64 = await synthesizeTutorSpeech({
      text: payload.text,
      languageCode: payload.languageCode,
    });

    if (!audioBase64) {
      return NextResponse.json({ audioUrl: null });
    }

    return NextResponse.json({
      audioUrl: audioBase64ToDataUrl(audioBase64),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not synthesize speech.",
      },
      { status: 500 },
    );
  }
}
