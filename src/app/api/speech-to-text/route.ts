import { NextResponse } from "next/server";

import { transcribeStudentAudio } from "@/lib/sarvam/speech";
import { saveUploadedFile } from "@/lib/utils/file";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "Please send an audio file." }, { status: 400 });
    }

    const saved = await saveUploadedFile(audio);
    const response = await transcribeStudentAudio({
      filePath: saved.filePath,
      mimeType: saved.mimeType,
      languageCode: "unknown",
    });

    return NextResponse.json({
      transcript: response.transcript,
      languageCode: response.language_code || "unknown",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not transcribe this audio.",
      },
      { status: 500 },
    );
  }
}
