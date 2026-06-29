import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const estimates = new Map();
const storeDir = join(process.cwd(), "data", "estimates");

function recordPath(documentId) {
  return join(storeDir, `${encodeURIComponent(documentId)}.json`);
}

function readStoredEstimate(documentId) {
  try {
    const path = recordPath(documentId);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function writeStoredEstimate(record) {
  try {
    mkdirSync(storeDir, { recursive: true });
    writeFileSync(recordPath(record.documentId), JSON.stringify(record), "utf8");
    return true;
  } catch {
    return false;
  }
}

export function saveEstimate(record) {
  const existing = estimates.get(record.documentId) || readStoredEstimate(record.documentId) || {};
  const saved = {
    ...existing,
    ...record,
    updatedAt: new Date().toISOString(),
    mockedStorage: process.env.VERCEL_BLOB_ENABLED !== "true",
  };
  saved.localFileStorage = writeStoredEstimate(saved);
  estimates.set(record.documentId, saved);
  return saved;
}

export function getEstimate(documentId) {
  const record = readStoredEstimate(documentId) || estimates.get(documentId);
  if (record) estimates.set(documentId, record);
  return record || null;
}

export function listEstimates() {
  return Array.from(estimates.values());
}
