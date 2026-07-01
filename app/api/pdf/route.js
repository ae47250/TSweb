import { readJson, json, requestIp } from "../../../lib/api.js";
import { hasBlobConfig } from "../../../lib/blobStore.js";
import { renderCustomerDocument } from "../../../lib/customerDocument.js";
import { createDownloadFile } from "../../../lib/documentFiles.js";
import { saveEstimate } from "../../../lib/estimateStore.js";
import { normalizeToAlphaJsonV14 } from "../../../lib/normalizeAlphaJson.js";
import { checkRateLimit } from "../../../lib/rateLimiter.js";
import { validateAlphaJson } from "../../../lib/validateJson.js";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  const limit = checkRateLimit(requestIp(request));
  if (!limit.allowed) {
    return json(
      { error: "Too many document requests. Please try again later.", retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = await readJson(request);
  const alphaJsonForValidation = normalizeToAlphaJsonV14(
    body.alphaJson,
    body.customer_text || body.customerText || body.alphaJson?.raw_input?.customer_text || "",
    body.intake || {},
  );
  const validation = validateAlphaJson(alphaJsonForValidation);
  if (!validation.can_generate_pdf) {
    return json(
      {
        error: "Blocking issues must be fixed before generating customer documents.",
        blocking_errors: validation.blocking_errors,
        follow_ups: validation.follow_ups,
      },
      { status: 400 },
    );
  }

  const alphaJson = validation.alphaJson;
  alphaJson.document.approved_for_pdf = true;
  alphaJson.review.approved_for_pdf = true;
  alphaJson.review.review_completed = true;
  alphaJson.validation.can_generate_pdf = true;

  const fullHtml = renderCustomerDocument(alphaJson, { mobile: false });
  const mobileHtml = renderCustomerDocument(alphaJson, { mobile: true });
  const documentId = alphaJson.document.number;
  const [full, mobile] = await Promise.all([
    createDownloadFile(fullHtml, { documentId, variant: "full", mobile: false }),
    createDownloadFile(mobileHtml, { documentId, variant: "mobile", mobile: true }),
  ]);
  const customerEstimateUrl = new URL(`/e/${encodeURIComponent(documentId)}`, request.url).toString();

  const record = await saveEstimate({
    documentId,
    status: "approved",
    alphaJson,
    customerEstimateUrl,
    documents: { full, mobile },
    pdf_url_full: full.downloadUrl,
    pdf_url_mobile: mobile.downloadUrl,
  });

  return json({
    documentId,
    alphaJson,
    customerEstimateUrl,
    full,
    mobile,
    mockedStorage: !hasBlobConfig(),
    blobStorage: record.blobStorage,
    note:
      full.format === "pdf" && mobile.format === "pdf"
        ? "PDF customer documents generated."
        : "HTML fallback generated because Puppeteer PDF rendering was not available.",
  });
}
