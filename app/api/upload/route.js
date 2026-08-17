import { readJson, json } from "../../../lib/api.js";
import { renderCustomerDocument } from "../../../lib/customerDocument.js";
import { hasBlobConfig, saveSignedPdf, saveSignedResult } from "../../../lib/blobStore.js";
import { createDownloadFile } from "../../../lib/documentFiles.js";
import { saveEstimate } from "../../../lib/estimateStore.js";
import { SIGNATURE_MAX_LENGTH, SIGNATURE_MIN_LENGTH } from "../../../config/constants.js";
import { loadTrustedEstimateBoundary } from "../../../lib/trustedEstimateBoundary.js";
import { emitCustomerPipelineDelivery } from "../../../lib/customerPipeline.js";
import {
  customerAccessTokenFromRequest,
  verifyCustomerAccessToken,
} from "../../../lib/customerAccess.js";
import { isStrictDeliveryStage, productionConfigurationErrors } from "../../../lib/productionReadiness.js";
import { notifyContractor } from "../../../lib/notifications.js";

export const runtime = "nodejs";

export async function POST(request) {
  const configurationErrors = productionConfigurationErrors();
  if (configurationErrors.length) {
    return json({ error: "Production delivery configuration is incomplete.", configurationErrors }, { status: 503 });
  }
  const body = await readJson(request);
  const documentId = body.documentId || body.alphaJson?.document?.number || "";
  const selectedOption = body.selectedOption || "";
  const signature = String(body.signature || "").trim();
  const checkboxAccepted = body.checkboxAccepted === true;

  const trusted = await loadTrustedEstimateBoundary(documentId);
  if (!trusted.ok) return json({ error: trusted.error, blocking_errors: trusted.blocking_errors }, { status: trusted.status });
  const { alphaJson, customerView, record: existing } = trusted;
  if (!verifyCustomerAccessToken(
    customerAccessTokenFromRequest(request),
    documentId,
    existing.customerAccessVersion,
  )) {
    return json({ error: "This customer estimate link is invalid or expired." }, { status: 401 });
  }
  if (["signed", "accepted_manually"].includes(existing.status)) {
    const sameSignature = existing.status === "signed" &&
      existing.selected_option === selectedOption &&
      existing.signature_name === signature &&
      existing.checkboxAccepted === true;
    if (sameSignature) {
      return json({
        documentId: existing.documentId,
        status: existing.status,
        selectedOption: existing.selected_option,
        signatureName: existing.signature_name,
        signedAt: existing.signedAt,
        signedAtDisplay: existing.signedAtDisplay,
        checkboxAccepted: true,
        signed: existing.signed?.full,
        contractorNotification: existing.contractorNotification,
        idempotentReplay: true,
      });
    }
    return json({ error: "This estimate already has a recorded acceptance and cannot be signed again." }, { status: 409 });
  }
  if (!selectedOption) {
    return json({ error: "Please select an option and sign." }, { status: 400 });
  }
  if (!checkboxAccepted) {
    return json({ error: "Please accept electronic signature consent before submitting." }, { status: 400 });
  }
  if (signature.length < SIGNATURE_MIN_LENGTH || signature.length > SIGNATURE_MAX_LENGTH) {
    return json({ error: "Please select an option and sign." }, { status: 400 });
  }

  const selected = (alphaJson.service_options?.items || []).find((option) => option.label === selectedOption) || {};
  if (!selected.label) {
    return json({ error: "Please select a valid option from the trusted estimate." }, { status: 400 });
  }
  const signedAt = new Date();
  const signedAtDisplay = signedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const signedFullHtml = renderCustomerDocument(customerView, { selectedOption, signature, signedAtDisplay, mobile: false });
  const signedMobileHtml = renderCustomerDocument(customerView, { selectedOption, signature, signedAtDisplay, mobile: true });
  const [signedFull, signedMobile] = await Promise.all([
    createDownloadFile(signedFullHtml, { documentId: alphaJson.document.number, variant: "full", mobile: false, signed: true }),
    createDownloadFile(signedMobileHtml, { documentId: alphaJson.document.number, variant: "mobile", mobile: true, signed: true }),
  ]);
  const signedResult = {
    estimateId: alphaJson.document.number,
    customerName: alphaJson.customer?.name || "",
    customerPhone: alphaJson.customer?.phone_display || alphaJson.customer?.phone_primary || "",
    customerEmail: alphaJson.customer?.email || "",
    serviceAddress: alphaJson.job?.service_address?.display || "",
    selectedOptionId: selectedOption,
    selectedOptionLabel: selectedOption,
    selectedOptionDescription: selected.description || selected.title || "",
    selectedOptionPrice: selected.price?.display || "",
    signatureName: signature,
    checkboxAccepted,
    signedAt: signedAt.toISOString(),
    signedAtDisplay,
    acceptanceSource: "customer_app",
  };
  const signedBlob = await saveSignedResult(alphaJson.document.number, signedResult);
  const signedPdfBlob = signedFull.format === "pdf" && signedFull.pdfBase64
    ? await saveSignedPdf(alphaJson.document.number, Buffer.from(signedFull.pdfBase64, "base64"))
    : { stored: false, reason: "Signed PDF was not generated; HTML fallback is available." };
  if (isStrictDeliveryStage() && (!signedBlob.stored || !signedPdfBlob.stored)) {
    return json({
      error: "The signed estimate could not be durably stored. No acceptance status was recorded.",
      storageErrors: [signedBlob, signedPdfBlob].filter((result) => !result.stored).map((result) => result.reason),
    }, { status: 503 });
  }
  let record = await saveEstimate({
    ...existing,
    documentId: alphaJson.document.number,
    alphaJson,
    selected_option: selectedOption,
    signature_name: signature,
    signature_date: signedResult.signedAt,
    signedAt: signedResult.signedAt,
    signedAtDisplay,
    checkboxAccepted,
    signedResult,
    status: "signed",
    signed: {
      full: signedFull,
      mobile: signedMobile,
    },
    pdf_url_signed: signedFull.downloadUrl,
  });
  let contractorNotification = null;
  try {
    contractorNotification = await notifyContractor({
      documentId: alphaJson.document.number,
      customerName: signedResult.customerName,
      address: signedResult.serviceAddress,
      selectedOption,
      price: signedResult.selectedOptionPrice,
      signedAtDisplay,
      estimateUrl: existing.customerEstimateUrl,
    });
    record = await saveEstimate({ ...record, contractorNotification: { status: "sent", result: contractorNotification } });
  } catch (error) {
    contractorNotification = { status: "pending", error: error.message || "Contractor notification failed." };
    record = await saveEstimate({ ...record, contractorNotification });
  }
  await emitCustomerPipelineDelivery({
    documentId: alphaJson.document.number,
    policy: trusted.policy,
    validation: trusted.validation,
    parity: trusted.parity,
    surface: "customer_signature",
    decisions: alphaJson.review?.readiness_decisions || alphaJson.review?.reviewer_decision_log || [],
  });

  return json({
    documentId: record.documentId,
    status: record.status,
    selectedOption,
    signatureName: signature,
    signedAt: signedResult.signedAt,
    signedAtDisplay,
    checkboxAccepted,
    signed: signedFull,
    stored: true,
    signedBlob,
    signedPdfBlob,
    contractorNotification,
    mockedStorage: !hasBlobConfig(),
  }, { status: contractorNotification?.status === "pending" ? 202 : 200 });
}
