import { readJson, json, requestIp } from "../../../lib/api.js";
import { hasBlobConfig } from "../../../lib/blobStore.js";
import { renderCustomerDocument, renderTreeDudeDocument } from "../../../lib/customerDocument.js";
import { createDownloadFile } from "../../../lib/documentFiles.js";
import { saveEstimate } from "../../../lib/estimateStore.js";
import { checkRateLimit } from "../../../lib/rateLimiter.js";
import { getBlockingOverrideStatus, normalizeReviewOverrides } from "../../../lib/reviewOverrides.js";
import { validateAlphaJsonRoutePayload } from "../../../lib/validateRoutePayload.js";

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
  const validation = validateAlphaJsonRoutePayload(body);
  if (!validation) {
    return json({ error: "No AlphaJSON payload was provided." }, { status: 400 });
  }
  const structuralBlockingErrors = validation.alphaJson?.validation?.structural_blocking_errors || [];
  if (structuralBlockingErrors.length) {
    return json(
      {
        error: "Final customer option structure must be fixed before generating customer documents.",
        blocking_errors: structuralBlockingErrors,
        follow_ups: validation.follow_ups,
      },
      { status: 400 },
    );
  }
  const reviewOverrides = normalizeReviewOverrides(body.reviewOverrides || body.overrides);
  const overrideStatus = getBlockingOverrideStatus(validation, reviewOverrides, validation.alphaJson);
  const canGenerateWithOverrides = overrideStatus.canProceed;
  if (!canGenerateWithOverrides) {
    return json(
      {
        error: "Blocking issues must be fixed before generating customer documents.",
        blocking_errors: overrideStatus.remainingBlockingErrors.length
          ? overrideStatus.remainingBlockingErrors
          : validation.blocking_errors,
        follow_ups: validation.follow_ups,
      },
      { status: 400 },
    );
  }

  const alphaJson = validation.alphaJson;
  alphaJson.document.approved_for_pdf = true;
  alphaJson.review.approved_for_pdf = true;
  alphaJson.review.review_completed = true;
  alphaJson.review.approved_semantic_hash = alphaJson.validation?.estimate_semantic_hash || "";
  alphaJson.review.approved_final_option_structural_hash = alphaJson.validation?.final_option_structural_hash || "";
  alphaJson.review.approved_final_option_render_binding = alphaJson.validation?.final_option_render_binding || null;
  alphaJson.review.overrides = reviewOverrides;
  alphaJson.review.override_warnings = overrideStatus.acceptedOverrideWarnings;
  alphaJson.review.contractor_warnings = [
    ...overrideStatus.acceptedOverrideWarnings,
    ...(validation.warnings || []).map((warning) => ({
      title: "Review note",
      message: warning,
    })),
  ];
  alphaJson.validation.can_generate_pdf = true;
  alphaJson.validation.overridden_blocking_errors = overrideStatus.acceptedOverrideWarnings.map((warning) => warning.title);

  const overrideWarnings = overrideStatus.acceptedOverrideWarnings;
  const contractorWarnings = alphaJson.review.contractor_warnings;
  const fullHtml = renderCustomerDocument(alphaJson, { mobile: false });
  const mobileHtml = renderCustomerDocument(alphaJson, { mobile: true });
  const documentId = alphaJson.document.number;
  const documentJobs = [
    createDownloadFile(fullHtml, { documentId, variant: "full", mobile: false }),
    createDownloadFile(mobileHtml, { documentId, variant: "mobile", mobile: true }),
  ];

  if (contractorWarnings.length > 0) {
    const treeDudeHtml = renderTreeDudeDocument(alphaJson, { warnings: contractorWarnings });
    documentJobs.push(createDownloadFile(treeDudeHtml, { documentId, variant: "tree-dude", mobile: false }));
  }

  const [full, mobile, treeDude] = await Promise.all(documentJobs);
  const customerEstimateUrl = new URL(`/e/${encodeURIComponent(documentId)}`, request.url).toString();
  const documents = { full, mobile };
  if (treeDude) {
    documents.treeDude = treeDude;
    documents["tree-dude"] = treeDude;
  }

  const recordPayload = {
    documentId,
    status: "approved",
    alphaJson,
    customerEstimateUrl,
    documents,
    pdf_url_full: full.downloadUrl,
    pdf_url_mobile: mobile.downloadUrl,
  };
  if (treeDude) recordPayload.pdf_url_tree_dude = treeDude.downloadUrl;

  const record = await saveEstimate(recordPayload);

  return json({
    documentId,
    alphaJson,
    customerEstimateUrl,
    full,
    mobile,
    treeDude,
    overrideWarnings,
    contractorWarnings,
    mockedStorage: !hasBlobConfig(),
    blobStorage: record.blobStorage,
    note:
      full.format === "pdf" && mobile.format === "pdf"
        ? "PDF customer documents generated."
        : "HTML fallback generated because Puppeteer PDF rendering was not available.",
  });
}
