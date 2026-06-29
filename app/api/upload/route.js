import { readJson, json } from "../../../lib/api.js";
import { renderCustomerDocument } from "../../../lib/customerDocument.js";
import { hasBlobConfig, saveSignedPdf, saveSignedResult } from "../../../lib/blobStore.js";
import { createDownloadFile } from "../../../lib/documentFiles.js";
import { getEstimate, saveEstimate } from "../../../lib/estimateStore.js";
import { SIGNATURE_MAX_LENGTH, SIGNATURE_MIN_LENGTH } from "../../../config/constants.js";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await readJson(request);
  const alphaJson = body.alphaJson;
  const selectedOption = body.selectedOption || "";
  const signature = String(body.signature || "").trim();
  const checkboxAccepted = body.checkboxAccepted === true;

  if (!alphaJson?.document?.number) {
    return json({ error: "Missing document ID." }, { status: 400 });
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
  const signedAt = new Date();
  const signedAtDisplay = signedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const signedFullHtml = renderCustomerDocument(alphaJson, { selectedOption, signature, signedAtDisplay, mobile: false });
  const signedMobileHtml = renderCustomerDocument(alphaJson, { selectedOption, signature, signedAtDisplay, mobile: true });
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
  const existing = await getEstimate(alphaJson.document.number) || {};
  const record = await saveEstimate({
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
    mockedStorage: !hasBlobConfig(),
  });
}
