import { getSarvamClient } from "./client";

export async function transliterateToRomanIfNeeded(input: string) {
  if (!input.trim()) {
    return input;
  }

  if (!/[\u0900-\u097F]/.test(input)) {
    return input;
  }

  const client = getSarvamClient();
  if (!client) {
    return input;
  }

  try {
    const response = await client.text.transliterate({
      input,
      source_language_code: "auto",
      target_language_code: "en-IN",
    });

    return response.transliterated_text || input;
  } catch {
    return input;
  }
}
