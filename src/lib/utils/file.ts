import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

import type { StoredDocument } from "@/lib/db/queries";

const DATA_DIR = path.join(process.cwd(), "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const EXTRACTED_DIR = path.join(DATA_DIR, "extracted");
const EXTRACTION_CACHE_DIR = path.join(EXTRACTED_DIR, ".vision-cache");

export function getUploadsDir() {
  return UPLOADS_DIR;
}

export function getExtractedDir() {
  return EXTRACTED_DIR;
}

export function getExtractionCacheDir() {
  return EXTRACTION_CACHE_DIR;
}

export async function ensureDataDirectories() {
  await Promise.all([
    mkdir(DATA_DIR, { recursive: true }),
    mkdir(UPLOADS_DIR, { recursive: true }),
    mkdir(EXTRACTED_DIR, { recursive: true }),
    mkdir(EXTRACTION_CACHE_DIR, { recursive: true }),
  ]);
}

export function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function saveUploadedFile(file: File) {
  await ensureDataDirectories();

  const safeName = sanitizeFileName(file.name || "document");
  const uniqueName = `${Date.now()}-${randomUUID()}-${safeName}`;
  const filePath = path.join(UPLOADS_DIR, uniqueName);
  const buffer = Buffer.from(await file.arrayBuffer());
  const contentHash = createHash("sha256").update(buffer).digest("hex");

  await writeFile(filePath, buffer);

  return {
    filePath,
    mimeType: file.type || "application/octet-stream",
    fileName: safeName,
    contentHash,
  };
}

export async function writeExtractedDocument(baseName: string, content: string) {
  await ensureDataDirectories();
  const filePath = path.join(
    EXTRACTED_DIR,
    `${Date.now()}-${randomUUID()}-${sanitizeFileName(baseName)}.md`,
  );
  await writeFile(filePath, content, "utf8");
  return filePath;
}

export async function readUtf8File(filePath: string) {
  return readFile(filePath, "utf8");
}

export function relativeDataPath(absolutePath: string) {
  return path.relative(process.cwd(), absolutePath);
}

async function removeIfPresent(filePath: string) {
  if (!filePath) {
    return;
  }

  await rm(filePath, { force: true });
}

export async function cleanupDocumentFiles(document: StoredDocument) {
  await removeIfPresent(document.extractedPath);

  if (document.sourceType === "upload") {
    await removeIfPresent(document.storagePath);
  }
}
