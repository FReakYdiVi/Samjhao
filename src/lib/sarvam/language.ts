import { markdownToPlainText } from "@/lib/utils/text";

import { getSarvamClient } from "./client";

export function isHindiCompliant(text: string) {
  return /[\u0900-\u097F]/.test(text);
}

export function isHinglishCompliant(text: string) {
  const normalized = markdownToPlainText(text).toLowerCase();
  const hasRomanHindiMarkers =
    /\b(kya|kaise|kyun|samjhao|matlab|aur|mein|main|isko|hai|tha|thi|the|kranti|log|samajh|batao|shabdon)\b/.test(
      normalized,
    );
  const hasDevanagari = /[\u0900-\u097F]/.test(text);

  return hasRomanHindiMarkers && !hasDevanagari;
}

function countRegexMatches(input: string, pattern: RegExp) {
  return input.match(pattern)?.length ?? 0;
}

function languageMatchScore(input: string, language: "hindi" | "hinglish") {
  const plain = markdownToPlainText(input).trim();
  const normalized = plain.toLowerCase();

  if (!plain) {
    return 0;
  }

  if (language === "hindi") {
    const devanagariChars = countRegexMatches(plain, /[\u0900-\u097F]/g);
    return devanagariChars / Math.max(plain.length, 1);
  }

  const romanHindiMarkers = countRegexMatches(
    normalized,
    /\b(kya|kaise|kyun|samjhao|samjha|matlab|aur|mein|main|isko|hai|tha|thi|the|batao|samajh|raha|rahi|hoga|hogi|kyunki|agar|toh|wala|wali|bhi|par|yeh|woh|iska|uska|karna|padta|zyada|kam)\b/g,
  );
  const englishMarkers = countRegexMatches(
    normalized,
    /\b(what|why|how|difference|explain|formula|define|meaning|tell|describe|derive|compare|between)\b/g,
  );
  const devanagariChars = countRegexMatches(plain, /[\u0900-\u097F]/g);

  return romanHindiMarkers * 1.25 - englishMarkers * 0.15 - devanagariChars * 0.05;
}

function pickBestLanguageCandidate(
  language: "hindi" | "hinglish",
  input: string,
  candidates: string[],
) {
  const uniqueCandidates = Array.from(
    new Set(
      candidates
        .map((candidate) => candidate.trim())
        .filter(Boolean),
    ),
  );

  const ranked = uniqueCandidates
    .map((candidate) => ({
      candidate,
      compliant:
        language === "hindi"
          ? isHindiCompliant(candidate)
          : isHinglishCompliant(candidate),
      score: languageMatchScore(candidate, language),
    }))
    .sort((left, right) => {
      if (left.compliant !== right.compliant) {
        return left.compliant ? -1 : 1;
      }

      return right.score - left.score;
    });

  const best = ranked[0];
  if (!best) {
    return input;
  }

  const inputScore = languageMatchScore(input, language);
  return best.compliant || best.score > inputScore ? best.candidate : input;
}

function splitForTranslation(input: string, maxChars = 900) {
  const normalized = markdownToPlainText(input).trim();
  if (!normalized) {
    return [] as string[];
  }

  const sentences = normalized
    .split(/(?<=[.?!])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (!current) {
      current = sentence;
      continue;
    }

    if (`${current} ${sentence}`.length <= maxChars) {
      current = `${current} ${sentence}`.trim();
    } else {
      chunks.push(current);
      current = sentence;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function detectSourceLanguage(input: string) {
  if (/[\u0900-\u097F]/.test(input)) {
    return "hi-IN" as const;
  }

  if (/^[\x00-\x7F\s.,!?;:'"()\-/%&]+$/.test(input)) {
    return "en-IN" as const;
  }

  return "auto" as const;
}

export async function ensureTextLanguage(input: string, language: "hindi" | "hinglish") {
  const client = getSarvamClient();

  if (!input.trim()) {
    return input;
  }

  const alreadyCompliant =
    language === "hindi" ? isHindiCompliant(input) : isHinglishCompliant(input);
  if (alreadyCompliant) {
    return input;
  }

  if (!client) {
    return null;
  }

  try {
    const chunks = splitForTranslation(input);
    if (chunks.length === 0) {
      return input;
    }

    const translatedParts = await Promise.all(
      chunks.map(async (chunk) => {
        const translated = await client.text.translate({
          input: chunk,
          source_language_code: detectSourceLanguage(chunk),
          target_language_code: "hi-IN",
          model: "mayura:v1",
          mode: language === "hinglish" ? "code-mixed" : "modern-colloquial",
          output_script:
            language === "hinglish" ? "roman" : "spoken-form-in-native",
          numerals_format: "international",
        });

        return translated.translated_text?.trim() || chunk;
      }),
    );

    const translatedText = translatedParts.join(" ").trim();
    const bestCandidate = pickBestLanguageCandidate(language, input, [translatedText]);
    const isCompliant =
      language === "hindi" ? isHindiCompliant(bestCandidate) : isHinglishCompliant(bestCandidate);

    return isCompliant ? bestCandidate : null;
  } catch {
    return null;
  }
}
