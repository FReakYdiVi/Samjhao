export interface TextSection {
  section: string;
  content: string;
  preview: string;
  sourceRef: string;
  tokenCount: number;
  contextualPrefix?: string;
  contextualizedContent?: string;
  embedding?: number[];
}

export type ResponseLanguage = "hinglish" | "hindi" | "english";

const STOPWORDS = new Set([
  "the",
  "is",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "what",
  "why",
  "how",
  "hai",
  "ka",
  "ki",
  "ko",
  "samajh",
  "nahi",
  "mein",
  "main",
]);

export function normalizeText(input: string) {
  return input.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
}

export function tokenize(input: string) {
  return normalizeText(input)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

export function truncateText(input: string, maxLength = 180) {
  const compact = input.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength - 1).trim()}…`;
}

export function countTokensRoughly(input: string) {
  return tokenize(input).length;
}

export function markdownToPlainText(markdown: string) {
  return markdownToPlainTextPreserveBreaks(markdown)
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function markdownToPlainTextPreserveBreaks(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[#>*_~-]/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitIntoSentences(input: string) {
  return markdownToPlainText(input)
    .split(/(?<=[.?!])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

export function dedupeRepeatedSentences(input: string) {
  const sentences = splitIntoSentences(input);

  if (sentences.length === 0) {
    return markdownToPlainText(input);
  }

  const deduped: string[] = [];

  for (const sentence of sentences) {
    const normalizedSentence = normalizeText(sentence).trim();
    const previousSentence = deduped[deduped.length - 1];
    const normalizedPrevious = previousSentence
      ? normalizeText(previousSentence).trim()
      : "";

    if (normalizedSentence && normalizedSentence !== normalizedPrevious) {
      deduped.push(sentence);
    }
  }

  return deduped.join(" ");
}

export function dedupeRepeatedSentencesPreserveBreaks(input: string) {
  const readable = markdownToPlainTextPreserveBreaks(input);

  if (!readable) {
    return readable;
  }

  const seen = new Set<string>();
  const paragraphs = readable.split(/\n{2,}/);
  const cleanedParagraphs = paragraphs
    .map((paragraph) => {
      const sentences = paragraph
        .split(/(?<=[.?!])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);

      if (sentences.length === 0) {
        return paragraph.trim();
      }

      const deduped = sentences.filter((sentence) => {
        const normalized = normalizeText(sentence).trim();

        if (!normalized || seen.has(normalized)) {
          return false;
        }

        seen.add(normalized);
        return true;
      });

      return deduped.join(" ").trim();
    })
    .filter(Boolean);

  return cleanedParagraphs.join("\n\n").trim();
}

export function splitIntoSections(markdown: string, maxChunkLength = 900): TextSection[] {
  const lines = markdown.split(/\r?\n/);
  const sections: TextSection[] = [];

  let currentHeading = "Overview";
  let currentBuffer: string[] = [];
  let currentCount = 1;

  const flush = () => {
    const content = currentBuffer.join("\n").trim();
    if (!content) {
      return;
    }

    sections.push({
      section: currentHeading,
      content,
      preview: truncateText(markdownToPlainText(content), 140),
      sourceRef: `${currentHeading} · chunk ${currentCount}`,
      tokenCount: countTokensRoughly(content),
    });
    currentCount += 1;
    currentBuffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const isHeading = /^#{1,4}\s+/.test(trimmed);
    const pendingLength = currentBuffer.join("\n").length + line.length;

    if (isHeading) {
      flush();
      currentHeading = trimmed.replace(/^#{1,4}\s+/, "").trim() || "Overview";
      currentCount = 1;
      continue;
    }

    if (pendingLength > maxChunkLength) {
      flush();
    }

    if (trimmed) {
      currentBuffer.push(trimmed);
    }
  }

  flush();

  if (sections.length === 0 && markdown.trim()) {
    return [
      {
        section: "Overview",
        content: markdown.trim(),
        preview: truncateText(markdownToPlainText(markdown), 140),
        sourceRef: "Overview · chunk 1",
        tokenCount: countTokensRoughly(markdown),
      },
    ];
  }

  return sections;
}

export function rankMatch(question: string, text: string) {
  const questionTokens = tokenize(question);
  const textTokens = new Set(tokenize(text));

  let score = 0;
  for (const token of questionTokens) {
    if (textTokens.has(token)) {
      score += 1;
    }
  }

  return score / Math.max(questionTokens.length, 1);
}
