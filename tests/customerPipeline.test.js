import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  customerPipelinePolicy,
  resolveCustomerPipeline,
} from "../lib/customerPipeline.js";
import { buildCustomerPipelineTelemetry } from "../lib/customerPipelineTelemetry.js";
import { buildCustomerRenderFacts, renderCustomerDocument } from "../lib/customerDocument.js";
import { buildCustomerEstimateView } from "../lib/customerEstimateView.js";

const RAW = "Jane Doe 812-555-0100 jane@example.com 123 Oak Street Madison IN. Remove one oak. Option A removal only $1800.";

function env(overrides = {}) {
  return {
    CUSTOMER_PIPELINE_TELEMETRY: "false",
    ...overrides,
  };
}

test("customer pipeline defaults to the legacy customer path", () => {
  const policy = customerPipelinePolicy({ documentId: "EST-ROLL-001", env: env({}) });

  assert.equal(policy.active_pipeline, "legacy");
  assert.equal(policy.active_mode, "off");
  assert.equal(policy.resolution.customer_facing_enabled, false);
  assert.equal(policy.assembler.customer_facing_enabled, false);
});

test("limited cohorts are deterministic and allowlists take precedence", () => {
  const first = customerPipelinePolicy({
    documentId: "EST-ROLL-002",
    env: env({
      CUSTOMER_RESOLUTION_RELEASE_APPROVED: "true",
      CUSTOMER_RESOLUTION_ROLLOUT: "limited",
      CUSTOMER_RESOLUTION_PERCENT: "5",
      CUSTOMER_RESOLUTION_ALLOWLIST: "EST-ROLL-002",
      ENABLE_READINESS_SAFETY_BLOCKING: "true",
    }),
  });
  const second = customerPipelinePolicy({
    documentId: "EST-ROLL-002",
    env: env({
      CUSTOMER_RESOLUTION_RELEASE_APPROVED: "true",
      CUSTOMER_RESOLUTION_ROLLOUT: "limited",
      CUSTOMER_RESOLUTION_PERCENT: "5",
      CUSTOMER_RESOLUTION_ALLOWLIST: "EST-ROLL-002",
      ENABLE_READINESS_SAFETY_BLOCKING: "true",
    }),
  });

  assert.deepEqual(first.resolution, second.resolution);
  assert.equal(first.resolution.allowlisted, true);
  assert.equal(first.resolution.customer_facing_enabled, true);
});

test("resolution rollout uses the candidate only after explicit release approval", () => {
  const baseBody = { alphaJson: {}, customer_text: RAW };
  const disabled = resolveCustomerPipeline(baseBody, {
    documentId: "EST-ROLL-003",
    env: env({ CUSTOMER_RESOLUTION_ROLLOUT: "full" }),
    telemetry: false,
  });
  const enabled = resolveCustomerPipeline(baseBody, {
    documentId: "EST-ROLL-003",
    env: env({
      CUSTOMER_RESOLUTION_RELEASE_APPROVED: "true",
      CUSTOMER_RESOLUTION_ROLLOUT: "full",
      ENABLE_READINESS_SAFETY_BLOCKING: "true",
    }),
    telemetry: false,
  });

  assert.equal(disabled.policy.active_pipeline, "legacy");
  assert.equal(disabled.alphaJson.validation.customer_pipeline.active_pipeline, "legacy");
  assert.equal(enabled.policy.active_pipeline, "resolution");
  assert.equal(enabled.alphaJson.validation.customer_pipeline.active_pipeline, "resolution");
  assert.equal(enabled.alphaJson.validation.pipeline_name, "resolution-shadow");
});

test("production resolution preserves explicit stump option scope through trusted write-through", () => {
  const raw =
    "Beth Wells said call/text 812.555.2018. at 5044 Liberty Road in Hanover Indiana. tow spruce trees removal. notes: old estimate scribble. drop $850 haul brush 1850 stump 2,300";
  const result = resolveCustomerPipeline(
    { alphaJson: {}, customer_text: raw },
    {
      documentId: "case_0514",
      env: env({
        TSWEB_DEPLOYMENT_STAGE: "production",
        CUSTOMER_DELIVERY_ENABLED: "true",
        CUSTOMER_RESOLUTION_ROLLOUT: "full",
        CUSTOMER_RESOLUTION_RELEASE_APPROVED: "true",
        CUSTOMER_ASSEMBLER_ROLLOUT: "off",
        CUSTOMER_ASSEMBLER_RELEASE_APPROVED: "false",
        ENABLE_READINESS_SAFETY_BLOCKING: "true",
      }),
      telemetry: false,
    },
  );

  assert.equal(result.policy.active_pipeline, "resolution");
  assert.equal(result.validation.can_generate_pdf, true);
  assert.deepEqual(
    result.alphaJson.service_options.items.map((option) => option.price.display),
    ["$850", "$1,850", "$2,300"],
  );
  assert.match(result.alphaJson.service_options.items[2].description, /stump/i);
  assert.equal(result.alphaJson.validation.readiness_safety_blocking_errors.length, 0);
});

test("assembler rollout is independently gated and applies only in its active cohort", () => {
  const result = resolveCustomerPipeline({ alphaJson: {}, customer_text: RAW }, {
    documentId: "EST-ROLL-004",
    env: env({
      CUSTOMER_ASSEMBLER_RELEASE_APPROVED: "true",
      CUSTOMER_ASSEMBLER_ROLLOUT: "full",
      ENABLE_CANONICAL_SERVICE_ASSEMBLER: "true",
      ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT: "true",
      ENABLE_READINESS_SAFETY_BLOCKING: "true",
    }),
    telemetry: false,
  });

  assert.equal(result.policy.resolution.customer_facing_enabled, false);
  assert.equal(result.policy.assembler.customer_facing_enabled, true);
  assert.equal(result.policy.active_pipeline, "assembler");
  assert.equal(result.alphaJson.validation.pipeline_name, "assembler");
});

test("telemetry contains codes and no customer values", () => {
  const telemetry = buildCustomerPipelineTelemetry({
    documentId: "EST-ROLL-005",
    policy: { active_mode: "limited", active_pipeline: "resolution" },
    validation: {
      blocking_errors: ["High-confidence sidecar price $2,200 needs review."],
      readiness_safety: {
        enforced_findings: [{ invariant_code: "HIGH_CONFIDENCE_PRICE_UNRESOLVED" }],
      },
    },
    parity: {
      equal: false,
      classification: "expected_correction",
      difference_codes: ["customer_phone"],
    },
    decisions: [{ reasonCode: "app_wrong" }],
    env: {},
  });
  const serialized = JSON.stringify(telemetry);

  assert.equal(telemetry.blocking_codes.includes("PRICE_VALIDATION"), true);
  assert.equal(serialized.includes("2,200"), false);
  assert.equal(serialized.includes("EST-ROLL-005"), false);
  assert.equal(serialized.includes("HIGH_CONFIDENCE_PRICE_UNRESOLVED"), true);
  assert.equal(telemetry.parity_classification, "expected_correction");
  assert.deepEqual(telemetry.parity_difference_codes, ["customer_phone"]);

  const temporaryDirectory = mkdtempSync(join(tmpdir(), "tsweb-observability-"));
  try {
    const telemetryPath = join(temporaryDirectory, "wrong-version.jsonl");
    writeFileSync(telemetryPath, `${JSON.stringify({ ...telemetry, telemetry_version: "customer-pipeline-telemetry-v1" })}\n`);
    const check = spawnSync(
      process.execPath,
      ["scripts/check-customer-pipeline-observability.js", "--input", telemetryPath],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    assert.notEqual(check.status, 0);
    assert.match(`${check.stdout}\n${check.stderr}`, /unsupported telemetry_version/);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("customer render projection excludes evidence and reviewer internals", () => {
  const alphaJson = {
    document: { number: "EST-ROLL-006", title: "Estimate", date_display: "August 14, 2026" },
    customer: { name: "Jane Doe", phone_display: "812-555-0100" },
    job: { service_address: { display: "123 Oak Street, Madison, IN" }, description: "Remove one oak." },
    service_options: {
      items: [{ label: "Option A", title: "Oak removal", description: "Remove one oak.", price: { display: "$1,800" } }],
    },
    notes: { display_notes: "Customer-visible scheduling note." },
    normalization: {
      field_evidence: { work_scope: "private internal evidence quote" },
      reviewer_decision_log: [{ note: "private reviewer note" }],
    },
    validation: { estimate_semantic_hash: "hash" },
  };
  const facts = buildCustomerRenderFacts(alphaJson);
  const html = renderCustomerDocument(alphaJson);

  assert.equal(JSON.stringify(facts).includes("private internal evidence quote"), false);
  assert.equal(JSON.stringify(facts).includes("private reviewer note"), false);
  assert.equal(html.includes("private internal evidence quote"), false);
  assert.equal(html.includes("private reviewer note"), false);
  assert.match(html, /Customer-visible scheduling note/);
  assert.doesNotMatch(html, /Mock mode|Submit to Contractor|Preview Email to Contractor/);
});

test("production delivery fails closed instead of falling back to legacy", () => {
  const result = resolveCustomerPipeline({ alphaJson: {}, customer_text: RAW }, {
    documentId: "EST-ROLL-007",
    env: env({
      TSWEB_DEPLOYMENT_STAGE: "production",
      CUSTOMER_DELIVERY_ENABLED: "true",
      CUSTOMER_RESOLUTION_ROLLOUT: "full",
      ENABLE_READINESS_SAFETY_BLOCKING: "true",
    }),
    telemetry: false,
  });

  assert.equal(result.policy.active_pipeline, "legacy");
  assert.equal(result.policy.delivery_blocked, true);
  assert.equal(result.validation.can_generate_pdf, false);
  assert.match(result.validation.blocking_errors.join(" "), /Customer delivery is disabled/);
});

test("customer estimate view exposes only allowlisted customer fields and binding hashes", () => {
  const result = resolveCustomerPipeline({ alphaJson: {}, customer_text: RAW }, {
    documentId: "EST-ROLL-008",
    env: env({
      CUSTOMER_RESOLUTION_RELEASE_APPROVED: "true",
      CUSTOMER_RESOLUTION_ROLLOUT: "full",
      ENABLE_READINESS_SAFETY_BLOCKING: "true",
    }),
    telemetry: false,
  });
  const view = buildCustomerEstimateView(result.alphaJson);
  const serialized = JSON.stringify(view);

  assert.equal(view.trusted, true);
  assert.equal(view.document.number, result.alphaJson.document.number);
  assert.ok(view.binding.factsHash);
  assert.ok(view.binding.wordingHash);
  assert.equal(serialized.includes("raw_input"), false);
  assert.equal(serialized.includes("reviewer_decisions"), false);
});
