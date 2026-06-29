const estimates = new Map();

export function saveEstimate(record) {
  estimates.set(record.documentId, {
    ...record,
    updatedAt: new Date().toISOString(),
  });
  return estimates.get(record.documentId);
}

export function getEstimate(documentId) {
  return estimates.get(documentId) || null;
}

export function listEstimates() {
  return Array.from(estimates.values());
}
