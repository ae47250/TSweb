import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  hasBlobConfig,
  loadEstimateIndex,
  loadEstimatePackage,
  saveEstimateIndex,
  saveEstimatePackage,
} from "./blobStore.js";

const estimates = new Map();
const storeDir = join(process.cwd(), "data", "estimates");
const indexFile = join(storeDir, "index.json");

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

function readStoredIndex() {
  try {
    if (!existsSync(indexFile)) return [];
    const parsed = JSON.parse(readFileSync(indexFile, "utf8"));
    return Array.isArray(parsed?.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

function writeStoredIndex(items) {
  try {
    mkdirSync(storeDir, { recursive: true });
    writeFileSync(indexFile, JSON.stringify({ items }), "utf8");
    return true;
  } catch {
    return false;
  }
}

function optionSummary(record) {
  const manual = record.manualAcceptance;
  const signed = record.signedResult;
  const selected = manual?.selectedOptionLabel || signed?.selectedOptionLabel || record.selected_option || "";
  const price = manual?.selectedOptionPrice || signed?.selectedOptionPrice || "";
  return [selected, price].filter(Boolean).join(" - ");
}

function statusLabel(record) {
  if (record.status === "accepted_manually") return "Manual Acceptance Recorded";
  if (record.status === "signed") return "Signed Estimate Received";
  if (record.status === "approved") return "Quote Confirmed";
  return "Draft";
}

function displayTime(record) {
  if (record.acceptedAtDisplay) return record.acceptedAtDisplay;
  if (record.signedAtDisplay) return record.signedAtDisplay;
  if (!record.updatedAt) return "";
  try {
    return new Date(record.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
}

function summarizeEstimate(record) {
  return {
    documentId: record.documentId,
    customerName: record.alphaJson?.customer?.name || record.manualAcceptance?.customerName || "Customer",
    status: statusLabel(record),
    lastActivityTime: displayTime(record),
    updatedAt: record.updatedAt || new Date().toISOString(),
    customerEstimateUrl: record.customerEstimateUrl || `/e/${encodeURIComponent(record.documentId)}`,
    optionSummary: optionSummary(record),
    signedDownloadUrl: record.signed?.full?.downloadUrl || "",
    savedDownloadUrl: record.accepted?.full?.downloadUrl || "",
  };
}

function mergeIndexItems(...groups) {
  return groups
    .flat()
    .filter((item) => item?.documentId)
    .reduce((items, item) => {
      if (!items.some((existing) => existing.documentId === item.documentId)) items.push(item);
      return items;
    }, [])
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
}

async function updateEstimateIndex(record) {
  const blobIndex = await loadEstimateIndex();
  const blobItems = Array.isArray(blobIndex?.items) ? blobIndex.items : [];
  const merged = mergeIndexItems([summarizeEstimate(record)], readStoredIndex(), blobItems).slice(0, 20);
  writeStoredIndex(merged);
  await saveEstimateIndex({ items: merged, updatedAt: new Date().toISOString() });
  return merged;
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
  await updateEstimateIndex(saved);
  return saved;
}

export async function getEstimate(documentId) {
  const record = await loadEstimatePackage(documentId) || readStoredEstimate(documentId) || estimates.get(documentId);
  if (record) estimates.set(documentId, record);
  return record || null;
}

export async function listEstimates() {
  const blobIndex = await loadEstimateIndex();
  const blobItems = Array.isArray(blobIndex?.items) ? blobIndex.items : [];
  const memoryItems = Array.from(estimates.values()).map(summarizeEstimate);
  return mergeIndexItems(memoryItems, readStoredIndex(), blobItems);
}
