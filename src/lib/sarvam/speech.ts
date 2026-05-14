import { getSarvamClient } from "./client";

export async function transcribeStudentAudio(params: {
  filePath: string;
  mimeType: string;
  languageCode?: string;
}) {
  const client = getSarvamClient();
  if (!client) {
    throw new Error("Speech transcription needs SARVAM_API_KEY.");
  }

  return client.speechToText.transcribe({
    file: {
      path: params.filePath,
      contentType: params.mimeType,
    },
    model: "saaras:v3",
    mode: "codemix",
    language_code: (params.languageCode ?? "unknown") as
      | "unknown"
      | "hi-IN"
      | "en-IN"
      | "ta-IN"
      | "te-IN"
      | "kn-IN"
      | "mr-IN"
      | "gu-IN"
      | "bn-IN"
      | "ml-IN"
      | "pa-IN"
      | "od-IN",
  });
}
