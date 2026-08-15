import { readJson, json } from "../../../lib/api.js";
import { renderCustomerDocument } from "../../../lib/customerDocument.js";
import { hasBlobConfig, saveAcceptedPdf, saveManualAcceptance } from "../../../lib/blobStore.js";
import { createDownloadFile } from "../../../lib/documentFiles.js";
import { saveEstimate } from "../../../lib/estimateStore.js";
import { loadTrustedEstimateBoundary } from "../../../lib/trustedEstimateBoundary.js";
import { emitCustomerPipelineDelivery } from "../../../lib/customerPipeline.js";
import { requireContractorSession } from "../../../lib/contractorAuth.js";
import { isStrictDeliveryStage, productionConfigurationErrors } from "../../../lib/productionReadiness.js";

export const runtime = "nodejs";

const METHODS = new Set([
  "SMS/text",
  "phone call/voice",
  "email",
  "in person",
  "other",
  "Phone call",
  "Text reply",
  "Email reply",
  "In person",
  "Other",
]);

export async function POST(request) {
  const configurationErrors = productionConfigurationErrors();
  if (configurationErrors.length) {
    return json({ error: "Production delivery configuration is incomplete.", configurationErrors }, { status: 503 });
  }
  const auth = requireContractorSession(request, { csrf: true });
  if (!auth.ok) return auth.response;
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

  const trusted = await loadTrustedEstimateBoundary(estimateId);
  if (!trusted.ok) return json({ error: trusted.error, blocking_errors: trusted.blocking_errors }, { status: trusted.status });
  const { alphaJson, customerView, record: existing } = trusted;

  if (["signed", "accepted_manually"].includes(existing.status)) {
    const prior = existing.manualAcceptance;
    const sameAcceptance = existing.status === "accepted_manually" &&
      prior?.selectedOptionLabel === acceptedOption &&
      prior?.approvalMethod === approvalMethod &&
      prior?.customerNote === customerNote &&
      prior?.signatureName === signatureName;
    if (sameAcceptance) {
      return json({
        documentId: existing.documentId,
        status: existing.status,
        manualAcceptance: prior,
        accepted: existing.accepted?.full,
        idempotentReplay: true,
      });
    }
    return json({ error: "This estimate already has a recorded acceptance." }, { status: 409 });
  }

  const selected = (alphaJson.service_options?.items || []).find((option) => option.label === acceptedOption) || {};
  if (!selected.label) return json({ error: "Please select a valid option from the trusted estimate." }, { status: 400 });
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

  const acceptedHtml = renderCustomerDocument(customerView, {
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
  if (isStrictDeliveryStage() && (!manualBlob.stored || !acceptedPdfBlob.stored)) {
    return json({
      error: "The accepted estimate could not be durably stored. No acceptance status was recorded.",
      storageErrors: [manualBlob, acceptedPdfBlob].filter((result) => !result.stored).map((result) => result.reason),
    }, { status: 503 });
  }
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
  await emitCustomerPipelineDelivery({
    documentId: estimateId,
    policy: trusted.policy,
    validation: trusted.validation,
    parity: trusted.parity,
    surface: "manual_acceptance",
    decisions: alphaJson.review?.readiness_decisions || alphaJson.review?.reviewer_decision_log || [],
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
