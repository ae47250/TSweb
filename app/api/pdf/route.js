import { readJson, json, requestIp } from "../../../lib/api.js";
import { renderCustomerDocument } from "../../../lib/customerDocument.js";
import { saveEstimate } from "../../../lib/estimateStore.js";
import { checkRateLimit } from "../../../lib/rateLimiter.js";
import { validateAlphaJson } from "../../../lib/validateJson.js";

export const runtime = "nodejs";
export const maxDuration = 60;

function htmlDataUrl(html) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

export async function POST(request) {
  const limit = checkRateLimit(requestIp(request));
  if (!limit.allowed) {
    return json(
      { error: "Too many document requests. Please try again later.", retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = await readJson(request);
  const validation = validateAlphaJson(body.alphaJson);
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

  saveEstimate({
    documentId,
    status: "approved",
    alphaJson,
    pdf_url_full: htmlDataUrl(fullHtml),
    pdf_url_mobile: htmlDataUrl(mobileHtml),
  });

  return json({
    documentId,
    alphaJson,
    full: {
      format: "html-fallback",
      html: fullHtml,
      htmlDataUrl: htmlDataUrl(fullHtml),
    },
    mobile: {
      format: "html-fallback",
      html: mobileHtml,
      htmlDataUrl: htmlDataUrl(mobileHtml),
    },
    note: "HTML customer documents are generated. Puppeteer PDF rendering can be enabled after dependencies and Chromium are installed.",
  });
}
