import { readJson, json } from "../../../lib/api.js";
import { renderCustomerDocument } from "../../../lib/customerDocument.js";
import { hasBlobConfig, saveAcceptedPdf, saveManualAcceptance } from "../../../lib/blobStore.js";
import { createDownloadFile } from "../../../lib/documentFiles.js";
import { getEstimate, saveEstimate } from "../../../lib/estimateStore.js";

export const runtime = "nodejs";

const METHODS = new Set(["SMS/text", "phone call/voice", "email", "in person", "other"]);

export async function POST(request) {
  const body = await readJson(request);
  const estimateId = body.estimateId || body.alphaJson?.document?.number;
  const acceptedOption = body.acceptedOption || "";
  const approvalMethod = body.approvalMethod || "";
  const customerNote = String(body.customerNote || "").trim();
  const signatureName = String(body.signatureName || "").trim();

  if (!estimateId) return json({ error: "Missing estimate ID." }, { status: 400 });
  if (!acceptedOption) return json({ error: "Please choose the accepted option." }, { status: 400 });
  if (!METHODS.has(approvalMethod)) return json({ error: "Please choose a valid approval method." }, { status: 400 });
  if (!customerNote) return json({ error: "Please enter the customer acceptance note or reply." }, { status: 400 });

  const existing = await getEstimate(estimateId) || {};
  const alphaJson = existing.alphaJson || body.alphaJson;
  if (!alphaJson?.document?.number) return json({ error: "Estimate was not found." }, { status: 404 });

  const selected = (alphaJson.service_options?.items || []).find((option) => option.label === acceptedOption) || {};
  const acceptedAt = body.acceptedAt ? new Date(body.acceptedAt) : new Date();
  const acceptedAtDisplay = acceptedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const manualAcceptance = {
    estimateId,
    customerName: alphaJson.customer?.name || "",
    customerPhone: alphaJson.customer?.phone_display || alphaJson.customer?.phone_primary || "",
    customerEmail: alphaJson.customer?.email || "",
    serviceAddress: alphaJson.job?.service_address?.display || "",
    selectedOptionId: acceptedOption,
    selectedOptionLabel: acceptedOption,
    selectedOptionDescription: selected.description || selected.title || "",
    selectedOptionPrice: selected.price?.display || "",
    approvalMethod,
    customerNote,
    signatureName,
    acceptedAt: acceptedAt.toISOString(),
    acceptedAtDisplay,
    acceptanceSource: "manual",
  };

  const acceptedHtml = renderCustomerDocument(alphaJson, {
    selectedOption: acceptedOption,
    signature: signatureName,
    signedAtDisplay: acceptedAtDisplay,
    mobile: false,
  });
  const accepted = await createDownloadFile(acceptedHtml, { documentId: estimateId, variant: "accepted", mobile: false, signed: false });
  accepted.downloadUrl = `/api/estimates/${encodeURIComponent(estimateId)}/pdf/accepted`;
  accepted.filename = accepted.format === "pdf" ? `${estimateId}-accepted.pdf` : `${estimateId}-accepted.html`;

  const manualBlob = await saveManualAcceptance(estimateId, manualAcceptance);
  const acceptedPdfBlob = accepted.format === "pdf" && accepted.pdfBase64
    ? await saveAcceptedPdf(estimateId, Buffer.from(accepted.pdfBase64, "base64"))
    : { stored: false, reason: "Accepted PDF was not generated; HTML fallback is available." };
  const record = await saveEstimate({
    ...existing,
    documentId: estimateId,
    alphaJson,
    status: "accepted_manually",
    selected_option: acceptedOption,
    manualAcceptance,
    acceptedAt: manualAcceptance.acceptedAt,
    acceptedAtDisplay,
    accepted: { full: accepted },
    pdf_url_accepted: accepted.downloadUrl,
  });

  return json({
    documentId: record.documentId,
    status: record.status,
    manualAcceptance,
    accepted,
    manualBlob,
    acceptedPdfBlob,
    mockedStorage: !hasBlobConfig(),
  });
}
