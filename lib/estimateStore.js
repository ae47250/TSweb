import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hasBlobConfig, loadEstimatePackage, saveEstimatePackage } from "./blobStore.js";

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

export async function saveEstimate(record) {
  const existing = estimates.get(record.documentId) || readStoredEstimate(record.documentId) || {};
  const saved = {
    ...existing,
    ...record,
    updatedAt: new Date().toISOString(),
    mockedStorage: !hasBlobConfig(),
  };
  const blob = await saveEstimatePackage(record.documentId, saved);
  saved.localFileStorage = writeStoredEstimate(saved);
  saved.blobStorage = blob;
  estimates.set(record.documentId, saved);
  return saved;
}

export async function getEstimate(documentId) {
  const record = await loadEstimatePackage(documentId) || readStoredEstimate(documentId) || estimates.get(documentId);
  if (record) estimates.set(documentId, record);
  return record || null;
}

export function listEstimates() {
  return Array.from(estimates.values());
}
