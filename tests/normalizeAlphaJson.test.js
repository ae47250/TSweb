import test from "node:test";
import assert from "node:assert/strict";
import { normalizeToAlphaJsonV14, normalizePhone, normalizeTreeServiceText } from "../lib/normalizeAlphaJson.js";
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
  assert.equal(normalizePhone("812/555/0144"), "812-555-0144");
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

test("implicit add-on phrasing creates separate customer options", () => {
  const input =
    "Maria Lopez 812-555-0134 805 2nd Street Madison Indiana. Remove one tree by garage for 1000 and also haul away for 1500.";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  assert.equal(validation.can_generate_pdf, true);
  assert.equal(validation.alphaJson.service_options.items.length, 2);
  assert.deepEqual(validation.alphaJson.service_options.items.map((option) => option.price.display), ["$1,000", "$1,500"]);
  assert.match(validation.alphaJson.service_options.items[0].description, /remove one tree/i);
  assert.match(validation.alphaJson.service_options.items[1].description, /haul away/i);
});

test("implicit unpriced add-on is shown but blocked for price follow-up", () => {
  const input =
    "Maria Lopez 812-555-0134 805 2nd Street Madison Indiana. Remove one tree by garage for 1000 and then add to that haul away.";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  assert.equal(validation.can_generate_pdf, false);
  assert.equal(validation.alphaJson.service_options.items.length, 2);
  assert.equal(validation.alphaJson.service_options.items[0].price.display, "$1,000");
  assert.equal(validation.alphaJson.service_options.items[1].price.display, "");
  assert.match(validation.blocking_errors.join(" "), /Option B.*price/i);
});

test("cleans prefixed customer names and preserves email", () => {
  const input =
    "Customer is James Carter phone 502.777.1122 email james.carter@example.com. Job at 88 Pine Ridge Lane Madison Indiana. Wants two leaning trees by driveway removed. Option 1 remove both trees leave wood 1800 dollars. Option 2 remove both and haul away debris 2400 dollars.";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  assert.equal(validation.can_generate_pdf, true);
  assert.equal(validation.alphaJson.customer.name, "James Carter");
  assert.equal(validation.alphaJson.customer.email, "james.carter@example.com");
});

test("amount-before-work add-on phrasing becomes two clean options", () => {
  const input =
    "lady named Beth Ann maybe 5023104455 says place is 19 County Road 8 near Hanover Indiana, big oak out back near fence wants it down. 1000 to drop it and also add haul away for 1500 total if she wants cleanup.";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  assert.equal(validation.can_generate_pdf, true);
  assert.equal(validation.alphaJson.customer.name, "Beth Ann");
  assert.equal(validation.alphaJson.service_options.items.length, 2);
  assert.deepEqual(validation.alphaJson.service_options.items.map((option) => option.price.display), ["$1,000", "$1,500"]);
  assert.match(validation.alphaJson.service_options.items[0].description, /drop tree/i);
  assert.match(validation.alphaJson.service_options.items[1].description, /haul away/i);
});

test("double dollar prices do not leak dollar signs into option descriptions", () => {
  const input =
    "Mark Davis 502-555-7777 needs quote at 900 Cedar Drive Madison Indiana for one fallen tree. Remove and leave wood $$1000. Remove and haul all debris $$1500.";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  assert.equal(validation.can_generate_pdf, true);
  assert.deepEqual(validation.alphaJson.service_options.items.map((option) => option.price.display), ["$1,000", "$1,500"]);
  assert.equal(validation.alphaJson.service_options.items.some((option) => /\$/.test(option.description)), false);
});

test("slash prices create basic and hauling options", () => {
  const input =
    "Joe Carter 8125550000 12 Shed Lane Madison Indiana big tree bad by shed 1200/1800 with hauling.";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  assert.equal(validation.can_generate_pdf, true);
  assert.deepEqual(validation.alphaJson.service_options.items.map((option) => option.price.display), ["$1,200", "$1,800"]);
  assert.match(validation.alphaJson.service_options.items[1].description, /hauling/i);
});

test("package prices ignore tree counts as prices", () => {
  const input =
    "Martha Lane 812-555-4545 500 County Road 10 Madison Indiana. Remove 5 trees. small package 2500 big package 4100.";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  assert.equal(validation.can_generate_pdf, true);
  assert.deepEqual(validation.alphaJson.service_options.items.map((option) => option.price.display), ["$2,500", "$4,100"]);
  assert.equal(validation.alphaJson.service_options.items.some((option) => option.price.display === "$5"), false);
});

test("or-all-of-it messy pricing creates two options", () => {
  const input =
    "Karla Price texted 8125551002, 77 Ridge Lane Madison Indiana, dead pine and stump, cheap way 900 or all of it 1700";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  assert.equal(validation.can_generate_pdf, true);
  assert.deepEqual(validation.alphaJson.service_options.items.map((option) => option.price.display), ["$900", "$1,700"]);
  assert.equal(validation.alphaJson.service_options.items.length, 2);
});

test("clean follow-up customer name replaces messy guessed name", () => {
  const input =
    "customer wants estimate from yesterday: two pines, backyard, email only? price 1100 and 1600, no name no number no address. Customer Nora Field. Phone 812-555-7878. Service address 44 Pine Court Hanover Indiana. Work scope: remove two backyard pines. Option A remove pines leave debris 1100. Option B remove pines and haul debris 1600.";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  assert.equal(validation.can_generate_pdf, true);
  assert.equal(validation.alphaJson.customer.name, "Nora Field");
});

test("vague address fragments are blocked for follow-up", () => {
  const input =
    "guy Tom 8125553344 on walnut somewhere wants storm mess cleaned, maybe two trees. basic cleanup 800 full cleanup 1400";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  assert.equal(validation.can_generate_pdf, false);
  assert.match(validation.blocking_errors.join(" "), /address/i);
});

test("email-only customer is a valid contact method", () => {
  const input =
    "Terry Cole email terry.cole@example.com; 511 Mulberry Pike Hanover IN. One cherry laying across pasture gate. cut and move off gate 700; haul away brush/logs 1150.";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  assert.equal(validation.alphaJson.customer.phone_display, "");
  assert.equal(validation.alphaJson.customer.email, "terry.cole@example.com");
  assert.equal(validation.can_generate_pdf, true);
  assert.equal(validation.blocking_errors.some((error) => /phone/i.test(error)), false);
});

test("extracts slash-separated phone numbers from raw notes", () => {
  const input =
    "Customer: Malik Stone. call/text 812/555/0144. service 909 Broadway St Madison, IN. two maples close to alley. low price just cut $2200; better price cut+haul+cleanup $3300.";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  assert.equal(validation.alphaJson.customer.phone_display, "812-555-0144");
});

test("common tree service typos are cleaned in reviewable job and option text", () => {
  const input =
    "Jaxon Reed 812-555-0137 1414 Lanier Dr Hanover IN. twp trees, one dead pine one maple, tree removel + hall off debree. optA drop n leave 2800 optB drop/hual off/cleanup 3900.";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  const reviewText = normalizeTreeServiceText(input);
  assert.match(reviewText, /two trees/i);
  assert.match(reviewText, /tree removal/i);
  assert.match(reviewText, /haul off debris/i);
  assert.equal(/removel|hall off|hual|debree|twp/i.test(reviewText), false);
  assert.equal(validation.alphaJson.service_options.items.some((option) => /removel|hual|debree/i.test(option.description)), false);
});
