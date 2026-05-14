import Database from "better-sqlite3";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

import { ensureDataDirectories } from "@/lib/utils/file";

import { schemaStatements } from "./schema";

let db: Database.Database | null = null;
let bootCleanupDone = false;

function cleanupPersistedDocumentsOnBoot(database: Database.Database) {
  const shouldReset =
    process.env.NODE_ENV !== "production" &&
    process.env.SAMJHAO_PERSIST_SOURCES !== "true";

  if (!shouldReset || bootCleanupDone) {
    return;
  }

  const rows = database
    .prepare(
      "SELECT storage_path, extracted_path, source_type FROM documents",
    )
    .all() as Array<{
    storage_path: string;
    extracted_path: string;
    source_type: string;
  }>;

  for (const row of rows) {
    if (row.extracted_path) {
      rmSync(row.extracted_path, { force: true });
    }

    if (row.source_type === "upload" && row.storage_path) {
      rmSync(row.storage_path, { force: true });
    }
  }

  database.prepare("DELETE FROM chunks").run();
  database.prepare("DELETE FROM documents").run();
  mkdirSync(path.join(process.cwd(), "data", "uploads"), { recursive: true });
  mkdirSync(path.join(process.cwd(), "data", "extracted"), { recursive: true });
  bootCleanupDone = true;
}

function ensureColumn(
  database: Database.Database,
  tableName: string,
  columnName: string,
  columnDefinition: string,
) {
  const rows = database
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;
  const columnExists = rows.some((row) => row.name === columnName);

  if (!columnExists) {
    database.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`).run();
  }
}

export function getDb() {
  if (!db) {
    const dataPath = path.join(process.cwd(), "data", "samjhao.db");
    void ensureDataDirectories();
    db = new Database(dataPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    for (const statement of schemaStatements) {
      db.prepare(statement).run();
    }

    ensureColumn(
      db,
      "chunks",
      "contextual_prefix",
      "contextual_prefix TEXT NOT NULL DEFAULT ''",
    );
    ensureColumn(
      db,
      "chunks",
      "contextualized_content",
      "contextualized_content TEXT NOT NULL DEFAULT ''",
    );
    ensureColumn(
      db,
      "chunks",
      "embedding_json",
      "embedding_json TEXT NOT NULL DEFAULT ''",
    );
    cleanupPersistedDocumentsOnBoot(db);
  }

  return db;
}
