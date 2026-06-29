import test from "node:test";
import assert from "node:assert/strict";
import { normalizeToAlphaJsonV14, normalizePhone } from "../lib/normalizeAlphaJson.js";
import { validateAlphaJson } from "../lib/validateJson.js";

const customerCases = [
  {
    name: "Maria Lopez clean standard input",
    input:
      "Maria Lopez 812-555-0134, 805 2nd Street, Madison Indiana. Remove 2 maple trees near back fence. Option A cut trees and leave wood stacked 1800. Option B cut trees, haul debris, and grind stumps 2750.",
    expectedName: "Maria Lopez",
    expectedPhone: "812-555-0134",
    addressIncludes: ["805 2nd Street", "Madison"],
    expectedTreeCount: "2 trees",
    prices: ["$1,800", "$2,750"],
    canGenerate: true,
  },
  {
    name: "Jon Baleu current failed style",
    input:
      "J\u00f3n baleu 322-4567899 789 West main, Madison Indiana, two trees, option a haul tree and remove 1200 Option b same as above and sweep 2399",
    expectedName: "J\u00f3n Baleu",
    expectedPhone: "322-456-7899",
    addressIncludes: ["789 West Main", "Madison", "Indiana"],
    expectedTreeCount: "2 trees",
    prices: ["$1,200", "$2,399"],
    canGenerate: true,
  },
  {
    name: "Darren Fields weird phone format",
    input:
      "Darren Fields phone 8125997711 job at 440 Walnut St Madison IN remove one dead pine by garage option a drop and leave wood 950 option b remove all debris 1450",
    expectedName: "Darren Fields",
    expectedPhone: "812-599-7711",
    addressIncludes: ["440 Walnut St", "Madison", "IN"],
    expectedTreeCount: "1 tree",
    prices: ["$950", "$1,450"],
    canGenerate: true,
  },
  {
    name: "Linda Parker address without street suffix",
    input:
      "Linda Parker 812-555-0198 789 West Main Madison Indiana two large trees leaning toward driveway option a remove trees leave logs 2100 option b remove trees haul everything 2950",
    expectedName: "Linda Parker",
    expectedPhone: "812-555-0198",
    addressIncludes: ["789 West Main", "Madison", "Indiana"],
    expectedTreeCount: "2 trees",
    prices: ["$2,100", "$2,950"],
    canGenerate: true,
  },
  {
    name: "Roberto Cruz County Road address",
    input:
      "Roberto Cruz 812.555.4410 service at 1205 County Road 250 W, Hanover IN. Trim limbs over roof and remove brush pile. Option A trim only 850 Option B trim and haul brush 1250.",
    expectedName: "Roberto Cruz",
    expectedPhone: "812-555-4410",
    addressIncludes: ["1205 County Road 250 W", "Hanover", "IN"],
    prices: ["$850", "$1,250"],
    canGenerate: true,
  },
  {
    name: "Beth Ann Miller Highway address",
    input:
      "Beth Ann Miller 812-555-7722 customer says property is 777 Highway 421 near Madison, Indiana. Remove 3 storm damaged trees. Option A cut and stack wood 2400. Option B cut haul debris and cleanup yard 3600.",
    expectedName: "Beth Ann Miller",
    expectedPhone: "812-555-7722",
    addressIncludes: ["777 Highway 421 near Madison", "Indiana"],
    expectedTreeCount: "3 trees",
    prices: ["$2,400", "$3,600"],
    canGenerate: true,
  },
  {
    name: "Sam Whitaker word-number tree count",
    input:
      "Sam Whitaker 812-555-3388 63 Oak Lane, Madison Indiana. There are two trees by the shed and one stump near the fence. Option A remove two trees only 1700 Option B remove two trees and grind stump 2300.",
    expectedName: "Sam Whitaker",
    expectedPhone: "812-555-3388",
    addressIncludes: ["63 Oak Lane", "Madison", "Indiana"],
    expectedTreeCount: "2 trees",
    prices: ["$1,700", "$2,300"],
    canGenerate: true,
  },
  {
    name: "Tina Morales numeric tree count",
    input:
      "Tina Morales 812-555-6644, 914 Cedar Drive, Madison IN, remove 4 small trees along property line. Option A cut and leave debris 1600 Option B cut and haul all debris 2200 Option C full cleanup and stump grind 3100.",
    expectedName: "Tina Morales",
    expectedPhone: "812-555-6644",
    addressIncludes: ["914 Cedar Drive", "Madison", "IN"],
    expectedTreeCount: "4 trees",
    prices: ["$1,600", "$2,200", "$3,100"],
    canGenerate: true,
  },
  {
    name: "Henry Watkins dollar prices with commas",
    input:
      "Henry Watkins 812-555-8821 300 River Road Madison Indiana. Large oak removal near barn. Option A remove oak and leave wood $2,400. Option B remove oak, haul debris, grind stump $3,650.",
    expectedName: "Henry Watkins",
    expectedPhone: "812-555-8821",
    addressIncludes: ["300 River Road", "Madison", "Indiana"],
    prices: ["$2,400", "$3,650"],
    canGenerate: true,
  },
  {
    name: "Paula Greene more than four options",
    input:
      "Paula Greene 812-555-7331 28 Hilltop Ct Madison IN. Cleanup after storm, limbs and one fallen tree. Option A limb cleanup 700 Option B fallen tree cut up 1200 Option C cleanup and haul 1850 Option D cleanup haul and stump 2400 Option E emergency same-day work 3100.",
    expectedName: "Paula Greene",
    expectedPhone: "812-555-7331",
    addressIncludes: ["28 Hilltop Ct", "Madison", "IN"],
    prices: ["$700", "$1,200", "$1,850", "$2,400"],
    canGenerate: true,
    overLimit: true,
  },
];

function assertNormalizedCase(testCase) {
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, testCase.input));
  const alphaJson = validation.alphaJson;
  assert.equal(alphaJson.customer.name, testCase.expectedName);
  assert.equal(alphaJson.customer.phone_display, testCase.expectedPhone);
  for (const part of testCase.addressIncludes) {
    assert.match(alphaJson.job.service_address.display, new RegExp(part, "i"));
  }
  if (testCase.expectedTreeCount) {
    assert.equal(alphaJson.job.tree_details.tree_count, testCase.expectedTreeCount);
  }
  assert.equal(alphaJson.service_options.items.length, testCase.prices.length);
  assert.deepEqual(alphaJson.service_options.items.map((option) => option.price.display), testCase.prices);
  assert.equal(validation.can_generate_pdf, testCase.canGenerate);
  if (testCase.overLimit) {
    assert.match(validation.warnings.join(" "), /More than four options/);
  }
}

test("normalizes phone formats", () => {
  assert.equal(normalizePhone("8125550134"), "812-555-0134");
  assert.equal(normalizePhone("322-4567899"), "322-456-7899");
  assert.equal(normalizePhone("812.555.4410"), "812-555-4410");
});

test("maps client and services shape into canonical AlphaJSON", () => {
  const raw = {
    client: { name: "Maria Lopez", phone: "812-555-0134", service_address: "805 2nd Street, Madison, Indiana" },
    services: [
      {
        tree_count: 2,
        tree_type: "maple",
        location: "near back fence",
        options: [
          { description: "Cut trees and leave wood stacked", price: 1800 },
          { description: "Cut trees, haul debris, and grind stumps", price: 2750 },
        ],
      },
    ],
  };
  const validation = validateAlphaJson(normalizeToAlphaJsonV14(raw, customerCases[0].input));
  assert.equal(validation.can_generate_pdf, true);
  assert.equal(validation.alphaJson.customer.phone_display, "812-555-0134");
  assert.equal(validation.alphaJson.job.tree_details.tree_count, "2 trees");
  assert.equal(validation.alphaJson.service_options.items[1].price.display, "$2,750");
});

test("maps customer contact/address and service options shape", () => {
  const raw = {
    customer: {
      name: "J\u00f3n Baleu",
      contact: { phone: "322-4567899" },
      address: { street: "789 West Main", city: "Madison", state: "Indiana" },
    },
    service: {
      tree_count_scope: "two trees",
      options: [
        { name: "Option A", description: "Haul tree and remove", price: 1200 },
        { name: "Option B", description: "same as above and sweep", price: 2399 },
      ],
    },
  };
  const validation = validateAlphaJson(normalizeToAlphaJsonV14(raw, customerCases[1].input));
  assert.equal(validation.can_generate_pdf, true);
  assert.equal(validation.alphaJson.customer.phone_display, "322-456-7899");
  assert.equal(validation.alphaJson.job.service_address.display, "789 West Main, Madison, Indiana");
  assert.equal(validation.alphaJson.job.tree_details.tree_count, "2 trees");
});

test("maps customer phone/service address and service tree shape", () => {
  const raw = {
    customer: { name: "Henry Watkins", phone: "812-555-8821", service_address: "300 River Road, Madison, Indiana" },
    services: [
      {
        tree: { type: "oak", location: "near barn", size: "large" },
        options: [
          { description: "remove oak and leave wood", price: 2400 },
          { description: "remove oak, haul debris, grind stump", price: 3650 },
        ],
      },
    ],
  };
  const validation = validateAlphaJson(normalizeToAlphaJsonV14(raw, customerCases[8].input));
  assert.equal(validation.can_generate_pdf, true);
  assert.equal(validation.alphaJson.job.tree_details.tree_type, "oak");
  assert.equal(validation.alphaJson.job.tree_details.tree_size, "large");
  assert.match(validation.alphaJson.job.condition_details, /near barn/);
});

for (const testCase of customerCases) {
  test(`customer battery: ${testCase.name}`, () => {
    assertNormalizedCase(testCase);
  });
}

test("missing address blocks only address", () => {
  const input =
    "Chris Nolan 812-555-0099 needs tree work, two trees maybe near driveway, wants estimate today. Option A cut and leave wood 1300 Option B remove and haul debris 2100.";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  assert.equal(validation.can_generate_pdf, false);
  assert.deepEqual(validation.blocking_errors, ["Missing service address."]);
  assert.equal(validation.alphaJson.customer.phone_display, "812-555-0099");
  assert.equal(validation.alphaJson.job.tree_details.tree_count, "2 trees");
  assert.equal(validation.alphaJson.service_options.items.length, 2);
});

test("missing prices blocks only unclear option prices", () => {
  const input =
    "Angela Reed 812-555-9900 1128 Maple Ave Madison Indiana. Remove two trees and clean up limbs. Option A basic removal. Option B removal plus haul away. Option C removal haul and stump grinding.";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  assert.equal(validation.can_generate_pdf, false);
  assert.equal(validation.alphaJson.customer.phone_display, "812-555-9900");
  assert.match(validation.alphaJson.job.service_address.display, /1128 Maple Ave/i);
  assert.equal(validation.alphaJson.job.tree_details.tree_count, "2 trees");
  assert.equal(validation.alphaJson.service_options.items.length, 3);
  assert.ok(validation.blocking_errors.every((error) => /price/i.test(error)));
});
