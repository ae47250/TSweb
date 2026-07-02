import assert from "node:assert/strict";
import test from "node:test";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { validateAlphaJson } from "../lib/validateJson.js";

const focusedCases = [
  {
    id: "scope-property-unclear-blocks",
    input:
      "812.555.2786 wes.coleman778@example.com customer Wes Coleman fallen tree on neighbor fence at 2824 Cherry Street, Madison, Indiana; scope/property responsibility unclear; price 2450",
    expected: {
      ready: false,
      treeCount: "1 tree",
      prices: ["$2,450"],
      absentPrices: ["$3,450"],
      blocker: /property responsibility|work scope/i,
      followUpId: "unclear_scope_property_responsibility",
    },
  },
  {
    id: "singular-fallen-tree-counts-one",
    input:
      "Marta Gray 812-555-5626 marta@example.com. 7218 Elm Street, Hanover, Indiana. Fallen tree on fence. Option A cut and leave wood $1,900.",
    expected: {
      ready: true,
      treeCount: "1 tree",
      prices: ["$1,900"],
    },
  },
  {
    id: "singular-tree-on-house-counts-one",
    input:
      "Rosa Crawford 812-555-1196 rosa@example.com. 3680 Poplar Ridge Road Madison IN. Tree on house after storm. Option A remove from house and haul debris $2,350.",
    expected: {
      ready: true,
      treeCount: "1 tree",
      prices: ["$2,350"],
    },
  },
  {
    id: "leaning-tree-service-drop-counts-one",
    input:
      "Shane Myers 812-555-3860 shane@example.com. 1582 River Bluff Lane Hanover IN. Leaning tree touching service drop. Option A remove tree $2,650. Option B cleanup $3,200.",
    expected: {
      ready: true,
      treeCount: "1 tree",
      prices: ["$2,650", "$3,200"],
    },
  },
  {
    id: "tree-stuff-does-not-infer-one",
    input:
      "Jenna Wu 812-555-4040 jenna@example.com. 300 Pine Ridge Columbus IN. Tree stuff from last visit, use price from yesterday.",
    expected: {
      ready: false,
      notTreeCount: "1 tree",
      blocker: /tree count|scope|price|option/i,
    },
  },
  {
    id: "several-trees-does-not-infer-one",
    input:
      "Paula King 812-555-2020 paula@example.com. 55 Maple St Salem IN. Remove several trees behind shed. Budget price $3,900.",
    expected: {
      ready: false,
      notTreeCount: "1 tree",
      blocker: /tree count/i,
    },
  },
  {
    id: "two-species-does-not-infer-one",
    input:
      "Cara Mills 812-555-0103 cara@example.com. 2970 Walnut St Madison Indiana. Remove oak and maple near power line. Option A remove trees $2,400.",
    expected: {
      ready: true,
      treeCount: "2 trees",
      notTreeCount: "1 tree",
      prices: ["$2,400"],
    },
  },
  {
    id: "two-species-or-infers-one-uncertain-species",
    input:
      "Cara Mills 812-555-0103 cara@example.com. 2970 Walnut St Madison Indiana. Remove oak or maple near power line. Option A remove tree $2,400.",
    expected: {
      ready: true,
      treeCount: "1 tree",
      prices: ["$2,400"],
    },
  },
  {
    id: "one-or-several-does-not-infer-one",
    input:
      "Ron Blake 812-555-3030 ron@example.com. 91 Poplar Dr Bedford IN. Might be one tree or several trees along back fence. $2,200 if simple.",
    expected: {
      ready: false,
      notTreeCount: "1 tree",
      blocker: /tree count|price/i,
    },
  },
];

function runCase(input) {
  return validateAlphaJson(normalizeToAlphaJsonV14({}, input));
}

function priceDisplays(validation) {
  return (validation.alphaJson.service_options?.items || []).map((option) => option.price?.display || "").filter(Boolean);
}

for (const item of focusedCases) {
  test(`product focused: ${item.id}`, () => {
    const validation = runCase(item.input);
    const actualPrices = priceDisplays(validation);
    const blockingText = validation.blocking_errors.join(" ");

    assert.equal(validation.can_generate_pdf, item.expected.ready);
    if (item.expected.treeCount) assert.equal(validation.alphaJson.job.tree_details.tree_count, item.expected.treeCount);
    if (item.expected.notTreeCount) assert.notEqual(validation.alphaJson.job.tree_details.tree_count, item.expected.notTreeCount);
    for (const price of item.expected.prices || []) assert.ok(actualPrices.includes(price), `${item.id} missing ${price}`);
    for (const price of item.expected.absentPrices || []) assert.ok(!actualPrices.includes(price), `${item.id} invented ${price}`);
    if (item.expected.blocker) assert.match(blockingText, item.expected.blocker);
    if (item.expected.followUpId) {
      assert.ok(
        validation.structured_follow_ups.some((issue) => issue.id === item.expected.followUpId && issue.blocks_pdf),
        `${item.id} missing structured follow-up ${item.expected.followUpId}`,
      );
    }
  });
}

test("product focused: 100 neighbor permission and responsibility samples split allow vs block", () => {
  const towns = ["Madison", "Hanover", "North Vernon", "Salem", "Seymour"];
  const streets = ["Walnut St", "Cherry Lane", "Oak Road", "River Ave", "Maple Dr"];

  for (let index = 0; index < 100; index += 1) {
    const confirmed = index % 2 === 0;
    const town = towns[index % towns.length];
    const street = streets[index % streets.length];
    const houseNumber = 200 + index;
    const price = 1800 + index * 10;
    const permissionText = confirmed
      ? "Not sure whose responsibility at first. Customer confirmed responsibility and neighbor approved access."
      : "May need access to neighbor yard and not sure whose responsibility.";
    const input =
      `Case ${index} 812-555-${String(1000 + index).padStart(4, "0")} case${index}@example.com. ` +
      `Service address ${houseNumber} ${street} ${town} IN. ` +
      `Remove one fallen tree on neighbor fence. ${permissionText} Option A remove and haul ${price}.`;
    const validation = runCase(input);
    const followUpIds = validation.structured_follow_ups.map((issue) => issue.id);

    if (confirmed) {
      assert.equal(validation.can_generate_pdf, true, `confirmed permission should allow case ${index}`);
      assert.ok(!followUpIds.includes("unclear_scope_property_responsibility"), `confirmed case ${index} should not keep unclear scope blocker`);
    } else {
      assert.equal(validation.can_generate_pdf, false, `unclear permission should block case ${index}`);
      assert.ok(followUpIds.includes("unclear_scope_property_responsibility"), `unclear case ${index} missing structured blocker`);
    }
  }
});
