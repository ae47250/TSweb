import { readJson, json } from "../../../lib/api.js";
import { renderCustomerDocument } from "../../../lib/customerDocument.js";
import { getEstimate, saveEstimate } from "../../../lib/estimateStore.js";
import { SIGNATURE_MAX_LENGTH, SIGNATURE_MIN_LENGTH } from "../../../config/constants.js";

export const runtime = "nodejs";

function htmlDataUrl(html) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

export async function POST(request) {
  const body = await readJson(request);
  const alphaJson = body.alphaJson;
  const selectedOption = body.selectedOption || "";
  const signature = String(body.signature || "").trim();

  if (!alphaJson?.document?.number) {
    return json({ error: "Missing document ID." }, { status: 400 });
  }
  if (!selectedOption) {
    return json({ error: "Please select an option and sign." }, { status: 400 });
  }
  if (signature.length < SIGNATURE_MIN_LENGTH || signature.length > SIGNATURE_MAX_LENGTH) {
    return json({ error: "Please select an option and sign." }, { status: 400 });
  }

  const signedFullHtml = renderCustomerDocument(alphaJson, { selectedOption, signature, mobile: false });
  const signedMobileHtml = renderCustomerDocument(alphaJson, { selectedOption, signature, mobile: true });
  const existing = getEstimate(alphaJson.document.number) || {};
  const record = saveEstimate({
    ...existing,
    documentId: alphaJson.document.number,
    alphaJson,
    selected_option: selectedOption,
    signature_name: signature,
    signature_date: new Date().toISOString(),
    status: "signed",
    pdf_url_full: htmlDataUrl(signedFullHtml),
    pdf_url_mobile: htmlDataUrl(signedMobileHtml),
  });

  return json({
    documentId: record.documentId,
    status: record.status,
    selectedOption,
    signatureName: signature,
    stored: true,
    mockedStorage: process.env.VERCEL_BLOB_ENABLED !== "true",
  });
}
