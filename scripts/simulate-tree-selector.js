import assert from "node:assert/strict";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { validateAlphaJson } from "../lib/validateJson.js";

const TREE_COUNT_BLOCK_RE = /Tree count is marked unknown|Tree count is unclear|Missing tree count or clear scope/i;

const cases = [
  {
    id: "vague-count-only",
    description: "Vague tree count should trigger selector; selecting a real count should clear tree-count blocker.",
    input:
      "Mara Lane 812-555-1515 service address 18 Maple Bend Salem Indiana. Several trees near garage. Option A remove and haul 1800.",
    expectSelectorBefore: true,
    override: "2 trees",
    expectTreeBlockAfter: false,
  },
  {
    id: "tree-count-plus-missing-address",
    description: "Selector should clear tree-count blocker but leave unrelated address blocker.",
    input:
      "Mara Lane 812-555-1515. Several trees near garage. Option A remove and haul 1800.",
    expectSelectorBefore: true,
    override: "2 trees",
    expectTreeBlockAfter: false,
    expectRemainingBlockerAfter: /address/i,
  },
  {
    id: "tree-count-plus-nonfirm-price",
    description: "Selector should clear tree-count blocker but leave unrelated non-firm price blocker.",
    input:
      "Mara Lane 812-555-1515 service address 18 Maple Bend Salem Indiana. Several trees near garage. Option A remove and haul around 1800.",
    expectSelectorBefore: true,
    override: "2 trees",
    expectTreeBlockAfter: false,
    expectRemainingBlockerAfter: /price/i,
  },
  {
    id: "clear-count-no-selector",
    description: "Clear tree count should not trigger selector.",
    input:
      "Mara Lane 812-555-1515 service address 18 Maple Bend Salem Indiana. Remove two oak trees near garage. Option A remove and haul 1800.",
    expectSelectorBefore: false,
  },
  {
    id: "still-unclear-ok",
    description: "Still unclear but OK to proceed records override evidence and does not set real tree count.",
    input:
      "Mara Lane 812-555-1515 service address 18 Maple Bend Salem Indiana. Several trees near garage. Option A remove and haul 1800.",
    expectSelectorBefore: true,
    override: "Still unclear but OK to proceed",
    expectTreeBlockAfter: false,
    expectTreeCountAfter: "",
    expectWarningAfter: /still unclear/i,
  },
];

function runValidation(input, treeCountOverride = "Auto") {
  const intake = { treeCountOverride };
  return validateAlphaJson(normalizeToAlphaJsonV14({}, input, intake));
}

function hasTreeCountBlock(validation) {
  return (validation.blocking_errors || []).some((error) => TREE_COUNT_BLOCK_RE.test(error));
}

function selectorWouldShow(validation) {
  return hasTreeCountBlock(validation);
}

const results = [];
let failures = 0;

for (const item of cases) {
  try {
    const before = runValidation(item.input);
    const selectorBefore = selectorWouldShow(before);
    assert.equal(selectorBefore, item.expectSelectorBefore, `${item.id}: selector trigger mismatch before override`);

    let after = null;
    if (item.override) {
      after = runValidation(item.input, item.override);
      const treeBlockAfter = hasTreeCountBlock(after);
      assert.equal(treeBlockAfter, item.expectTreeBlockAfter, `${item.id}: tree-count blocker mismatch after override`);

      if (item.expectRemainingBlockerAfter) {
        assert.match(after.blocking_errors.join("; "), item.expectRemainingBlockerAfter, `${item.id}: expected unrelated blocker after override`);
      }
      if (item.expectTreeCountAfter !== undefined) {
        assert.equal(after.alphaJson.job.tree_details.tree_count, item.expectTreeCountAfter, `${item.id}: expected tree count after override`);
      }
      if (item.expectWarningAfter) {
        assert.match(after.warnings.join("; "), item.expectWarningAfter, `${item.id}: expected warning after override`);
      }
    }

    results.push({
      id: item.id,
      pass: true,
      selectorBefore,
      beforeCanGenerate: before.can_generate_pdf,
      beforeBlocking: before.blocking_errors,
      override: item.override || "",
      afterCanGenerate: after?.can_generate_pdf ?? null,
      afterTreeCount: after?.alphaJson?.job?.tree_details?.tree_count ?? null,
      afterBlocking: after?.blocking_errors ?? null,
      afterWarnings: after?.warnings ?? null,
    });
  } catch (error) {
    failures += 1;
    results.push({
      id: item.id,
      pass: false,
      error: error.message,
    });
  }
}

console.log(JSON.stringify({
  suite: "tree-selector-behavior",
  passed: failures === 0,
  failureCount: failures,
  results,
}, null, 2));

if (failures > 0) process.exit(1);
