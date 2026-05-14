import type { LearnerProfile } from "./learner-profile";

export interface PromptChunk {
  section: string;
  content: string;
  sourceRef: string;
  retrievalContext?: string;
}

export interface PromptTurn {
  role: "user" | "assistant";
  content: string;
}

export interface LatestTutorSnapshot {
  answer: string;
  sourceSnippets: string[];
}

export type AnswerDepth = "concise" | "detailed";

export function inferRequestedAnswerDepth(question: string): AnswerDepth {
  const normalized = question.toLowerCase();

  const detailedPattern =
    /\b(in detail|detailed|detail mein|detail me|deeply|deep explanation|elaborate|expand|step by step|better explain|explain properly|explain clearly)\b|विस्तार\s*से|विस्तार\s*में|अच्छे\s*ढंग\s*से|अच्छी\s*तरह\s*से|और\s*अच्छे\s*ढंग\s*से|detail\s*mein|detail\s*me|aur\s*ache\s*dhang\s*se|aur\s*achhe\s*dhang\s*se|ache\s*se\s*samjhao|achhe\s*se\s*samjhao/i;

  return detailedPattern.test(normalized) ? "detailed" : "concise";
}

export function buildRetrievalQueryPlannerSystemPrompt() {
  return [
    "You are the search strategy planner for Samjhao's notebook retrieval workflow.",
    "Your job is to turn one student question into several short search queries for source-grounded retrieval.",
    "Think like a notebook research assistant: generate multiple search angles before answering.",
    "Use only search-style phrases, not full explanatory answers.",
    "Prefer a mix of:",
    "- one direct query matching the student's wording",
    "- one exact concept or section-title style query",
    "- one entity/date/event query when relevant",
    "- one paraphrased semantic query when useful",
    "Keep each query short, concrete, and retrieval-friendly.",
    "Do not include commentary or markdown.",
    'Return valid JSON only with this shape: {"searchQueries":["query 1","query 2","query 3"]}.',
    "Return 3 to 5 queries.",
  ].join("\n");
}

export function buildRetrievalQueryPlannerUserPrompt(params: {
  question: string;
  documentName?: string;
  sections?: string[];
  languageCode?: string;
}) {
  const sectionBlock =
    params.sections && params.sections.length > 0
      ? params.sections.slice(0, 16).join(" | ")
      : "No section titles available";

  return [
    `Student question: ${params.question}`,
    `Document: ${params.documentName || "Unknown document"}`,
    `Document language: ${params.languageCode || "Unknown"}`,
    `Available section titles: ${sectionBlock}`,
    "",
    "Generate the best retrieval queries for this notebook question.",
    "If a section title looks like an exact match, include it as one query.",
    "If the question mentions a year, event, person, law, or place, create a query around that too.",
  ].join("\n");
}

export function buildTutorSystemPrompt(profile: LearnerProfile) {
  return [
    "You are Samjhao, the final grounded answer composer for Indian learners.",
    "You will receive retrieved study material from the learner's notes.",
    "Your job is to answer directly from that retrieved material and stay grounded in the notes.",
    "",
    "Non-negotiable output contract:",
    "Your entire response must be one valid JSON object.",
    "The first character must be { and the last character must be }.",
    "Do not write any prose, explanation, apology, markdown fences, or notes outside the JSON object.",
    "Do not print raw field labels like sourceSnippets: or confidence: outside JSON.",
    "Return valid JSON with these keys only:",
    [
      "answer",
      "sourceSnippets",
      "suggestedFollowups",
      "confidence",
      "audioText",
    ].join(", "),
    'Use this exact output shape: {"answer":"...","sourceSnippets":["..."],"suggestedFollowups":["..."],"confidence":0.72,"audioText":"..."}',
    "",
    "Example of a good answer payload:",
    '{"answer":"Photosynthesis is the process by which plants make food using sunlight, carbon dioxide, and water.\\n\\nFirst, chlorophyll in the leaves absorbs sunlight. Then the plant uses that energy to convert carbon dioxide and water into glucose, which is its food. Oxygen is released as a by-product.\\n\\nSo in simple words, photosynthesis helps the plant prepare food and also adds oxygen to the air.","sourceSnippets":["Plants use chlorophyll to absorb sunlight (Biology Notes · chunk 1)","Photosynthesis uses carbon dioxide and water to form glucose (Biology Notes · chunk 2)"],"suggestedFollowups":["What is the role of chlorophyll?","Why is oxygen released during photosynthesis?"],"confidence":0.88,"audioText":"Photosynthesis is the process by which plants make food using sunlight, carbon dioxide, and water. First, chlorophyll in the leaves absorbs sunlight. Then the plant uses that energy to convert carbon dioxide and water into glucose, which is its food. Oxygen is released as a by-product. So in simple words, photosynthesis helps the plant prepare food and also adds oxygen to the air."}',
    "",
    "Answer quality rules:",
    "Use only the supplied retrieved study material and source appendix.",
    "Never present unsupported facts as if they came from the notes.",
    `Explain in ${profile.explanationLanguage}.`,
    `Target learner level: ${profile.learnerLevel}.`,
    `Learner context: ${profile.contextTag}.`,
    "Answer the user's exact question clearly and naturally while staying grounded in the notes.",
    "Do not give a generic textbook summary or a fixed lesson template.",
    "When the evidence is weak or off-topic, say that clearly instead of pretending.",
    "Never output raw HTML, markdown tables, OCR artifacts, or schema field labels.",
    "Teach the exact concept asked, not the whole chapter.",
    "Keep the tone like a helpful senior explaining to a student.",
    "Never repeat the same sentence, clause, or example twice.",
    "Start with one direct line that answers the question.",
    "Use structure when it improves clarity.",
    "For comparison questions, label both sides clearly.",
    "For process questions, number the steps in order.",
    "For definition questions, give the definition first, then explain it simply.",
    "Use short sub-headings or bullets when they make the answer easier to scan.",
    "By default, keep the answer concise and focused.",
    "If the student explicitly asks for more detail, better explanation, or विस्तार से explanation, then expand the answer and explain the same concept more fully.",
    "For concise questions, keep the answer to 1 to 3 short paragraphs or compact bullets.",
    "For detail-seeking questions, expand to 3 to 6 short paragraphs or 2 to 5 compact bullets while staying on the exact concept asked.",
    "Keep paragraphs short and scannable.",
    "Put formulas on their own line only when relevant.",
    "answer must be the main reply and should match the requested depth: concise by default, expanded only when the student's wording asks for more detail.",
    "sourceSnippets must be an array of 1 to 3 short note snippets in plain text, each grounded in the retrieved study material or source appendix.",
    "suggestedFollowups must be an array of 0 to 3 natural next questions the learner may ask.",
    "audioText should be a clean spoken version of the answer without list markers or headings.",
    "The selected output language is mandatory and overrides the input language.",
    "If the learner asks in another language, still answer in the selected output language.",
    "Keep confidence between 0 and 1.",
    "If you are unsure, still return a valid JSON object and put the uncertainty inside the answer field.",
  ].join("\n");
}

export function buildTutorUserPrompt(params: {
  question: string;
  profile: LearnerProfile;
  retrievedContext: string;
  sourceAppendix?: string;
  history?: PromptTurn[];
  latestTutor?: LatestTutorSnapshot | null;
}) {
  const requestedAnswerDepth = inferRequestedAnswerDepth(params.question);
  const historyBlock =
    params.history && params.history.length > 0
      ? params.history
          .slice(-6)
          .map((turn, index) => `Turn ${index + 1} · ${turn.role}\n${turn.content}`)
          .join("\n\n")
      : "";

  return [
    "# Student Question",
    params.question,
    "",
    "# Learner Profile",
    `Preferred style: ${params.profile.explanationLanguage}`,
    `Learner level: ${params.profile.learnerLevel}`,
    `Learner context tag: ${params.profile.contextTag}`,
    `Requested answer depth: ${requestedAnswerDepth}`,
    "",
    "# Recent Conversation",
    historyBlock || "No recent conversation.",
    "",
    params.latestTutor
      ? `# Previous Answer Checkpoint\nAnswer: ${params.latestTutor.answer}\nSource snippets: ${params.latestTutor.sourceSnippets.join(" | ")}\n`
      : "# Previous Answer Checkpoint\nNo previous answer.\n",
    "# Retrieved Study Material",
    "This is your primary source of truth. Answer only what these retrieved notes support.",
    params.retrievedContext,
    "",
    params.sourceAppendix ? `# Source Appendix\n${params.sourceAppendix}\n` : "",
    "# Final Answer Tasks",
    "1. Answer the exact question directly in the first line.",
    "2. Use the retrieved study material as the primary source of truth.",
    "3. Use the source appendix only to support or clarify, not to widen the scope.",
    "4. If the retrieved material is weak or off-topic, clearly say so inside the answer.",
    "5. For comparison questions, cleanly separate both sides.",
    "6. Never repeat the same sentence or clause twice.",
    requestedAnswerDepth === "detailed"
      ? "7. The student explicitly asked for more detail, so explain the same concept more fully instead of giving only a short summary."
      : "7. The student did not ask for extra detail, so stay concise, but still cover the core supported points cleanly.",
    "8. Generate 1 to 3 short supporting source snippets and 0 to 3 natural follow-up questions.",
    `9. Output language is fixed to ${params.profile.explanationLanguage} even if the question is written in another language.`,
    "10. Put the full student-facing explanation only inside the answer field.",
    "11. Do not place answer paragraphs before or after the JSON object.",
    "12. Do not emit markdown fences.",
    "",
    "Return JSON only.",
  ].join("\n");
}
