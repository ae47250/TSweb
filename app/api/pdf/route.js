import { readJson, json, requestIp } from "../../../lib/api.js";
import { hasBlobConfig } from "../../../lib/blobStore.js";
import { renderCustomerDocument, renderTreeDudeDocument } from "../../../lib/customerDocument.js";
import { createDownloadFile } from "../../../lib/documentFiles.js";
import { saveEstimate } from "../../../lib/estimateStore.js";
import { checkRateLimit } from "../../../lib/rateLimiter.js";
import { getBlockingOverrideStatus, normalizeReviewOverrides } from "../../../lib/reviewOverrides.js";
import { normalizeReviewerDecisionLog, reviewerDecisionLogHash } from "../../../lib/reviewerDecisionLog.js";
import { emitCustomerPipelineDelivery, resolveCustomerPipeline } from "../../../lib/customerPipeline.js";
import { requireContractorSession } from "../../../lib/contractorAuth.js";
import {
  createCustomerAccessToken,
  newCustomerAccessVersion,
} from "../../../lib/customerAccess.js";
import { productionConfigurationErrors } from "../../../lib/productionReadiness.js";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  const configurationErrors = productionConfigurationErrors();
  if (configurationErrors.length) {
    return json({ error: "Production delivery configuration is incomplete.", configurationErrors }, { status: 503 });
  }
  const auth = requireContractorSession(request, { csrf: true });
  if (!auth.ok) return auth.response;
  const limit = checkRateLimit(requestIp(request));
  if (!limit.allowed) {
    return json(
      { error: "Too many document requests. Please try again later.", retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = await readJson(request);
  const pipeline = resolveCustomerPipeline(body, { reviewContext: { actorId: auth.session.sub } });
  const validation = pipeline?.validation;
  if (!validation?.alphaJson) {
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
  alphaJson.review.reviewer_decision_log = normalizeReviewerDecisionLog(
    alphaJson.review?.reviewer_decision_log || body.decisionLog,
  );
  alphaJson.review.approved_document_hash = alphaJson.validation?.estimate_semantic_hash || "";
  alphaJson.review.approved_customer_delivery_binding = pipeline.customerView.binding;
  alphaJson.review.reviewer_decision_log_hash = reviewerDecisionLogHash(
    alphaJson.review.reviewer_decision_log,
    alphaJson.review.approved_document_hash,
  );
  alphaJson.review.contractor_warnings = [
    ...overrideStatus.acceptedOverrideWarnings,
    ...(validation.warnings || []).map((warning) => ({
      title: "Review note",
      message: warning,
    })),
  ];
  // Legacy address/contact/scope overrides may clear only their matching
  // validation errors. The trusted pipeline remains the source of truth and
  // structural, safety, and candidate-resolution blockers are never cleared.
  alphaJson.validation.overridden_blocking_errors = overrideStatus.acceptedOverrideWarnings.map((warning) => warning.title);

  const overrideWarnings = overrideStatus.acceptedOverrideWarnings;
  const contractorWarnings = alphaJson.review.contractor_warnings;
  const fullHtml = renderCustomerDocument(pipeline.customerView, { mobile: false });
  const mobileHtml = renderCustomerDocument(pipeline.customerView, { mobile: true });
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
  const customerAccessVersion = newCustomerAccessVersion();
  const customerAccessToken = createCustomerAccessToken(documentId, customerAccessVersion);
  const customerEstimateUrl = new URL(`/e/${encodeURIComponent(documentId)}`, request.url);
  if (customerAccessToken) customerEstimateUrl.searchParams.set("token", customerAccessToken);
  const documents = { full, mobile };
  if (treeDude) {
    documents.treeDude = treeDude;
    documents["tree-dude"] = treeDude;
  }

  const recordPayload = {
    documentId,
    status: "approved",
    alphaJson,
    pipeline: pipeline.pipeline,
    customerEstimateUrl: customerEstimateUrl.toString(),
    customerAccessVersion,
    documents,
    pdf_url_full: full.downloadUrl,
    pdf_url_mobile: mobile.downloadUrl,
  };
  if (treeDude) recordPayload.pdf_url_tree_dude = treeDude.downloadUrl;

  const record = await saveEstimate(recordPayload);
  await emitCustomerPipelineDelivery({
    documentId,
    policy: pipeline.policy,
    validation,
    parity: pipeline.parity,
    surface: "pdf_generation",
    decisions: alphaJson.review?.readiness_decisions || alphaJson.review?.reviewer_decision_log || [],
  });

  return json({
    documentId,
    alphaJson,
    customerEstimateUrl: customerEstimateUrl.toString(),
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
