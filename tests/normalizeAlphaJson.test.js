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

test("maps new normalization plus alphaJson response shape", () => {
  const raw = {
    normalization: {
      corrected_interpretation: "Synthetic customer wants one oak removed. Quoted price is $1,200.",
      corrections_made: [{ original: "rmv", corrected: "remove", reason: "Expanded shorthand." }],
      uncertainties: [{ field: "haul_away", issue: "Haul-away not mentioned.", evidence: "No haul-away phrase." }],
      field_evidence: { work_scope: "remove one oak", price: "$1,200" },
    },
    alphaJson: {
      customer: { name: "Shape Test", contact: { phone: "8125556677" } },
      job: { service_address: { display: "17 Oak Road, Madison, Indiana" } },
      service: {
        tree_count_scope: "one oak tree",
        description: "remove one oak",
        options: [{ description: "remove one oak and leave wood", price: 1200 }],
      },
    },
  };
  const validation = validateAlphaJson(normalizeToAlphaJsonV14(raw, ""));

  assert.equal(validation.can_generate_pdf, true);
  assert.equal(validation.alphaJson.customer.phone_display, "812-555-6677");
  assert.equal(validation.alphaJson.normalization.corrected_interpretation, raw.normalization.corrected_interpretation);
  assert.deepEqual(validation.alphaJson.normalization.corrections_made[0], raw.normalization.corrections_made[0]);
});

test("corrected interpretation omits structured contact label lines", () => {
  const input = [
    "Customer name: Test Alpha Customer",
    "Customer phone: 812-555-0199",
    "Customer email: test.alpha@example.com",
    "Service address: 805 2nd Street, Madison, IN",
    "",
    "Remove 3 oak trees near the back fence. Option 1 cut and haul debris $2000. Option 2 remove trees, haul debris, and stump grind $2800.",
  ].join("\n");
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  const corrected = validation.alphaJson.normalization.corrected_interpretation;

  assert.match(corrected, /Remove 3 oak trees near the back fence/i);
  assert.doesNotMatch(corrected, /Customer name|Customer phone|Customer email|Service address/i);
  assert.doesNotMatch(corrected, /test\.alpha@example\.com|812-555-0199/i);
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

test("cleans customer names from email, address, and missing-contact cues", () => {
  const cases = [
    {
      input:
        "customer Ivy French\nemail ivy.french414@example.com\n4955 Maple Avenue Hanover Indiana\nremove 3 sweet gum trees\nquote options: remove only 1850; remove plus cleanup $2,750",
      expectedName: "Ivy French",
    },
    {
      input:
        "email stella.hunt683@example.com Stella Hunt -- remove four oak trees -- service address 7614 Liberty Road Hanover IN -- quote options: remove only 1500; remove plus cleanup $2,000",
      expectedName: "Stella Hunt",
    },
    {
      input:
        "customer Victor Henderson\nemail only victor.henderson337@example.com\n2090 Highway 421, Madison, Indiana\ntake down 3 dead elm trees\nquote options: remove only 1,500; remove plus cleanup 1,800",
      expectedName: "Victor Henderson",
    },
    {
      input:
        "Henry Cooper\n6280 Mulberry Street, Madison, Indiana\ncall/text 1-812-555-5940\n4 sweet gum trees removal\ncheap way and full cleanup options, prices missing",
      expectedName: "Henry Cooper",
    },
    {
      input:
        "Garza, Kara\n5526 Thomas Hill Road - Hanover Indiana\n(812) 555-7430 kara.garza390@example.com\nremove three dead elm trees\ncheap way and full cleanup options, prices missing",
      expectedName: "Kara Garza",
    },
    {
      input:
        "Ruth Stone no phone written no email 1867 Hilltop Road Madison IN remove two leaning pine trees option A $2,650 option B 2950",
      expectedName: "Ruth Stone",
    },
    {
      input:
        "note from Victor Peterson contact later 5888 Mill Street Madison IN; 3 maple trees removal; $2350/$2,700",
      expectedName: "Victor Peterson",
    },
  ];

  for (const testCase of cases) {
    const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, testCase.input));
    assert.equal(validation.alphaJson.customer.name, testCase.expectedName, testCase.input);
  }
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

test("slash prices preserve the amount before the slash", () => {
  const input =
    "note from Kayla Gibson; address at 7627 Creekside Drive in Madison Indiana; 1-812-555-4959 kayla.gibson107@example.com; needs take down 1 dead ash tree; price $950 leave wood / $1,700 haul off";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  assert.equal(validation.can_generate_pdf, true);
  assert.deepEqual(validation.alphaJson.service_options.items.map((option) => option.price.display), ["$950", "$1,700"]);
  assert.match(validation.alphaJson.service_options.items[0].description, /leave wood/i);
  assert.match(validation.alphaJson.service_options.items[1].description, /haul off/i);
});

test("bare slash prices extract prices but block unclear option scope", () => {
  const input =
    "Autumn Kennedy said text 812-555-9196 3119 Elm Street - Madison Indiana 2600/2,950 for tree? no note on haul or stump";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  assert.equal(validation.can_generate_pdf, false);
  assert.deepEqual(validation.alphaJson.service_options.items.map((option) => option.price.display), ["$2,600", "$2,950"]);
  assert.match(validation.blocking_errors.join(" "), /option descriptions|stump/i);
});

test("gate codes are not treated as prices", () => {
  const input =
    "Kevin Cox call/text 8125555377. 6097 Poplar Ridge Road, Madison, IN. one river birch tree removal. gate code 1234, dog in back. drop $850 cleanup $1250";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  assert.equal(validation.can_generate_pdf, true);
  assert.deepEqual(validation.alphaJson.service_options.items.map((option) => option.price.display), ["$850", "$1,250"]);
});

test("highway route numbers are not treated as prices", () => {
  const input =
    "812 555 5977 gabe.baker621@example.com customer Gabe Baker -- cut down 1 locust tree near fence -- service address at 6163 Highway 421 in Madison Indiana -- drop only $2,100; drop plus haul away $2750";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  assert.equal(validation.can_generate_pdf, true);
  assert.deepEqual(validation.alphaJson.service_options.items.map((option) => option.price.display), ["$2,100", "$2,750"]);
});

test("state road numbers are not treated as tree counts and vague counts block", () => {
  const input =
    "Victor Myers 8125552990 victor.myers270@example.com 1296 State Road 56 Hanover Indiana remove several trees near back fence. Option A 2500 Option B haul $2,950";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));

  assert.equal(validation.can_generate_pdf, false);
  assert.equal(validation.alphaJson.job.tree_details.tree_count, "");
  assert.match(validation.blocking_errors.join(" "), /tree count/i);
  assert.match(validation.follow_ups.join(" "), /how many trees/i);
});

test("article tree count is one only in clear tree-work context", () => {
  const clearRemoval = validateAlphaJson(normalizeToAlphaJsonV14(
    {},
    "Article Count 812-555-2303 18 Oak Lane Madison Indiana. Remove a maple tree by garage. Option A cut and leave wood $1,200.",
  ));
  assert.equal(clearRemoval.alphaJson.job.tree_details.tree_count, "1 tree");
  assert.equal(clearRemoval.can_generate_pdf, true);

  const ambiguous = validateAlphaJson(normalizeToAlphaJsonV14(
    {},
    "Ambiguous Article 812-555-2304 20 Oak Lane Madison Indiana. Wind damage, not sure if it is one tree or several, haul debris $1,300.",
  ));
  assert.equal(ambiguous.can_generate_pdf, false);
  assert.match(`${ambiguous.blocking_errors.join(" ")} ${ambiguous.follow_ups.join(" ")}`, /tree count|how many trees/i);
});

test("drop and cleanup shorthand creates two priced options", () => {
  const input =
    "812-555-6874 kevin.young402@example.com Kevin Young said -- storm damaged dead elm, remove one treee tree and clean up limbs -- service address 6422 College Avenue - Hanover Indiana -- gate code 1234, dog in back. drop 1,900 cleanup 2,850";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  assert.equal(validation.can_generate_pdf, true);
  assert.deepEqual(validation.alphaJson.service_options.items.map((option) => option.price.display), ["$1,900", "$2,850"]);
});

test("price then haul shorthand keeps base price before haul price", () => {
  const input =
    "lady named Luke Cooper says email quote but email not provided. 1893 Wilson Avenue - Madison Indiana. take down two sycamore trees. price $1,350 haul 2,250";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  assert.equal(validation.can_generate_pdf, false);
  assert.deepEqual(validation.alphaJson.service_options.items.map((option) => option.price.display), ["$1,350", "$2,250"]);
  assert.match(validation.blocking_errors.join(" "), /phone or email/i);
});

test("cheap way and full cleanup shorthand creates two priced options", () => {
  const input =
    "lady named Megan Rogers call/text 1-812-555-7929. 5428 Maple Avenue Hanover IN. take down 4 walnut trees. cheap way $1900 full cleanup $2750";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  assert.equal(validation.can_generate_pdf, true);
  assert.deepEqual(validation.alphaJson.service_options.items.map((option) => option.price.display), ["$1,900", "$2,750"]);
});

test("drop haul cleanup shorthand creates three priced options", () => {
  const input =
    "Tina Bell call/text 1-812-555-4534 279 River Bluff Lane, Hanover, IN cut down 3 bradford pear trees leave logs stacked option drop only $1,450 haul brush $2400 full cleanup 2,900";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  assert.equal(validation.can_generate_pdf, true);
  assert.deepEqual(validation.alphaJson.service_options.items.map((option) => option.price.display), ["$1,450", "$2,400", "$2,900"]);
});

test("more than four shorthand options keep first four by price and warn", () => {
  const input =
    "812.555.3294 kayla.hughes062@example.com note from Kayla Hughes -- take down 3 maple trees -- service address 881 State Road 56, Madison, Indiana -- A drop only 1,900 B drop stack wood $2,200 C haul brush 3150 D full cleanup 3,900 E cleanup plus stump grind $4,350";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  assert.equal(validation.can_generate_pdf, true);
  assert.deepEqual(validation.alphaJson.service_options.items.map((option) => option.price.display), ["$1,900", "$2,200", "$3,150", "$3,900"]);
  assert.match(validation.warnings.join(" "), /More than four options/);
});

test("amount-before-work add-on keeps base work as Option A", () => {
  const input =
    "customer Kayla Carroll; address 5530 Liberty Road, Hanover, Indiana; 812-555-2157; needs take down 1 elm tree; $800 to drop it plus 1300 to haul off brush";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  assert.equal(validation.can_generate_pdf, true);
  assert.equal(validation.alphaJson.service_options.items[0].label, "Option A");
  assert.equal(validation.alphaJson.service_options.items[1].label, "Option B");
  assert.deepEqual(validation.alphaJson.service_options.items.map((option) => option.price.display), ["$800", "$1,300"]);
  assert.match(validation.alphaJson.service_options.items[0].description, /drop/i);
  assert.match(validation.alphaJson.service_options.items[1].description, /haul off brush/i);
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

test("June 30 reviewed production cases preserve safe parser decisions", () => {
  const case0039 = validateAlphaJson(normalizeToAlphaJsonV14(
    {},
    "lady named Nora Burns 812.555.2443 wants take down 4 pine trees near Clifty Falls entrance. option A $1,900 option B haul $2,450",
  ));
  assert.equal(case0039.can_generate_pdf, false);
  assert.equal(case0039.alphaJson.job.service_address.display, "");
  assert.equal(case0039.alphaJson.job.tree_details.tree_count, "4 trees");
  assert.equal(case0039.alphaJson.job.tree_details.tree_type, "pine");
  assert.deepEqual(case0039.alphaJson.service_options.items.map((option) => option.price.display), ["$1,900", "$2,450"]);
  assert.match(case0039.alphaJson.service_options.items[0].description, /Service Option A/i);
  assert.match(case0039.alphaJson.service_options.items[1].description, /haul/i);
  assert.match(case0039.follow_ups.join(" "), /exact service address/i);

  const case0259 = validateAlphaJson(normalizeToAlphaJsonV14(
    {},
    "note from Wade Foster 8125551583 wade.foster259@example.com 7544 2nd Street, Hanover, Indiana option A 1,800 option B 2200, no descriptions",
  ));
  assert.equal(case0259.can_generate_pdf, false);
  assert.deepEqual(case0259.alphaJson.service_options.items.map((option) => option.price.display), ["$1,800", "$2,200"]);
  assert.match(case0259.blocking_errors.join(" "), /option descriptions/i);
  assert.match(case0259.follow_ups[0], /what does each priced option include/i);

  const case0330 = validateAlphaJson(normalizeToAlphaJsonV14(
    {},
    "Seth West call/text 812 555 4210 says use price from yesterday for 704 Greenbriar Lane - Madison IN, tree job, send estimate",
  ));
  assert.equal(case0330.can_generate_pdf, false);
  assert.equal(case0330.alphaJson.job.tree_details.tree_count, "");
  assert.match(case0330.blocking_errors.join(" "), /priced service option/i);

  const case0319 = validateAlphaJson(normalizeToAlphaJsonV14(
    {},
    "Whitney Mendez said 812 555 3803 whitney.mendez319@example.com wants take down one bradford pear tree somewhere near River Road. option A $900 option B haul 1400",
  ));
  assert.equal(case0319.can_generate_pdf, false);
  assert.equal(case0319.alphaJson.job.service_address.display, "");
  assert.equal(case0319.alphaJson.job.tree_details.tree_count, "1 tree");
  assert.equal(case0319.alphaJson.job.tree_details.tree_type, "bradford pear");
  assert.deepEqual(case0319.alphaJson.service_options.items.map((option) => option.price.display), ["$900", "$1,400"]);
  assert.match(case0319.follow_ups.join(" "), /exact service address/i);

  const case0370 = validateAlphaJson(normalizeToAlphaJsonV14(
    {},
    "guy Donna Reed 812.555.5690 donna.reed370@example.com says use price from yesterday for 1529 Spring Street Madison Indiana, tree job, send estimate",
  ));
  assert.equal(case0370.can_generate_pdf, false);
  assert.equal(case0370.alphaJson.job.tree_details.tree_count, "");
  assert.match(case0370.blocking_errors.join(" "), /priced service option/i);
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

test("tow typo becomes two only when attached to tree-count wording", () => {
  const sweetGum = validateAlphaJson(normalizeToAlphaJsonV14(
    {},
    "George Reynolds 8125554062 7816 Meadow Lane Madison Indiana. tow sweet gum trees removal. A leave rounds $1900 B hall off debree $2,700",
  ));
  assert.equal(sweetGum.alphaJson.job.tree_details.tree_count, "2 trees");
  assert.equal(sweetGum.alphaJson.job.tree_details.tree_type, "sweet gum");
  assert.deepEqual(sweetGum.alphaJson.service_options.items.map((option) => option.price.display), ["$1,900", "$2,700"]);

  const spruce = validateAlphaJson(normalizeToAlphaJsonV14(
    {},
    "Caleb Wood 812-555-2592 5430 Wilson Avenue Hanover Indiana needs removeal for tow spruce treess and hall off debree; cheap qoute 2,200 full estiment with cleanup 2,800",
  ));
  assert.equal(spruce.alphaJson.job.tree_details.tree_count, "2 trees");
  assert.equal(spruce.alphaJson.job.tree_details.tree_type, "spruce");
  assert.deepEqual(spruce.alphaJson.service_options.items.map((option) => option.price.display), ["$2,200", "$2,800"]);

  const towTruck = validateAlphaJson(normalizeToAlphaJsonV14(
    {},
    "Tow Truck Test 812-555-2301 12 Oak Lane Madison Indiana. tow truck access near trees, removal package $1200.",
  ));
  assert.notEqual(towTruck.alphaJson.job.tree_details.tree_count, "2 trees");

  const towAway = validateAlphaJson(normalizeToAlphaJsonV14(
    {},
    "Tow Away Test 812-555-2302 14 Oak Lane Madison Indiana. remove one maple tree and tow away debris for $1200.",
  ));
  assert.equal(towAway.alphaJson.job.tree_details.tree_count, "1 tree");
});

test("normalization captures obvious typo corrections without blocking safe parse", () => {
  const input =
    "Typo Case 812-555-2201 44 Pine Lane Madison Indiana. 2 mapls by barn trim ovr roof no hawl quoted 1200.";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  const alphaJson = validation.alphaJson;
  const normalization = alphaJson.normalization || {};
  const combinedText = [
    alphaJson.job.description,
    ...alphaJson.service_options.items.map((option) => option.description),
    normalization.corrected_interpretation,
  ].join(" ");

  assert.equal(validation.can_generate_pdf, true);
  assert.equal(alphaJson.service_options.items[0].price.display, "$1,200");
  assert.match(combinedText, /maple/i);
  assert.match(combinedText, /over roof/i);
  assert.doesNotMatch(combinedText, /\bmapls\b|\bovr\b|\bhawl\b/i);
  assert.ok((normalization.corrections_made || []).some((item) => item.original === "mapls" && /maples/i.test(item.corrected)));
});

test("normalization expands tree-service shorthand for safe removal notes", () => {
  const input =
    "Shorthand Case 812-555-2202 55 Cedar Drive Madison Indiana. rmv dead ash by shed, leave wood, no haul, 950.";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  const alphaJson = validation.alphaJson;
  const optionText = alphaJson.service_options.items.map((option) => option.description).join(" ");

  assert.equal(validation.can_generate_pdf, true);
  assert.equal(alphaJson.service_options.items[0].price.display, "$950");
  assert.match(`${alphaJson.job.description} ${optionText}`, /remove|removal/i);
  assert.match(`${alphaJson.job.description} ${optionText}`, /leave wood/i);
});

test("speech-to-text-like unclear species and spoken price blocks instead of inventing", () => {
  const input =
    "Speech Case 812-555-2203 66 Beech Road Madison Indiana. cut too beach trees by barn for twenty five hundred.";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  const followUps = validation.alphaJson.validation.tree_dude_follow_ups.join(" ");

  assert.equal(validation.can_generate_pdf, false);
  assert.match(`${validation.blocking_errors.join(" ")} ${followUps}`, /price|option|unclear|scope/i);
});

test("remove-vs-trim ambiguity blocks for follow-up", () => {
  const input =
    "Ambiguous Scope 812-555-2204 77 Maple Street Madison Indiana. Take care of maple touching roof 900.";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  const followUps = validation.alphaJson.validation.tree_dude_follow_ups.join(" ");

  assert.equal(validation.can_generate_pdf, false);
  assert.match(`${validation.blocking_errors.join(" ")} ${followUps}`, /remove|trim|scope|work/i);
});

test("unclear cleanup or haul-away add-on blocks when scope affects price", () => {
  const input =
    "Cleanup Case 812-555-2205 88 Ash Lane Madison Indiana. Drop dead ash 1100, clean it up if they want.";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  const followUps = validation.alphaJson.validation.tree_dude_follow_ups.join(" ");

  assert.equal(validation.can_generate_pdf, false);
  assert.match(`${validation.blocking_errors.join(" ")} ${followUps}`, /cleanup|haul|price|option/i);
});

test("unclear stump inclusion blocks for follow-up", () => {
  const input =
    "Stump Case 812-555-2206 99 Pine Court Madison Indiana. Remove pine 1400, stump maybe included?";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  const followUps = validation.alphaJson.validation.tree_dude_follow_ups.join(" ");

  assert.equal(validation.can_generate_pdf, false);
  assert.match(`${validation.blocking_errors.join(" ")} ${followUps}`, /stump|included|price|option/i);
});

test("non-firm price language blocks customer-facing estimate", () => {
  for (const priceText of ["around 2k", "price depends", "maybe 1800"]) {
    const input =
      `Price Case 812-555-2207 101 Oak Road Madison Indiana. Remove one oak by garage ${priceText}.`;
    const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
    assert.equal(validation.can_generate_pdf, false, priceText);
    assert.match(validation.blocking_errors.join(" "), /price|priced option/i);
  }
});

test("vague tree job without count or price asks one combined Tree Dude follow-up", () => {
  const input =
    "Tina Long said 8125557170 tina.long410@example.com says use price from yesterday for 249 Ferry Street Madison Indiana, tree job, send estimate";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  const followUps = validation.follow_ups.join(" ");

  assert.equal(validation.can_generate_pdf, false);
  assert.match(validation.blocking_errors.join(" "), /priced service option/i);
  assert.equal(validation.alphaJson.job.tree_details.tree_count, "");
  assert.match(followUps, /how many trees/i);
  assert.match(followUps, /priced option/i);
});

test("missing contact still blocks after messy-input normalization", () => {
  const input =
    "Missing Contact 202 Oak Lane Madison Indiana. Remove one maple by garage. Option A cut and leave wood 1200.";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));

  assert.equal(validation.can_generate_pdf, false);
  assert.match(validation.blocking_errors.join(" "), /phone or email/i);
});

test("missing service address still blocks after messy-input normalization", () => {
  const input =
    "Missing Address 812-555-2208 remove one maple by garage. Option A cut and leave wood 1200.";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));

  assert.equal(validation.can_generate_pdf, false);
  assert.match(validation.blocking_errors.join(" "), /address/i);
});

test("follow-up answers recover missing customer fields without leaking contact notes to customer summary", () => {
  const smokeCases = [
    {
      input:
        "Maria Lopez called from 812-555-0134. Remove 3 oak trees near the back fence. Option A cut and haul debris $2000. Option B remove trees, haul debris, and stump grind $2800.",
      followUps: ["Follow-up 1: Service address is 805 2nd Street, Madison Indiana."],
      expected: {
        name: "Maria Lopez",
        address: "805 2nd Street",
        corrected: /Remove 3 oak trees near the back fence/i,
      },
    },
    {
      input:
        "Email for approval is alex@example.com. Job is at 440 Walnut St Madison IN. Trim limbs over roof and remove brush pile. Option A trim only $850. Option B trim and haul brush $1250.",
      followUps: [],
      expected: {
        name: "",
        email: "alex@example.com",
        address: "440 Walnut St",
        corrected: /^Trim limbs over roof/i,
      },
    },
    {
      input:
        "Customer is Darren Fields. Phone 8125997711. Remove one dead pine by garage. Option A drop and leave wood $950. Option B remove all debris $1450.",
      followUps: ["Follow-up 1: Service address is 440 Walnut St, Madison IN."],
      expected: {
        name: "Darren Fields",
        phone: "812-599-7711",
        address: "440 Walnut St",
        corrected: /Remove one dead pine by garage/i,
      },
    },
    {
      input:
        "Nora Burns called from 812.555.2443 and email nora.burns@example.com. Take down two storm damaged maples. Option A drop and leave logs $2100. Option B remove trees, haul debris, and clean yard $2950.",
      followUps: ["Follow-up 1: Exact service address is 789 West Main, Hanover IN."],
      expected: {
        name: "Nora Burns",
        email: "nora.burns@example.com",
        address: "789 West Main",
        corrected: /^Take down two storm damaged maples/i,
        optionB: "remove trees, haul debris, and clean yard",
      },
    },
    {
      input:
        "Wade Foster wants two maples removed behind the garage, cleanup if customer wants. Option A remove only $1700. Stump maybe included?",
      followUps: [
        "Follow-up 1: Phone is 812-555-3388 and service address is 63 Oak Lane, Madison Indiana.",
        "Follow-up 2: Stump grinding is excluded. Cleanup and haul-away are included in Option B for $2300.",
      ],
      expected: {
        name: "Wade Foster",
        phone: "812-555-3388",
        address: "63 Oak Lane",
        corrected: /two maples removed behind the garage/i,
        optionB: "Cleanup and haul-away",
      },
    },
  ];

  for (const smokeCase of smokeCases) {
    let raw = smokeCase.input;
    let validation = validateAlphaJson(normalizeToAlphaJsonV14({}, raw));
    let used = 0;
    while (!validation.can_generate_pdf && used < smokeCase.followUps.length) {
      raw += `\n${smokeCase.followUps[used]}`;
      used += 1;
      validation = validateAlphaJson(normalizeToAlphaJsonV14({}, raw));
    }

    const alphaJson = validation.alphaJson;
    assert.equal(validation.can_generate_pdf, true, smokeCase.input);
    assert.equal(alphaJson.customer.name, smokeCase.expected.name);
    if (smokeCase.expected.phone) assert.equal(alphaJson.customer.phone_display, smokeCase.expected.phone);
    if (smokeCase.expected.email) assert.equal(alphaJson.customer.email, smokeCase.expected.email);
    assert.match(alphaJson.job.service_address.display, new RegExp(smokeCase.expected.address, "i"));
    assert.match(alphaJson.normalization.corrected_interpretation, smokeCase.expected.corrected);
    assert.doesNotMatch(alphaJson.normalization.corrected_interpretation, /Follow-up|service address|phone is|email for approval/i);
    if (smokeCase.expected.optionB) {
      assert.equal(alphaJson.service_options.items[1].description, smokeCase.expected.optionB);
    }
  }
});

test("follow-up details label does not leak into customer-facing job summary", () => {
  const input =
    "Molly Lopez 812-555-3590 5345 Mulberry Street Madison Indiana. Take down one maple tree. Option A cut only. Option B haul away and cleanup.\nFollow-up 1: Follow-up details: Option A cut and leave wood $1,000. Option B haul debris and cleanup $1,650.";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  const corrected = validation.alphaJson.normalization.corrected_interpretation;

  assert.match(corrected, /Take down one maple tree/i);
  assert.match(corrected, /Option A cut and leave wood \$1,000/i);
  assert.doesNotMatch(corrected, /Follow-up/i);
  assert.doesNotMatch(validation.alphaJson.service_options.items.map((option) => option.description).join(" "), /Follow-up/i);
});

test("safety and access notes stay internal while customer summary remains work-only", () => {
  const input =
    "Daria Moss 812-555-1111 22 Oak Lane Madison Indiana. Aggressive dog in backyard. Remove two maples behind garage. Option A remove only $1700.";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  const alphaJson = validation.alphaJson;

  assert.equal(validation.can_generate_pdf, true);
  assert.match(alphaJson.raw_input.customer_text, /Aggressive dog in backyard/i);
  assert.match(validation.warnings.join(" "), /Safety\/access note: Aggressive dog in backyard\./i);
  assert.match(alphaJson.normalization.corrected_interpretation, /Remove two maples behind garage/i);
  assert.doesNotMatch(alphaJson.normalization.corrected_interpretation, /aggressive dog|dog in backyard/i);
});

test("service address fragments do not leak into customer-facing job summary", () => {
  const input =
    "Eli Stone 812-555-2222 cut down one cedar tree -- service address 7844 Maple Avenue Hanover IN -- basic package 1350; full cleanup package 1800";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  const corrected = validation.alphaJson.normalization.corrected_interpretation;

  assert.equal(validation.can_generate_pdf, true);
  assert.match(validation.alphaJson.job.service_address.display, /7844 Maple Avenue/i);
  assert.match(corrected, /cut down one cedar tree/i);
  assert.match(corrected, /basic package 1350/i);
  assert.doesNotMatch(corrected, /service address|7844 Maple Avenue|Hanover IN/i);
});

test("vague customer-facing prose request blocks without inventing quote details", () => {
  const input =
    "Vague Case 812-555-2209 just make it look professional, maybe around 2k, address later.";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, input));
  const alphaJson = validation.alphaJson;

  assert.equal(validation.can_generate_pdf, false);
  assert.match(validation.blocking_errors.join(" "), /address|scope|price|option/i);
  assert.equal(alphaJson.job.service_address.display, "");
  assert.equal(alphaJson.service_options.items.length, 0);
});
