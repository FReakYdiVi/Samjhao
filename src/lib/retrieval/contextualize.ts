import { getSarvamClient } from "@/lib/sarvam/client";
import type { TextSection } from "@/lib/utils/text";
import { truncateText } from "@/lib/utils/text";

const CONTEXT_BATCH_SIZE = 6;

interface ContextualizationParams {
  documentName: string;
  documentSummary: string;
  languageCode: string;
  sections: TextSection[];
}

function buildHeuristicPrefix(params: {
  documentName: string;
  documentSummary: string;
  languageCode: string;
  section: string;
  index: number;
  total: number;
}) {
  const summary = truncateText(params.documentSummary, 180);
  return [
    `Document: ${params.documentName}.`,
    `Section: ${params.section}.`,
    `Chunk ${params.index + 1} of ${params.total}.`,
    `Primary language: ${params.languageCode}.`,
    `Document summary: ${summary}`,
  ].join(" ");
}

function stripJsonFence(input: string) {
  return input
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function normalizeContextList(
  raw: string,
  count: number,
): Array<{ id: string; context: string }> | null {
  try {
    const parsed = JSON.parse(stripJsonFence(raw)) as Array<{
      id: string;
      context: string;
    }>;

    if (!Array.isArray(parsed) || parsed.length !== count) {
      return null;
    }

    return parsed.map((item) => ({
      id: String(item.id),
      context: String(item.context || "").trim(),
    }));
  } catch {
    return null;
  }
}

async function contextualizeBatchWithSarvam(params: {
  documentName: string;
  documentSummary: string;
  sections: Array<TextSection & { batchId: string }>;
}) {
  const client = getSarvamClient();
  if (!client) {
    return null;
  }

  const response = await client.chat.completions({
    model: "sarvam-30b",
    temperature: 0.1,
    max_tokens: 900,
    reasoning_effort: "low",
    messages: [
      {
        role: "system",
        content: [
          "You are a contextual retrieval preprocessor.",
          "For each chunk, write one short search-oriented context sentence that situates it within the whole document.",
          "The context must mention the document topic and what this chunk is specifically about.",
          "Do not repeat the whole chunk.",
          "Do not add markdown.",
          "Return only valid JSON as an array of objects with keys: id, context.",
          'Example: [{"id":"chunk-1","context":"This chunk explains ..."}]',
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            documentName: params.documentName,
            documentSummary: truncateText(params.documentSummary, 900),
            chunks: params.sections.map((section) => ({
              id: section.batchId,
              section: section.section,
              preview: truncateText(section.preview, 200),
              content: truncateText(section.content, 420),
            })),
          },
          null,
          2,
        ),
      },
    ],
  });

  const content = response.choices[0]?.message.content;
  if (!content) {
    return null;
  }

  return normalizeContextList(content, params.sections.length);
}

export async function contextualizeSections({
  documentName,
  documentSummary,
  languageCode,
  sections,
}: ContextualizationParams): Promise<TextSection[]> {
  const enriched = sections.map((section, index) => {
    const contextualPrefix = buildHeuristicPrefix({
      documentName,
      documentSummary,
      languageCode,
      section: section.section,
      index,
      total: sections.length,
    });

    return {
      ...section,
      contextualPrefix,
      contextualizedContent: `${contextualPrefix}\n\n${section.content}`,
    };
  });

  const client = getSarvamClient();
  if (!client || enriched.length === 0) {
    return enriched;
  }

  const contextualized = [...enriched];

  for (let offset = 0; offset < contextualized.length; offset += CONTEXT_BATCH_SIZE) {
    const batch = contextualized
      .slice(offset, offset + CONTEXT_BATCH_SIZE)
      .map((section, index) => ({
        ...section,
        batchId: `chunk-${offset + index + 1}`,
      }));

    try {
      const generated = await contextualizeBatchWithSarvam({
        documentName,
        documentSummary,
        sections: batch,
      });

      if (!generated) {
        continue;
      }

      const contextById = new Map(generated.map((entry) => [entry.id, entry.context]));
      batch.forEach((section, index) => {
        const generatedContext = contextById.get(section.batchId);
        if (!generatedContext) {
          return;
        }

        contextualized[offset + index] = {
          ...contextualized[offset + index],
          contextualPrefix: generatedContext,
          contextualizedContent: `${generatedContext}\n\n${contextualized[offset + index].content}`,
        };
      });
    } catch {
      // Keep heuristic contextualization if live contextualization fails.
    }
  }

  return contextualized;
}
