import type { StoredChunk } from "@/lib/db/queries";
import { mergeSearchResults } from "@/lib/retrieval/merge-results";
import { buildRetrievalWorkflowPlan } from "@/lib/retrieval/planner";
import { rerankSearchResults } from "@/lib/retrieval/rerank";
import { textSearch } from "@/lib/retrieval/text-search";
import { vectorSearch } from "@/lib/retrieval/vector-search";

export async function runAskRetrievalWorkflow(params: {
  question: string;
  chunks: StoredChunk[];
  preferredDocumentId?: string | null;
  candidateLimit?: number;
  finalLimit?: number;
  documentName?: string;
  sections?: string[];
  languageCode?: string;
}) {
  const candidateChunks =
    params.preferredDocumentId
      ? params.chunks.filter((chunk) => chunk.documentId === params.preferredDocumentId)
      : params.chunks;

  if (candidateChunks.length === 0) {
    return {
      plan: await buildRetrievalWorkflowPlan({
        question: params.question,
        documentName: params.documentName,
        sections: params.sections,
        languageCode: params.languageCode,
      }),
      relevantChunks: [],
      usedVectorSearch: false,
    };
  }

  const plan = await buildRetrievalWorkflowPlan({
    question: params.question,
    documentName: params.documentName,
    sections: params.sections,
    languageCode: params.languageCode,
  });

  const intermediateLimit = Math.max((params.candidateLimit ?? 10) * 2, 12);
  const textHits = textSearch(plan.queryVariants, candidateChunks, {
    limit: intermediateLimit,
  });
  const vectorHits = await vectorSearch(plan.queryVariants, candidateChunks, {
    limit: intermediateLimit,
  });
  const mergedCandidates = mergeSearchResults(textHits, vectorHits);
  const relevantChunks = rerankSearchResults({
    question: params.question,
    plan,
    candidates: mergedCandidates,
    candidateLimit: params.candidateLimit,
    finalLimit: params.finalLimit,
    preferredDocumentId: params.preferredDocumentId,
  });

  return {
    plan,
    relevantChunks,
    usedVectorSearch: vectorHits.length > 0,
  };
}
