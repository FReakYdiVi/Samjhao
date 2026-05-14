import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";

import { chunkDocument } from "@/lib/retrieval/chunker";
import { getSarvamClient } from "@/lib/sarvam/client";
import type { TextSection } from "@/lib/utils/text";
import {
  getExtractedDir,
  getExtractionCacheDir,
  writeExtractedDocument,
} from "@/lib/utils/file";
import { countTokensRoughly, markdownToPlainText, truncateText } from "@/lib/utils/text";

export interface ExtractedDocument {
  markdown: string;
  summary: string;
}

interface ExtractedPagePayload {
  markdown?: string;
  text?: string;
}

interface LoadedZipOutput {
  markdown: string;
  pages: ExtractedPagePayload[];
}

function getCachedExtractionPath(contentHash: string) {
  return path.join(getExtractionCacheDir(), `${contentHash}.json`);
}

async function readCachedExtraction(contentHash?: string) {
  if (!contentHash) {
    return null;
  }

  try {
    const raw = await readFile(getCachedExtractionPath(contentHash), "utf8");
    const parsed = JSON.parse(raw) as ExtractedDocument;
    const normalizedMarkdown = normalizeExtractedMarkdown(parsed.markdown, []);
    const normalizedSummary = summarizeMarkdown(normalizedMarkdown);

    if (
      typeof parsed.markdown === "string" &&
      normalizedMarkdown.trim().length > 0 &&
      normalizedSummary.trim().length > 0
    ) {
      return {
        markdown: normalizedMarkdown,
        summary: normalizedSummary,
      } satisfies ExtractedDocument;
    }

    return null;
  } catch {
    return null;
  }
}

async function writeCachedExtraction(contentHash: string | undefined, extracted: ExtractedDocument) {
  if (!contentHash) {
    return;
  }

  await writeFile(
    getCachedExtractionPath(contentHash),
    JSON.stringify(extracted, null, 2),
    "utf8",
  );
}

function toMeaningfulLine(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

function looksLikeStructuralNoise(line: string) {
  const normalized = toMeaningfulLine(line);

  if (!normalized) {
    return false;
  }

  return (
    /^https?:\/\//i.test(normalized) ||
    /^www\./i.test(normalized) ||
    /^page\s+\d+$/i.test(normalized) ||
    /^byju'?s$/i.test(normalized) ||
    /^the learning app$/i.test(normalized) ||
    /^cbse notes class \d+/i.test(normalized) ||
    /^class \d+ cbse notes/i.test(normalized) ||
    /^chapter \d+\s*[–-]/i.test(normalized) ||
    /^chapter \d+\b/i.test(normalized)
  );
}

function looksLikeAlwaysDropNoise(line: string) {
  const normalized = toMeaningfulLine(line);

  if (!normalized) {
    return false;
  }

  return (
    /^https?:\/\//i.test(normalized) ||
    /^www\./i.test(normalized) ||
    /^byju'?s$/i.test(normalized) ||
    /^the learning app$/i.test(normalized)
  );
}

function repeatedNoiseLines(pages: ExtractedPagePayload[]) {
  const pageLineCounts = new Map<string, number>();

  for (const page of pages) {
    const pageLines = new Set(
      (page.markdown || page.text || "")
        .split(/\r?\n/)
        .map((line) => toMeaningfulLine(markdownToPlainText(line)))
        .filter(Boolean)
        .filter((line) => line.length <= 120),
    );

    for (const line of pageLines) {
      pageLineCounts.set(line, (pageLineCounts.get(line) ?? 0) + 1);
    }
  }

  return new Set(
    Array.from(pageLineCounts.entries())
      .filter(([line, count]) => count >= 2 && (looksLikeStructuralNoise(line) || count >= 3))
      .map(([line]) => line),
  );
}

function normalizeExtractedMarkdown(markdown: string, pages: ExtractedPagePayload[]) {
  const recurringNoise = repeatedNoiseLines(pages);
  const normalizedLines: string[] = [];
  let previousLine = "";
  let blankStreak = 0;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const withoutTrailing = rawLine.replace(/\s+$/g, "");
    const plainLine = toMeaningfulLine(markdownToPlainText(withoutTrailing));
    const trimmed = withoutTrailing.trim();

    const shouldDrop =
      (!trimmed && blankStreak >= 1) ||
      (plainLine &&
        (looksLikeAlwaysDropNoise(plainLine) ||
          recurringNoise.has(plainLine) ||
          /^[-*_]{3,}$/.test(trimmed) ||
          /^data:image/i.test(trimmed)));

    if (shouldDrop) {
      continue;
    }

    if (!trimmed) {
      normalizedLines.push("");
      blankStreak += 1;
      previousLine = "";
      continue;
    }

    blankStreak = 0;

    if (trimmed === previousLine) {
      continue;
    }

    normalizedLines.push(trimmed);
    previousLine = trimmed;
  }

  return normalizedLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function summarizeMarkdown(markdown: string) {
  const headings = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^#{1,4}\s+/.test(line))
    .map((line) => line.replace(/^#{1,4}\s+/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
  const plain = markdownToPlainText(markdown).replace(/\s+/g, " ").trim();
  const intro = plain.slice(0, 180).trim();
  const headingSummary = headings.length > 0 ? `${headings.join(" · ")}.` : "";
  const summary = `${headingSummary} ${intro}`.trim();

  return summary.slice(0, 220) || "Uploaded study material";
}

function cleanDerivedSectionTitle(title: string) {
  return title
    .replace(/^#+\s*/, "")
    .replace(/^\d+[\].)\s-]?\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericSectionTitle(title: string) {
  const normalized = cleanDerivedSectionTitle(title).toLowerCase();

  return (
    !normalized ||
    normalized === "overview" ||
    normalized === "introduction" ||
    normalized.includes("cbse notes") ||
    normalized.includes("the learning app") ||
    normalized.includes("byju")
  );
}

function looksLikeTitleCandidate(line: string) {
  const normalized = cleanDerivedSectionTitle(line);
  const words = normalized.split(/\s+/).filter(Boolean);
  const lowercaseWords = words.filter((word) => /^[a-z]/.test(word)).length;

  if (!normalized || normalized.length < 8 || normalized.length > 90) {
    return false;
  }

  if (looksLikeAlwaysDropNoise(normalized)) {
    return false;
  }

  if (
    words.length > 10 ||
    lowercaseWords > Math.ceil(words.length / 2) ||
    /\b(deals with|will look|was to|were to|is the|was the|were the|this chapter)\b/i.test(
      normalized,
    )
  ) {
    return false;
  }

  if (/[.?!]$/.test(normalized) && words.length > 6) {
    return false;
  }

  return (
    /^[A-Z0-9]/.test(normalized) ||
    /^(\d+[\].)]\s+)?[A-Z][A-Za-z0-9'’:-]+(?:\s+[A-Z][A-Za-z0-9'’:-]+){1,}$/.test(normalized)
  );
}

function inferSectionTitle(section: TextSection) {
  const contentLines = section.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const titleCandidate = contentLines.find((line) => looksLikeTitleCandidate(line));

  if (titleCandidate) {
    return cleanDerivedSectionTitle(titleCandidate);
  }

  const firstSentence = markdownToPlainText(section.content)
    .split(/(?<=[.?!])\s+/)
    .map((sentence) => sentence.trim())
    .find((sentence) => sentence.length >= 20);

  if (firstSentence) {
    return truncateText(firstSentence.replace(/[.?!]+$/, ""), 72);
  }

  return cleanDerivedSectionTitle(section.section) || "Overview";
}

function stripLeadingEmbeddedTitle(section: TextSection, title: string) {
  const contentLines = section.content.split(/\r?\n/);
  const normalizedTitle = cleanDerivedSectionTitle(title).toLowerCase();
  const nextLines = [...contentLines];

  while (nextLines.length > 0) {
    const firstLine = nextLines[0].trim();
    const normalizedFirst = cleanDerivedSectionTitle(firstLine).toLowerCase();

    if (!firstLine) {
      nextLines.shift();
      continue;
    }

    if (normalizedFirst === normalizedTitle || looksLikeAlwaysDropNoise(normalizedFirst)) {
      nextLines.shift();
      continue;
    }

    break;
  }

  return nextLines.join("\n").trim() || section.content.trim();
}

export function deriveSectionRecords(markdown: string) {
  const rawSections = chunkDocument(markdown);
  const usedTitles = new Map<string, number>();

  return rawSections.map((section) => {
    const baseTitle = isGenericSectionTitle(section.section)
      ? inferSectionTitle(section)
      : cleanDerivedSectionTitle(section.section);
    const normalizedBase = baseTitle || "Overview";
    const seenCount = usedTitles.get(normalizedBase) ?? 0;
    usedTitles.set(normalizedBase, seenCount + 1);
    const finalTitle = seenCount > 0 ? `${normalizedBase} (${seenCount + 1})` : normalizedBase;
    const cleanedContent = stripLeadingEmbeddedTitle(section, normalizedBase);

    return {
      ...section,
      section: finalTitle,
      content: cleanedContent,
      preview: truncateText(markdownToPlainText(cleanedContent), 140),
      sourceRef: `${finalTitle} · chunk 1`,
      tokenCount: countTokensRoughly(cleanedContent),
    } satisfies TextSection;
  });
}

async function loadZipOutput(zipPath: string) {
  const buffer = await readFile(zipPath);
  const zip = await JSZip.loadAsync(buffer);
  const fileNames = Object.keys(zip.files);

  const markdownName = fileNames.find((name) => name.endsWith(".md"));
  const jsonName = fileNames.find((name) => name.endsWith(".json"));

  if (!markdownName && !jsonName) {
    throw new Error("Sarvam Vision returned an empty archive.");
  }

  const markdownFile = markdownName ? zip.file(markdownName) : null;
  const jsonFile = jsonName ? zip.file(jsonName) : null;

  if (!markdownFile && !jsonFile) {
    throw new Error("Sarvam Vision output could not be read.");
  }

  let pages: ExtractedPagePayload[] = [];

  if (jsonFile) {
    const rawJson = await jsonFile.async("string");
    const payload = JSON.parse(rawJson) as {
      pages?: Array<{ markdown?: string; text?: string }>;
    };

    pages = payload.pages ?? [];
  }

  const rawMarkdown =
    markdownFile
      ? await markdownFile.async("string")
      : pages
          .map((page) => page.markdown || page.text || "")
          .filter(Boolean)
          .join("\n\n");

  return {
    markdown: normalizeExtractedMarkdown(rawMarkdown, pages),
    pages,
  } satisfies LoadedZipOutput;
}

export async function extractDocumentText(params: {
  filePath: string;
  fileName: string;
  mimeType: string;
  languageCode: string;
  contentHash?: string;
}) {
  const cachedExtraction = await readCachedExtraction(params.contentHash);
  if (cachedExtraction) {
    return cachedExtraction;
  }

  const client = getSarvamClient();
  if (!client) {
    throw new Error(
      "PDF extraction needs SARVAM_API_KEY. You can still use the built-in demo notes without it.",
    );
  }

  const job = await client.documentIntelligence.createJob({
    language: params.languageCode as
      | "hi-IN"
      | "en-IN"
      | "bn-IN"
      | "gu-IN"
      | "kn-IN"
      | "ml-IN"
      | "mr-IN"
      | "or-IN"
      | "pa-IN"
      | "ta-IN"
      | "te-IN",
    outputFormat: "md",
    pollingIntervalMs: 2500,
    maxPollingAttempts: 120,
  });

  await job.uploadFile(params.filePath);
  await job.start();
  const status = await job.waitUntilComplete();

  if (status.job_state === "Failed") {
    throw new Error("Sarvam Vision could not extract this document.");
  }

  const archivePath = path.join(
    getExtractedDir(),
    `${path.basename(params.filePath)}-${job.jobId}.zip`,
  );
  await job.downloadOutput(archivePath);
  const output = await loadZipOutput(archivePath);
  await unlink(archivePath).catch(() => undefined);

  const extracted = {
    markdown: output.markdown,
    summary: summarizeMarkdown(output.markdown),
  } satisfies ExtractedDocument;

  await writeCachedExtraction(params.contentHash, extracted);

  return extracted;
}

export async function persistExtractedMarkdown(fileName: string, markdown: string) {
  return writeExtractedDocument(fileName, markdown);
}

export function previewSections(markdown: string) {
  return deriveSectionRecords(markdown).slice(0, 6).map((section) => section.section);
}
