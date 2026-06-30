import { get, put } from "@vercel/blob";

export const BLOB_STORE_NAME = "TSwebAppBlob";
const PREFIX = "alphatree/estimates";

export function estimateIndexPath() {
  return `${PREFIX}/index.json`;
}

export function estimatePath(estimateId) {
  return `${PREFIX}/${encodeURIComponent(estimateId)}/estimate.json`;
}

export function signedResultPath(estimateId) {
  return `${PREFIX}/${encodeURIComponent(estimateId)}/signed-result.json`;
}

export function manualAcceptancePath(estimateId) {
  return `${PREFIX}/${encodeURIComponent(estimateId)}/manual-acceptance.json`;
}

export function signedPdfPath(estimateId) {
  return `${PREFIX}/${encodeURIComponent(estimateId)}/signed-estimate.pdf`;
}

export function acceptedPdfPath(estimateId) {
  return `${PREFIX}/${encodeURIComponent(estimateId)}/accepted-estimate.pdf`;
}

export function hasBlobConfig() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN),
  );
}

export function blobMissingMessage() {
  return "Vercel Blob is not configured. Connect the private Blob store TSwebAppBlob to the tsweb project.";
}

async function saveJson(path, data) {
  if (!hasBlobConfig()) return { stored: false, reason: blobMissingMessage(), path };
  try {
    const result = await put(path, JSON.stringify(data), {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json",
    });
    return { stored: true, path, pathname: result.pathname };
  } catch (error) {
    return { stored: false, reason: error.message, path };
  }
}

async function loadJson(path) {
  if (!hasBlobConfig()) return null;
  try {
    const result = await get(path, { access: "private" });
    if (!result?.stream) return null;
    return JSON.parse(await new Response(result.stream).text());
  } catch {
    return null;
  }
}

export async function saveEstimatePackage(estimateId, data) {
  return saveJson(estimatePath(estimateId), data);
}

export async function loadEstimatePackage(estimateId) {
  return loadJson(estimatePath(estimateId));
}

export async function saveEstimateIndex(data) {
  return saveJson(estimateIndexPath(), data);
}

export async function loadEstimateIndex() {
  return loadJson(estimateIndexPath());
}

export async function saveSignedResult(estimateId, data) {
  return saveJson(signedResultPath(estimateId), data);
}

export async function loadSignedResult(estimateId) {
  return loadJson(signedResultPath(estimateId));
}

export async function saveManualAcceptance(estimateId, data) {
  return saveJson(manualAcceptancePath(estimateId), data);
}

export async function loadManualAcceptance(estimateId) {
  return loadJson(manualAcceptancePath(estimateId));
}

export async function saveSignedPdf(estimateId, bytes) {
  return savePdf(signedPdfPath(estimateId), bytes);
}

export async function saveAcceptedPdf(estimateId, bytes) {
  return savePdf(acceptedPdfPath(estimateId), bytes);
}

async function savePdf(path, bytes) {
  if (!hasBlobConfig()) return { stored: false, reason: blobMissingMessage(), path };
  try {
    const result = await put(path, bytes, {
      access: "private",
      allowOverwrite: true,
      contentType: "application/pdf",
    });
    return { stored: true, path, pathname: result.pathname };
  } catch (error) {
    return { stored: false, reason: error.message, path };
  }
}
