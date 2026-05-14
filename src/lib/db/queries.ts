import { randomUUID } from "node:crypto";

import type { TextSection } from "@/lib/utils/text";

import { getDb } from "./client";

export interface StoredDocument {
  id: string;
  name: string;
  mimeType: string;
  storagePath: string;
  extractedPath: string;
  languageCode: string;
  sourceType: string;
  summary: string;
  createdAt: string;
}

export interface StoredChunk {
  id: string;
  documentId: string;
  documentName: string;
  documentSummary: string;
  documentLanguageCode: string;
  section: string;
  content: string;
  preview: string;
  sourceRef: string;
  rank: number;
  tokenCount: number;
  contextualPrefix: string;
  contextualizedContent: string;
  embedding: number[];
}

export interface StoredChatSession {
  id: string;
  documentId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  responseLanguage: "hinglish" | "hindi" | "english" | null;
  audioText: string | null;
  answerMode: "live" | null;
  sourceSnippets: string[];
  citations: Array<{
    documentId: string;
    documentName: string;
    sourceRef: string;
    preview: string;
    retrievalScore: number;
  }>;
  suggestedFollowups: string[];
  createdAt: string;
}

function mapDocument(row: Record<string, unknown>): StoredDocument {
  return {
    id: String(row.id),
    name: String(row.name),
    mimeType: String(row.mime_type),
    storagePath: String(row.storage_path),
    extractedPath: String(row.extracted_path),
    languageCode: String(row.language_code),
    sourceType: String(row.source_type),
    summary: String(row.summary),
    createdAt: String(row.created_at),
  };
}

function mapChunk(row: Record<string, unknown>): StoredChunk {
  const rawEmbedding = String(row.embedding_json ?? "");

  return {
    id: String(row.id),
    documentId: String(row.document_id),
    documentName: String(row.document_name ?? ""),
    documentSummary: String(row.document_summary ?? ""),
    documentLanguageCode: String(row.document_language_code ?? "hi-IN"),
    section: String(row.section),
    content: String(row.content),
    preview: String(row.preview),
    sourceRef: String(row.source_ref),
    rank: Number(row.rank),
    tokenCount: Number(row.token_count),
    contextualPrefix: String(row.contextual_prefix ?? ""),
    contextualizedContent: String(
      row.contextualized_content ?? row.content ?? "",
    ),
    embedding: rawEmbedding ? (JSON.parse(rawEmbedding) as number[]) : [],
  };
}

function parseStoredJsonList<T>(value: unknown, defaultValue: T): T {
  if (typeof value !== "string" || value.trim().length === 0) {
    return defaultValue;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
}

function mapChatSession(row: Record<string, unknown>): StoredChatSession {
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    title: String(row.title),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapChatMessage(row: Record<string, unknown>): StoredChatMessage {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    role: String(row.role) === "assistant" ? "assistant" : "user",
    content: String(row.content),
    responseLanguage:
      row.response_language === "hinglish" ||
      row.response_language === "hindi" ||
      row.response_language === "english"
        ? row.response_language
        : null,
    audioText:
      typeof row.audio_text === "string" && row.audio_text.length > 0
        ? row.audio_text
        : null,
    answerMode:
      row.answer_mode === "live"
        ? row.answer_mode
        : null,
    sourceSnippets: parseStoredJsonList(row.source_snippets_json, [] as string[]),
    citations: parseStoredJsonList(
      row.citations_json,
      [] as StoredChatMessage["citations"],
    ),
    suggestedFollowups: parseStoredJsonList(
      row.suggested_followups_json,
      [] as string[],
    ),
    createdAt: String(row.created_at),
  };
}

export function insertDocument(input: {
  name: string;
  mimeType: string;
  storagePath: string;
  extractedPath: string;
  languageCode: string;
  sourceType: string;
  summary: string;
}) {
  const db = getDb();
  const id = randomUUID();

  db.prepare(
    `
      INSERT INTO documents (
        id, name, mime_type, storage_path, extracted_path, language_code, source_type, summary
      ) VALUES (
        @id, @name, @mimeType, @storagePath, @extractedPath, @languageCode, @sourceType, @summary
      )
    `,
  ).run({
    id,
    ...input,
  });

  return getDocumentById(id);
}

export function replaceChunksForDocument(documentId: string, sections: TextSection[]) {
  const db = getDb();

  db.prepare("DELETE FROM chunks WHERE document_id = ?").run(documentId);

  const insert = db.prepare(
    `
      INSERT INTO chunks (
        id, document_id, section, content, preview, source_ref, rank, contextual_prefix, contextualized_content, embedding_json, token_count
      ) VALUES (
        @id, @documentId, @section, @content, @preview, @sourceRef, @rank, @contextualPrefix, @contextualizedContent, @embeddingJson, @tokenCount
      )
    `,
  );

  const transaction = db.transaction((records: TextSection[]) => {
    records.forEach((section, index) => {
      insert.run({
        id: randomUUID(),
        documentId,
        section: section.section,
        content: section.content,
        preview: section.preview,
        sourceRef: section.sourceRef,
        rank: index,
        contextualPrefix: section.contextualPrefix ?? "",
        contextualizedContent: section.contextualizedContent ?? section.content,
        embeddingJson: JSON.stringify(section.embedding ?? []),
        tokenCount: section.tokenCount,
      });
    });
  });

  transaction(sections);
}

export function listDocuments() {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM documents ORDER BY datetime(created_at) DESC")
    .all() as Record<string, unknown>[];

  return rows.map(mapDocument);
}

export function listRecentDocuments(limit = 3) {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM documents ORDER BY datetime(created_at) DESC LIMIT ?")
    .all(limit) as Record<string, unknown>[];

  return rows.map(mapDocument);
}

export function getDocumentById(documentId: string) {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM documents WHERE id = ?")
    .get(documentId) as Record<string, unknown> | undefined;

  return row ? mapDocument(row) : null;
}

export function getLatestDocument() {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM documents ORDER BY datetime(created_at) DESC LIMIT 1")
    .get() as Record<string, unknown> | undefined;

  return row ? mapDocument(row) : null;
}

export function getChunksForDocument(documentId: string) {
  const db = getDb();
  const rows = db
    .prepare(
      `
        SELECT
          c.*,
          d.name AS document_name,
          d.summary AS document_summary,
          d.language_code AS document_language_code
        FROM chunks c
        JOIN documents d ON d.id = c.document_id
        WHERE c.document_id = ?
        ORDER BY c.rank ASC
      `,
    )
    .all(documentId) as Record<string, unknown>[];

  return rows.map(mapChunk);
}

export function getChunksForDocuments(documentIds: string[]) {
  if (documentIds.length === 0) {
    return [] as StoredChunk[];
  }

  const db = getDb();
  const placeholders = documentIds.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `
        SELECT
          c.*,
          d.name AS document_name,
          d.summary AS document_summary,
          d.language_code AS document_language_code,
          d.created_at AS document_created_at
        FROM chunks c
        JOIN documents d ON d.id = c.document_id
        WHERE c.document_id IN (${placeholders})
        ORDER BY datetime(d.created_at) DESC, c.rank ASC
      `,
    )
    .all(...documentIds) as Record<string, unknown>[];

  return rows.map(mapChunk);
}

export function updateChunkEmbeddings(chunks: Array<{ id: string; embedding: number[] }>) {
  if (chunks.length === 0) {
    return;
  }

  const db = getDb();
  const statement = db.prepare(
    "UPDATE chunks SET embedding_json = @embeddingJson WHERE id = @id",
  );
  const transaction = db.transaction(
    (records: Array<{ id: string; embedding: number[] }>) => {
      records.forEach((record) => {
        statement.run({
          id: record.id,
          embeddingJson: JSON.stringify(record.embedding),
        });
      });
    },
  );

  transaction(chunks);
}

export function deleteDocumentById(documentId: string) {
  const db = getDb();
  const document = getDocumentById(documentId);

  if (!document) {
    return null;
  }

  db.prepare("DELETE FROM documents WHERE id = ?").run(documentId);
  return document;
}

export function deleteAllDocuments() {
  const db = getDb();
  const documents = listDocuments();

  db.prepare("DELETE FROM documents").run();
  return documents;
}

export function createChatSession(input: {
  documentId: string;
  title: string;
}) {
  const db = getDb();
  const id = randomUUID();

  db.prepare(
    `
      INSERT INTO chat_sessions (
        id, document_id, title
      ) VALUES (
        @id, @documentId, @title
      )
    `,
  ).run({
    id,
    ...input,
  });

  return getChatSessionById(id);
}

export function listChatSessions(documentId?: string | null) {
  const db = getDb();
  const rows = documentId
    ? (db
        .prepare(
          `
            SELECT *
            FROM chat_sessions
            WHERE document_id = ?
            ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC
          `,
        )
        .all(documentId) as Record<string, unknown>[])
    : (db
        .prepare(
          `
            SELECT *
            FROM chat_sessions
            ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC
          `,
        )
        .all() as Record<string, unknown>[]);

  return rows.map(mapChatSession);
}

export function getChatSessionById(sessionId: string) {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM chat_sessions WHERE id = ?")
    .get(sessionId) as Record<string, unknown> | undefined;

  return row ? mapChatSession(row) : null;
}

export function getLatestChatSession(documentId?: string | null) {
  const db = getDb();
  const row = documentId
    ? ((db
        .prepare(
          `
            SELECT *
            FROM chat_sessions
            WHERE document_id = ?
            ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC
            LIMIT 1
          `,
        )
        .get(documentId) as Record<string, unknown> | undefined))
    : ((db
        .prepare(
          `
            SELECT *
            FROM chat_sessions
            ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC
            LIMIT 1
          `,
        )
        .get() as Record<string, unknown> | undefined));

  return row ? mapChatSession(row) : null;
}

export function listMessagesForSession(sessionId: string) {
  const db = getDb();
  const rows = db
    .prepare(
      `
        SELECT *
        FROM chat_messages
        WHERE session_id = ?
        ORDER BY datetime(created_at) ASC, rowid ASC
      `,
    )
    .all(sessionId) as Record<string, unknown>[];

  return rows.map(mapChatMessage);
}

export function updateChatSessionTitle(sessionId: string, title: string) {
  const db = getDb();

  db.prepare(
    `
      UPDATE chat_sessions
      SET title = @title, updated_at = CURRENT_TIMESTAMP
      WHERE id = @sessionId
    `,
  ).run({
    sessionId,
    title,
  });

  return getChatSessionById(sessionId);
}

export function touchChatSession(sessionId: string) {
  const db = getDb();

  db.prepare(
    `
      UPDATE chat_sessions
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(sessionId);
}

export function getChatMessageById(messageId: string) {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM chat_messages WHERE id = ?")
    .get(messageId) as Record<string, unknown> | undefined;

  return row ? mapChatMessage(row) : null;
}

export function insertChatMessage(input: {
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  responseLanguage?: "hinglish" | "hindi" | "english";
  audioText?: string;
  answerMode?: "live";
  sourceSnippets?: string[];
  citations?: StoredChatMessage["citations"];
  suggestedFollowups?: string[];
}) {
  const db = getDb();
  const id = randomUUID();

  db.prepare(
    `
      INSERT INTO chat_messages (
        id,
        session_id,
        role,
        content,
        response_language,
        audio_text,
        answer_mode,
        source_snippets_json,
        citations_json,
        suggested_followups_json
      ) VALUES (
        @id,
        @sessionId,
        @role,
        @content,
        @responseLanguage,
        @audioText,
        @answerMode,
        @sourceSnippetsJson,
        @citationsJson,
        @suggestedFollowupsJson
      )
    `,
  ).run({
    id,
    sessionId: input.sessionId,
    role: input.role,
    content: input.content,
    responseLanguage: input.responseLanguage ?? null,
    audioText: input.audioText ?? null,
    answerMode: input.answerMode ?? null,
    sourceSnippetsJson: JSON.stringify(input.sourceSnippets ?? []),
    citationsJson: JSON.stringify(input.citations ?? []),
    suggestedFollowupsJson: JSON.stringify(input.suggestedFollowups ?? []),
  });

  touchChatSession(input.sessionId);

  return getChatMessageById(id);
}
