import { tokenize } from "@/lib/utils/text";

const BM25_K1 = 1.5;
const BM25_B = 0.75;

export interface BM25Document {
  id: string;
  text: string;
}

export function scoreBm25(query: string, documents: BM25Document[]) {
  if (documents.length === 0) {
    return new Map<string, number>();
  }

  const queryTerms = tokenize(query);
  const tokenizedDocs = documents.map((document) => ({
    id: document.id,
    terms: tokenize(document.text),
  }));
  const averageDocLength =
    tokenizedDocs.reduce((sum, document) => sum + document.terms.length, 0) /
    tokenizedDocs.length;

  const documentFrequency = new Map<string, number>();

  tokenizedDocs.forEach((document) => {
    const uniqueTerms = new Set(document.terms);
    uniqueTerms.forEach((term) => {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    });
  });

  const scores = new Map<string, number>();

  tokenizedDocs.forEach((document) => {
    const termFrequency = new Map<string, number>();
    document.terms.forEach((term) => {
      termFrequency.set(term, (termFrequency.get(term) ?? 0) + 1);
    });

    let score = 0;

    queryTerms.forEach((term) => {
      const tf = termFrequency.get(term) ?? 0;
      if (tf === 0) {
        return;
      }

      const df = documentFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (documents.length - df + 0.5) / (df + 0.5));
      const denominator =
        tf +
        BM25_K1 *
          (1 - BM25_B + BM25_B * (document.terms.length / Math.max(averageDocLength, 1)));
      score += idf * ((tf * (BM25_K1 + 1)) / denominator);
    });

    scores.set(document.id, score);
  });

  return scores;
}
