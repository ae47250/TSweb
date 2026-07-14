import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { buildOptionPriceCandidateView } from "../lib/optionPriceNormalizer.js";
import { reconcileSidecarPrices } from "../lib/priceReconciliation.js";
import { applyCanonicalServiceAssembler } from "../lib/canonicalServiceAssembler.js";
import { validateAlphaJson } from "../lib/validateJson.js";

const FIXTURE = "tests/fixtures/easy-two-option-input-notes-2026-07-11.md";

function noteCases() {
  const markdown = readFileSync(FIXTURE, "utf8");
  const fenced = markdown.match(/```text\s*([\s\S]*?)```/u)?.[1] || markdown;
  return [...fenced.matchAll(/(?:^|\n)(\d+)\.\s+([\s\S]*?)(?=\n\d+\.\s+|$)/gu)]
    .map((match) => ({
      case_id: Number(match[1]),
      raw_note: match[2].replace(/\s+/gu, " ").trim(),
    }));
}

function pricesIn(value) {
  return [...String(value).matchAll(/\b(\d{3,5})\b/gu)]
    .map((match) => Number(match[1]))
    .filter((amount) => amount >= 100);
}

function expectedExplicitTotal(rawNote) {
  const optionA = /Option A:?/iu.exec(rawNote);
  const optionB = /Option B:?/iu.exec(rawNote);
  assert.ok(optionA);
  assert.ok(optionB);
  const optionASegment = rawNote.slice(optionA.index + optionA[0].length, optionB.index);
  const optionBSegment = rawNote.slice(optionB.index + optionB[0].length);
  return [pricesIn(optionASegment).at(-1), pricesIn(optionBSegment).at(-1)];
}

function expectedIncremental(rawNote) {
  const optionA = /Option A:?/iu.exec(rawNote);
  assert.ok(optionA);
  const amounts = pricesIn(rawNote.slice(optionA.index + optionA[0].length));
  return [amounts[0], amounts[0] + amounts[1]];
}

function forceCanonical(rawNote) {
  const normalized = reconcileSidecarPrices(
    normalizeToAlphaJsonV14({}, rawNote),
    buildOptionPriceCandidateView(rawNote),
  );
  return applyCanonicalServiceAssembler(normalized, { force: true });
}

function optionPrices(alphaJson) {
  return (alphaJson.service_options?.items || []).slice(0, 2).map((option) => Number(option.price?.amount));
}

function optionText(option = {}) {
  return [option.title, option.description].filter(Boolean).join(" ");
}

function firstRole(alphaJson) {
  return alphaJson.normalization?.sidecar_price_reconciliation?.add_on_interpretations?.[0]?.price_role || "";
}

function expectedQuantity(rawNote) {
  if (/\b(?:two|both)\b/i.test(rawNote)) return "two";
  if (/\bthree\b/i.test(rawNote)) return "three";
  return "";
}

test("explicit Option B totals and incremental add-on prices preserve each paired route's stated math", () => {
  const cases = noteCases();
  assert.equal(cases.length, 100);

  for (let index = 0; index < 50; index += 1) {
    const explicitCase = cases[index];
    const incrementalCase = cases[index + 50];
    const explicitExpected = expectedExplicitTotal(explicitCase.raw_note);
    const incrementalExpected = expectedIncremental(incrementalCase.raw_note);

    assert.equal(
      incrementalExpected[0],
      explicitExpected[0],
      `cases ${explicitCase.case_id}/${incrementalCase.case_id} should share the same base price`,
    );

    const explicitAlpha = forceCanonical(explicitCase.raw_note);
    const incrementalAlpha = forceCanonical(incrementalCase.raw_note);
    assert.deepEqual(optionPrices(explicitAlpha), explicitExpected, `case ${explicitCase.case_id}`);
    assert.deepEqual(optionPrices(incrementalAlpha), incrementalExpected, `case ${incrementalCase.case_id}`);
    assert.equal(firstRole(explicitAlpha), "EXPLICIT_OPTION_TOTAL", `case ${explicitCase.case_id}`);
    assert.equal(firstRole(incrementalAlpha), "INCREMENTAL_ADDON_PRICE", `case ${incrementalCase.case_id}`);

    const explicitOptions = explicitAlpha.service_options.items;
    const incrementalOptions = incrementalAlpha.service_options.items;
    const quantity = expectedQuantity(explicitCase.raw_note);
    if (quantity) {
      assert.match(optionText(explicitOptions[0]), new RegExp(`\\b${quantity}\\b`, "i"), `case ${explicitCase.case_id} quantity`);
      assert.match(optionText(explicitOptions[1]), new RegExp(`\\b${quantity}\\b`, "i"), `case ${explicitCase.case_id} expanded quantity`);
      assert.match(optionText(incrementalOptions[0]), new RegExp(`\\b${quantity}\\b`, "i"), `case ${incrementalCase.case_id} quantity`);
      assert.match(optionText(incrementalOptions[1]), new RegExp(`\\b${quantity}\\b`, "i"), `case ${incrementalCase.case_id} expanded quantity`);
    }
    if (/\b(?:leave|stack)\b/i.test(explicitCase.raw_note)) {
      assert.match(optionText(explicitOptions[0]), /\b(?:leave|stack)\b/i, `case ${explicitCase.case_id} leave-on-site scope`);
    }
    if (!/\b(?:stump|grind)\b/i.test(`${explicitCase.raw_note} ${incrementalCase.raw_note}`)) {
      assert.doesNotMatch(optionText(explicitOptions[1]), /\b(?:stump|grind)\b/i, `case ${explicitCase.case_id} unsupported stump work`);
      assert.doesNotMatch(optionText(incrementalOptions[1]), /\b(?:stump|grind)\b/i, `case ${incrementalCase.case_id} unsupported stump work`);
    }
  }
});

test("price-role classifier handles paraphrases without challenge wording", () => {
  const explicit = forceCanonical(
    "Customer needs one maple removed. Option A remove tree and leave wood for 1000. Option B remove tree with debris haul away for 1450.",
  );
  assert.deepEqual(optionPrices(explicit), [1000, 1450]);
  assert.equal(firstRole(explicit), "EXPLICIT_OPTION_TOTAL");

  const incremental = forceCanonical(
    "Customer needs one maple removed. Option A remove tree and leave wood 1000. Plus haul away 450.",
  );
  assert.deepEqual(optionPrices(incremental), [1000, 1450]);
  assert.equal(firstRole(incremental), "INCREMENTAL_ADDON_PRICE");
});

test("field-language explicit A/B totals keep leave-on-site scope on A and do not double-add B totals", () => {
  const cases = [
    {
      raw: "Customer needs pine removed near driveway. Option A: remove pine and leave debris, 1100. Option B: remove pine, haul debris, and clean driveway area, 1600.",
      prices: [1100, 1600],
      a: [/leave the debris/i],
      b: [/haul away/i, /clean the driveway area/i],
      bNot: [/leave the debris/i],
    },
    {
      raw: "Customer needs cedar removed by porch. Option A: remove cedar and leave debris, 750. Option B: remove cedar, haul debris, and clean porch area, 1150.",
      prices: [750, 1150],
      a: [/cedar/i, /leave the debris/i],
      b: [/cedar/i, /haul away/i, /clean the porch area/i],
    },
    {
      raw: "Customer needs maple removed beside shed. Option A: cut maple down only, 1100. Option B: cut maple down and grind stump, 1550.",
      prices: [1100, 1550],
      b: [/grind the stump/i],
    },
    {
      raw: "Customer needs pine removed by shed. Option A: cut pine down only, 950. Option B: cut pine down and clean up debris, 1300.",
      prices: [950, 1300],
      b: [/clean up the debris/i],
    },
    {
      raw: "Customer needs sycamore removed by creek. Option A: remove sycamore only, 2600. Option B: remove sycamore, haul debris, and clean creek area, 3400.",
      prices: [2600, 3400],
      b: [/haul away/i, /clean the creek area/i],
    },
    {
      raw: "Customer needs cedar removed. A cut and stack 800. B cut and haul 1200.",
      prices: [800, 1200],
      a: [/cedar/i],
      b: [/cedar/i, /haul away/i],
    },
    {
      raw: "Customer needs two pines removed. A remove and leave debris 1400. B remove and hual debris 2000.",
      prices: [1400, 2000],
      a: [/two/i, /leave the debris/i],
      b: [/two/i, /haul away/i],
    },
    {
      raw: "Customer needs two cedars removed. A remove both, debris stays 1000. B remove both, debris hauled 1500.",
      prices: [1000, 1500],
      a: [/two cedar trees/i, /leave the debris/i],
      b: [/two cedar trees/i, /haul away/i],
    },
    {
      raw: "Customer needs maple removed from back yard. A removal only 1250. B removal plus stump work 1750.",
      prices: [1250, 1750],
      b: [/grind the stump/i],
    },
    {
      raw: "Customer needs dead pine removed. A remove and stack logs 950. B remove, stack logs, clean debris 1300.",
      prices: [950, 1300],
      a: [/leave the logs/i],
      b: [/leave the logs/i, /clean up the debris/i],
    },
    {
      raw: "Customer needs cedar by porch removed. A remove and leave debris 750. B remove and clean everything up 1150.",
      prices: [750, 1150],
      a: [/cedar/i, /leave the debris/i],
      b: [/cedar/i, /clean everything up/i],
      bNot: [/leave the debris/i],
    },
  ];

  for (const item of cases) {
    const alphaJson = forceCanonical(item.raw);
    assert.equal(alphaJson.service_options?.canonical_service_assembler_applied, true, item.raw);
    assert.deepEqual(optionPrices(alphaJson), item.prices, item.raw);
    assert.equal(firstRole(alphaJson), "EXPLICIT_OPTION_TOTAL", item.raw);

    const [optionA, optionB] = alphaJson.service_options.items;
    const optionAText = optionText(optionA);
    const optionBText = optionText(optionB);
    for (const pattern of item.a || []) assert.match(optionAText, pattern, item.raw);
    for (const pattern of item.b || []) assert.match(optionBText, pattern, item.raw);
    for (const pattern of item.bNot || []) assert.doesNotMatch(optionBText, pattern, item.raw);
  }
});

test("customer option text preserves every source-attached add-on action", () => {
  const cases = [
    {
      raw: "Remove 2 maples, John W. 22 Main street, Madison, 1234567890 wj234@gmail.com option a remove only 1000, option b grind stumps and haul away 1900.",
      prices: [1000, 1900],
      title: /stump grinding and debris haul-away/i,
      description: "Remove the two maple trees, grind the stumps and haul away the debris.",
    },
    {
      raw: "Customer needs one oak removed. Option A remove only 1000. Option B stump grinding plus haul away plus cleanup 1900.",
      prices: [1000, 1900],
      title: /stump grinding, debris haul-away, and cleanup/i,
      description: "Remove the oak tree, grind the stump, haul away the debris, and clean up the work area.",
    },
  ];

  for (const item of cases) {
    const alphaJson = forceCanonical(item.raw);
    assert.equal(alphaJson.service_options?.canonical_service_assembler_applied, true, item.raw);
    assert.deepEqual(optionPrices(alphaJson), item.prices, item.raw);

    const optionB = alphaJson.service_options.items[1];
    assert.match(optionB.title, item.title, item.raw);
    assert.equal(optionB.description, item.description, item.raw);

    const sourceWarnings = (validateAlphaJson(alphaJson).warnings || [])
      .filter((warning) => String(warning).startsWith("SOURCE_"));
    assert.deepEqual(sourceWarnings, [], item.raw);
  }
});

test("ambiguous add-on price roles stay blocked instead of guessing arithmetic", () => {
  const alphaJson = forceCanonical(
    "Customer needs one maple removed. Option A remove tree only 1000. Plus stump grinding 450 per stump.",
  );
  const validation = validateAlphaJson(alphaJson);

  assert.equal(validation.can_generate_pdf, false);
  assert.ok(validation.structural_error_codes.includes("AMBIGUOUS_PRICE_ROLE"));
  assert.notDeepEqual(optionPrices(alphaJson), [1000, 1450]);
});
