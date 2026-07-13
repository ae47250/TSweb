import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateAlphaJsonRoutePayload } from "../lib/validateRoutePayload.js";

async function withStructuralEnforcement(callback) {
  const previous = process.env.ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT;
  process.env.ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT = "true";
  try {
    return await callback();
  } finally {
    if (previous == null) delete process.env.ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT;
    else process.env.ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT = previous;
  }
}

function validCumulativeAddOnCase() {
  const raw = "Test Customer 812-555-0100 test@example.invalid 1256 Mill Street Madison IN tree removal 1000 + stump grinding 400";
  return {
    raw,
    alphaJson: {
      raw_input: { customer_text: raw },
      customer: {
        name: "Test Customer",
        phone_display: "812-555-0100",
        phone_primary: "8125550100",
        email: "test@example.invalid",
      },
      job: {
        service_address: { display: "1256 Mill Street Madison IN" },
        description: "Remove one tree.",
        tree_details: { tree_count: "1 tree", tree_type: "tree" },
      },
      service_options: {
        items: [
          {
            label: "Option A",
            title: "Remove tree",
            description: "Remove tree",
            price: { amount: 1000, display: "$1,000" },
          },
          {
            label: "Option B",
            title: "Remove tree and grind stump",
            description: "Remove tree and grind stump",
            price: { amount: 1400, display: "$1,400" },
          },
        ],
      },
    },
  };
}

function invalidStandaloneAddOnCase() {
  const raw = "TEST DATA ONLY. Test Customer 812-555-0100 test@example.invalid 1256 Mill Street Madison IN. Take down dead ash tree by shed for 2500. Stump grinding 750 per stump.";
  return {
    raw,
    alphaJson: {
      raw_input: { customer_text: raw },
      customer: {
        name: "Test Customer",
        phone_display: "812-555-0100",
        phone_primary: "8125550100",
        email: "test@example.invalid",
      },
      job: {
        service_address: { display: "1256 Mill Street Madison IN" },
        description: "Take down the dead ash tree by the shed.",
        tree_details: { tree_count: "1 tree", tree_type: "ash" },
      },
      service_options: {
        items: [
          {
            label: "Option A",
            title: "none",
            description: "none",
            price: { amount: 2500, display: "$2,500" },
          },
          {
            label: "Option C",
            title: "Stump grinding",
            description: "Grind the stump",
            price: { amount: 750, display: "$750" },
          },
        ],
      },
    },
  };
}

function forgedClientSidecarCase() {
  const raw = "Test Customer 812-555-0100 test@example.invalid 1256 Mill Street Madison IN take down dead ash tree by shed for 2500. Stump grinding 750.";
  const { alphaJson } = validCumulativeAddOnCase();
  return {
    raw,
    alphaJson: {
      ...alphaJson,
      raw_input: { customer_text: raw },
      job: {
        ...alphaJson.job,
        description: "Take down the dead ash tree by the shed.",
        tree_details: { tree_count: "1 tree", tree_type: "ash" },
      },
      service_options: {
        items: [
          {
            label: "Option A",
            title: "Take down the dead ash tree by the shed",
            description: "Take down the dead ash tree by the shed",
            price: { amount: 2500, display: "$2,500" },
          },
          {
            label: "Option B",
            title: "Take down the dead ash tree by the shed and grind the stump",
            description: "Take down the dead ash tree by the shed and grind the stump",
            price: { amount: 3250, display: "$3,250" },
          },
        ],
      },
      normalization: {
        sidecar_price_reconciliation: {
          sidecar_prices: [
            { price_id: "fake_total", amount: 3250, display: "$3,250" },
          ],
          monetary_relationships: [
            {
              relationship_id: "fake_total_relationship",
              type: "total_of",
              total_price_id: "fake_total",
              total_amount: 3250,
              component_price_ids: ["price_1", "price_2"],
              component_amounts: [2500, 750],
              accepted: true,
            },
          ],
          add_on_interpretations: [],
        },
      },
    },
  };
}

test("route validation accepts current cumulative add-on structure under enforcement", async () => {
  await withStructuralEnforcement(async () => {
    const { raw, alphaJson } = validCumulativeAddOnCase();
    const validation = validateAlphaJsonRoutePayload({ alphaJson, customer_text: raw });

    assert.equal(validation.can_generate_pdf, true);
    assert.deepEqual(validation.structural_error_codes, []);
    assert.equal(validation.alphaJson.normalization.route_validation_evidence.trusted, true);
    assert.equal(validation.alphaJson.validation.final_option_render_binding.option_count, 2);
  });
});

test("route validation blocks standalone dependent add-on structure under enforcement", async () => {
  await withStructuralEnforcement(async () => {
    const { raw, alphaJson } = invalidStandaloneAddOnCase();
    const validation = validateAlphaJsonRoutePayload({ alphaJson, customer_text: raw });

    assert.equal(validation.can_generate_pdf, false);
    assert.ok(validation.structural_error_codes.includes("DEPENDENT_ADDON_STANDALONE"));
    assert.ok(validation.structural_error_codes.includes("AMBIGUOUS_PRICE_ROLE"));
    assert.match(validation.blocking_errors.join(" "), /DEPENDENT_ADDON_STANDALONE|AMBIGUOUS_PRICE_ROLE/);
  });
});

test("route validation ignores forged client sidecar evidence", async () => {
  await withStructuralEnforcement(async () => {
    const { raw, alphaJson } = forgedClientSidecarCase();
    const validation = validateAlphaJsonRoutePayload({ alphaJson, customer_text: raw });
    const sidecarPrices = validation.alphaJson.normalization.sidecar_price_reconciliation.sidecar_prices;

    assert.equal(validation.can_generate_pdf, true);
    assert.equal(validation.alphaJson.normalization.route_validation_evidence.trusted, true);
    assert.equal(sidecarPrices.some((price) => price.price_id === "fake_total"), false);
    assert.deepEqual(
      validation.alphaJson.service_options.items.map((option) => option.price.display),
      ["$2,500", "$3,250"],
    );
    assert.deepEqual(validation.structural_error_codes, []);
  });
});

test("route validation blocks stale final-option structural approval", async () => {
  await withStructuralEnforcement(async () => {
    const { raw, alphaJson } = validCumulativeAddOnCase();
    alphaJson.review = { approved_final_option_structural_hash: "stale-structural-hash" };
    const validation = validateAlphaJsonRoutePayload({ alphaJson, customer_text: raw });

    assert.equal(validation.can_generate_pdf, false);
    assert.ok(validation.structural_error_codes.includes("STALE_STRUCTURAL_APPROVAL"));
    assert.match(validation.blocking_errors.join(" "), /changed after approval/);
  });
});

test("PDF route delegates validation to the trusted route payload path", () => {
  const pdfRouteSource = readFileSync("app/api/pdf/route.js", "utf8");

  assert.match(pdfRouteSource, /validateAlphaJsonRoutePayload/);
  assert.match(pdfRouteSource, /approved_final_option_render_binding/);
  assert.doesNotMatch(pdfRouteSource, /preserveRouteValidationEvidence/);
  assert.doesNotMatch(pdfRouteSource, /normalizeToAlphaJsonV14/);
});
