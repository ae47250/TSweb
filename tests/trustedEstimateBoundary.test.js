import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { saveEstimate } from "../lib/estimateStore.js";
import { loadTrustedEstimateBoundary } from "../lib/trustedEstimateBoundary.js";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { validateAlphaJsonRoutePayload } from "../lib/validateRoutePayload.js";

const ESTIMATE_ID = "EST-PHASE1-TRUSTED-001";
const RAW = "Jane Doe 317-555-0001 jane@example.com 42 Oak Street Madison Indiana. Remove one oak. Option A removal only $1,800. Actually, make that $2,200. Actually use 812-555-0002.";

async function saveTrustedEstimate(documentId = ESTIMATE_ID, extra = {}) {
  const validation = validateAlphaJsonRoutePayload({ alphaJson: {}, customer_text: RAW });
  validation.alphaJson.document.number = documentId;
  await saveEstimate({
    documentId,
    status: "approved",
    alphaJson: validation.alphaJson,
    customerEstimateUrl: `https://example.test/e/${documentId}`,
    ...extra,
  });
}

test("trusted boundary returns stored correction values and ignores client-shaped alternatives", async () => {
  await saveTrustedEstimate();
  const trusted = await loadTrustedEstimateBoundary(ESTIMATE_ID);

  assert.equal(trusted.ok, true);
  assert.equal(trusted.alphaJson.customer.phone_display, "812-555-0002");
  assert.equal(trusted.alphaJson.service_options.items[0].price.display, "$2,200");
});

test("customer-facing mutation routes require the trusted boundary and validate option identity", () => {
  const routeSources = [
    readFileSync("app/api/notify/route.js", "utf8"),
    readFileSync("app/api/upload/route.js", "utf8"),
    readFileSync("app/api/manual-acceptance/route.js", "utf8"),
  ];

  for (const source of routeSources) {
    assert.match(source, /loadTrustedEstimateBoundary/);
    assert.match(source, /Please select a valid option from the trusted estimate/);
  }
});

test("trusted boundary requires customer access provenance when links are enabled", async () => {
  const documentId = "EST-PHASE1-MISSING-ACCESS-001";
  await saveTrustedEstimate(documentId);
  const trusted = await loadTrustedEstimateBoundary(documentId, {
    env: {
      TSWEB_DEPLOYMENT_STAGE: "staging",
      OPENAI_API_KEY: "staging-openai-key",
      MOCK_OPENAI_RESPONSES: "false",
      CUSTOMER_DELIVERY_ENABLED: "true",
      CUSTOMER_RESOLUTION_RELEASE_APPROVED: "true",
      CUSTOMER_RESOLUTION_ROLLOUT: "internal",
      ENABLE_READINESS_SAFETY_BLOCKING: "true",
      VERCEL_BLOB_ENABLED: "true",
      BLOB_READ_WRITE_TOKEN: "staging-blob-token",
      MOCK_NOTIFICATIONS: "false",
      PINGRAM_API_KEY: "staging-pingram-key",
      PINGRAM_FROM_EMAIL: "tree@example.test",
      PINGRAM_FROM_NUMBER: "+18125550199",
      TREE_DUDE_EMAIL: "owner@example.test",
      TREE_DUDE_PHONE: "+18125550199",
      CONTRACTOR_USERNAME: "reviewer",
      CONTRACTOR_PASSWORD_SCRYPT_HASH: "scrypt$YWJj$YWJj",
      CONTRACTOR_SESSION_SECRET: "staging-contractor-session-secret-32-bytes",
      CUSTOMER_LINK_SIGNING_SECRET: "customer-link-secret-that-is-long-enough",
      CUSTOMER_PIPELINE_TELEMETRY_URL: "https://telemetry.example.test/events",
      CUSTOMER_PIPELINE_TELEMETRY_TOKEN: "staging-telemetry-token",
      CUSTOMER_PIPELINE_TELEMETRY_SALT: "staging-telemetry-salt-16",
    },
  });

  assert.equal(trusted.ok, false);
  assert.equal(trusted.status, 409);
  assert.deepEqual(trusted.blocking_errors, ["CUSTOMER_ACCESS_PROVENANCE_MISSING"]);
});

test("delivery routes fail closed for variant, state, fallback, and blocked-link boundary cases", () => {
  const downloadSource = readFileSync("app/api/estimates/[documentId]/pdf/[variant]/route.js", "utf8");
  const notifySource = readFileSync("app/api/notify/route.js", "utf8");
  const listSource = readFileSync("app/api/estimates/route.js", "utf8");
  const detailSource = readFileSync("app/api/estimates/[documentId]/route.js", "utf8");
  const pageSource = readFileSync("app/e/[estimateId]/page.js", "utf8");

  assert.match(downloadSource, /normalizeVariant/);
  assert.match(downloadSource, /normalizedVariant !== "tree-dude"/);
  assert.match(downloadSource, /record\?\.status === "signed"/);
  assert.match(downloadSource, /record\?\.status === "accepted_manually"/);
  assert.match(downloadSource, /record\?\.status === "accepted_manually"\) return record\?\.accepted\?\.mobile \|\| null/);
  assert.match(downloadSource, /record\?\.status === "signed"\) return record\?\.signed\?\.mobile \|\| null/);
  assert.match(downloadSource, /isStrictDeliveryStage\(\) && \(file\.format !== "pdf"/);
  assert.match(notifySource, /createCustomerAccessToken/);
  assert.doesNotMatch(notifySource, /record\.customerEstimateUrl\s*\|\|/);
  assert.match(listSource, /productionConfigurationErrors/);
  assert.match(listSource, /customerEstimateUrl: ""/);
  assert.match(detailSource, /delete reviewRecord\.customerEstimateUrl/);
  assert.match(detailSource, /delete reviewRecord\.pdf_url_tree_dude/);
  assert.match(pageSource, /record\.status === "signed" && record\.signed\?\.full/);
  assert.match(pageSource, /record\.status === "accepted_manually" && record\.accepted\?\.full/);
});

test("staging readiness blocking protects delivery routes and permits a valid reviewed estimate", async () => {
  const previous = process.env.ENABLE_READINESS_SAFETY_BLOCKING;
  process.env.ENABLE_READINESS_SAFETY_BLOCKING = "true";
  try {
    const raw = "Jane Doe 317-555-0100 jane@example.com 42 Oak Street Madison IN. Remove one oak. Quote $1800 or $2200 separately.";
    const blockedId = "EST-PHASE45-BLOCKED-001";
    const blockedDraft = normalizeToAlphaJsonV14({}, raw, {});
    blockedDraft.document.number = blockedId;
    const blockedValidation = validateAlphaJsonRoutePayload({
      alphaJson: blockedDraft,
      customer_text: raw,
    });
    assert.equal(blockedValidation.can_generate_pdf, false);
    blockedValidation.alphaJson.document.number = blockedId;
    await saveEstimate({
      documentId: blockedId,
      status: "approved",
      alphaJson: blockedValidation.alphaJson,
      documents: { full: { html: "must remain hidden" } },
      signed: { full: { html: "must remain hidden" } },
      accepted: { full: { html: "must remain hidden" } },
      customerEstimateUrl: `https://example.test/e/${blockedId}`,
    });
    const trustedBlocked = await loadTrustedEstimateBoundary(blockedId);
    assert.equal(trustedBlocked.ok, false);
    assert.equal(trustedBlocked.status, 409);

    const reviewedDraft = normalizeToAlphaJsonV14({}, raw, {});
    reviewedDraft.document.number = "EST-PHASE45-REVIEWED-001";
    const baseline = validateAlphaJsonRoutePayload({
      alphaJson: reviewedDraft,
      customer_text: raw,
    });
    const readinessDecisions = baseline.alphaJson.validation.readiness_safety.enforced_findings.map((finding, index) => ({
      decisionId: `phase45-pdf-${index}`,
      findingId: finding.finding_id,
      field: finding.field,
      action: "entered_new_value",
      value: 1800,
      reasonCode: "app_wrong",
    }));
    const reviewedValidation = validateAlphaJsonRoutePayload({
      alphaJson: reviewedDraft,
      customer_text: raw,
      decisionLog: readinessDecisions,
    });
    assert.equal(reviewedValidation.can_generate_pdf, true);
    assert.equal(reviewedValidation.alphaJson.validation.readiness_override_status.remaining_finding_ids.length, 0);
    const reviewedId = "EST-PHASE45-REVIEWED-001";
    reviewedValidation.alphaJson.document.number = reviewedId;
    await saveEstimate({
      documentId: reviewedId,
      status: "approved",
      alphaJson: reviewedValidation.alphaJson,
      documents: { full: { html: "reviewed document" } },
      customerEstimateUrl: `https://example.test/e/${reviewedId}`,
    });
    const trustedReviewed = await loadTrustedEstimateBoundary(reviewedId);
    assert.equal(trustedReviewed.ok, true);

    const routeSources = [
      ["app/api/pdf/route.js", /resolveCustomerPipeline/, /getBlockingOverrideStatus/],
      ["app/api/notify/route.js", /loadTrustedEstimateBoundary/],
      ["app/api/upload/route.js", /loadTrustedEstimateBoundary/],
      ["app/api/manual-acceptance/route.js", /loadTrustedEstimateBoundary/],
      ["app/api/estimates/[documentId]/route.js", /loadTrustedEstimateBoundary/, /delete reviewRecord\.documents/],
      ["app/api/estimates/[documentId]/pdf/[variant]/route.js", /loadTrustedEstimateBoundary/, /Review required before serving/],
      ["app/e/[estimateId]/page.js", /loadTrustedEstimateBoundary/, /Review Required/],
    ];
    for (const [path, ...patterns] of routeSources) {
      const source = readFileSync(path, "utf8");
      for (const pattern of patterns) assert.match(source, pattern, `${path} is missing ${pattern}`);
    }
  } finally {
    if (previous === undefined) delete process.env.ENABLE_READINESS_SAFETY_BLOCKING;
    else process.env.ENABLE_READINESS_SAFETY_BLOCKING = previous;
  }
});
