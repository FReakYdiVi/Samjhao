export const schemaStatements = [
  `
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      extracted_path TEXT NOT NULL,
      language_code TEXT NOT NULL DEFAULT 'hi-IN',
      source_type TEXT NOT NULL DEFAULT 'upload',
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      section TEXT NOT NULL,
      content TEXT NOT NULL,
      preview TEXT NOT NULL,
      source_ref TEXT NOT NULL,
      rank INTEGER NOT NULL,
      contextual_prefix TEXT NOT NULL DEFAULT '',
      contextualized_content TEXT NOT NULL DEFAULT '',
      embedding_json TEXT NOT NULL DEFAULT '',
      token_count INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      response_language TEXT,
      audio_text TEXT,
      answer_mode TEXT,
      source_snippets_json TEXT NOT NULL DEFAULT '[]',
      citations_json TEXT NOT NULL DEFAULT '[]',
      suggested_followups_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    )
  `,
];
