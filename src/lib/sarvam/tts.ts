import { getSarvamClient } from "./client";

export async function synthesizeTutorSpeech(params: {
  text: string;
  languageCode: string;
  speaker?: string;
}) {
  const client = getSarvamClient();
  if (!client) {
    return null;
  }

  const response = await client.textToSpeech.convert({
    text: params.text.slice(0, 2400),
    target_language_code: (params.languageCode || "hi-IN") as
      | "hi-IN"
      | "en-IN"
      | "bn-IN"
      | "gu-IN"
      | "kn-IN"
      | "ml-IN"
      | "mr-IN"
      | "pa-IN"
      | "ta-IN"
      | "te-IN"
      | "od-IN",
    model: "bulbul:v3",
    speaker: (params.speaker || "shubh") as
      | "shubh"
      | "aditya"
      | "ritu"
      | "priya"
      | "simran"
      | "pooja",
    pace: 1,
    speech_sample_rate: 24000,
    output_audio_codec: "wav",
    temperature: 0.4,
  });

  return response.audios[0] ?? null;
}
