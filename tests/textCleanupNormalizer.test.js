import test from "node:test";
import assert from "node:assert/strict";
import { normalizeContactFields } from "../lib/contactNormalizer.js";
import { buildOptionPriceCandidateView } from "../lib/optionPriceNormalizer.js";
import {
  buildEvidenceBackedTextCleanupResult,
  buildPreNormalizerParserInput,
  buildTextCleanupParserInput,
  coherentNoteNormalizer,
  textCleanupNormalizer,
} from "../lib/textCleanupNormalizer.js";

function changeTypes(result) {
  return result.changes.map((change) => change.type);
}

test("text cleanup keeps raw input and does not create parser output", () => {
  const raw = "  John call 812 555 1212\n\n\nremvoe oak 2500$  ";
  const result = textCleanupNormalizer(raw);

  assert.equal(result.rawInput, raw);
  assert.equal("alphaJson" in result, false);
  assert.equal("customer" in result, false);
  assert.equal("service_options" in result, false);
  assert.equal(result.cleanedText, "John call 812-555-1212\n\nremove oak $2500");
  assert.ok(result.changes.every((change) => change.confidence === "high"));
});

test("whitespace cleanup preserves useful line structure", () => {
  const raw = "  option A   remove only\n\n\n\noption B\t\tremove and haul   $ 2500  ";
  const result = textCleanupNormalizer(raw);

  assert.equal(result.cleanedText, "option A remove only\n\noption B remove and haul $2500");
  assert.ok(changeTypes(result).includes("whitespace"));
  assert.ok(changeTypes(result).includes("price_format"));
});

test("punctuation cleanup is narrow and keeps wording intact", () => {
  const result = textCleanupNormalizer("oak,,, remove?? option A:remove oak,$2500");

  assert.equal(result.cleanedText, "oak, remove?? option A: remove oak, $2500");
  assert.ok(result.changes.some((change) => change.type === "punctuation" && change.before === ",,,"));
  assert.equal(result.changes.some((change) => change.type === "punctuation" && change.before === "??"), false);
});

test("punctuation cleanup preserves uncertainty markers instead of making them look certain", () => {
  const raw = "same price??? separate?? with stump??? not sure?? maybe??";
  const result = textCleanupNormalizer(raw);

  assert.equal(result.cleanedText, raw);
  assert.ok(result.warnings.includes("ambiguous_text_left_unchanged"));
  assert.doesNotMatch(result.cleanedText, /same price[.]|separate[.]|with stump[.]/i);
});

test("allowlist typo cleanup does not act like broad spellcheck", () => {
  const result = textCleanupNormalizer("adress addrss remvoe remve triming stmp stmping brsh garaje Maddison take down");

  assert.equal(result.cleanedText, "address address remove remove trimming stump stumping brush garage Maddison take down");
  assert.equal(result.cleanedText.includes("Maddison"), true);
  assert.equal(result.cleanedText.includes("take down"), true);
  assert.ok(result.changes.filter((change) => change.type === "spelling").length >= 8);
});

test("typo cleanup does not correct names, street names, city names, or uncommon words", () => {
  const raw = "Maddison Garaje lives on Remve Street near Addrss Court in Trimingham. remove oak by garage.";
  const result = textCleanupNormalizer(raw);

  assert.equal(result.cleanedText, raw);
  assert.equal(result.changes.filter((change) => change.type === "spelling").length, 0);
});

test("grnd only changes in obvious tree-service context", () => {
  const treeContext = textCleanupNormalizer("stump grnd by garage");
  const unclearContext = textCleanupNormalizer("invoice grnd total");

  assert.equal(treeContext.cleanedText, "stump grinding by garage");
  assert.equal(unclearContext.cleanedText, "invoice grnd total");
});

test("grnd cleanup does not rewrite names, streets, or non-tree notes", () => {
  const raw = "Grnd family at 42 Grnd Avenue. invoice grnd total. stump grnd by shed.";
  const result = textCleanupNormalizer(raw);

  assert.equal(result.cleanedText, "Grnd family at 42 Grnd Avenue. invoice grnd total. stump grinding by shed.");
  assert.equal(result.changes.filter((change) => /\bgrnd\b/i.test(change.before)).length, 1);
});

test("tree-service readability cleanup does not canonicalize final service labels", () => {
  const result = textCleanupNormalizer("stump grind, take down pine, cut down oak");

  assert.equal(result.cleanedText, "stump grinding, take down pine, cut down oak");
  assert.ok(result.changes.some((change) => change.type === "tree_service_term"));
});

test("price formatting preserves original number text in trace", () => {
  const result = textCleanupNormalizer("dollar sign 2500, 2500$, $ 1800, price 2, 500, option 2, 500");

  assert.equal(result.cleanedText, "$2500, $2500, $1800, price 2,500, option 2, 500");
  assert.ok(result.changes.some((change) => change.type === "dictation_cleanup" && change.before === "dollar sign 2500"));
  assert.ok(result.changes.some((change) => change.type === "price_format" && change.before === "2500$"));
  assert.ok(result.changes.some((change) => change.type === "price_format" && change.before === "$ 1800"));
  assert.ok(result.changes.some((change) => change.type === "price_format" && change.before === "2, 500"));
});

test("ambiguous numbers are preserved when comma spacing may not be a price", () => {
  const raw = "option 2, 500 maybe trees? route 2, 500 feet. price 2, 500.";
  const result = textCleanupNormalizer(raw);

  assert.equal(result.cleanedText, "option 2, 500 maybe trees? route 2, 500 feet. price 2,500.");
  assert.ok(result.warnings.includes("ambiguous_text_left_unchanged"));
  assert.ok(result.warnings.includes("numbers_present_preserved"));
  assert.equal(result.changes.filter((change) => change.type === "price_format" && change.before === "2, 500").length, 1);
});

test("contact cleanup normalizes obvious email and phone formatting only", () => {
  const result = textCleanupNormalizer("john @ gmail . com, jane at example dot com, call 812 555 1212, (812)555-3434");

  assert.equal(result.cleanedText, "john@gmail.com, jane@example.com, call 812-555-1212, 812-555-3434");
  assert.ok(result.changes.some((change) => change.type === "contact_format" && change.before === "john @ gmail . com"));
  assert.ok(result.changes.some((change) => change.type === "dictation_cleanup" && change.before === "jane at example dot com"));
  assert.equal(result.changes.filter((change) => change.type === "contact_format").length >= 3, true);
});

test("phone cleanup does not format partial IDs, prices, percentages, or longer numbers", () => {
  const raw = [
    "customer id 991812555121277",
    "$812 555 1212 is not a phone",
    "812 555 1212% is not a phone",
    "partial 812 555",
    "real phone 812 555 3434",
  ].join("\n");
  const result = textCleanupNormalizer(raw);

  assert.match(result.cleanedText, /991812555121277/);
  assert.match(result.cleanedText, /\$812 555 1212/);
  assert.match(result.cleanedText, /812 555 1212%/);
  assert.match(result.cleanedText, /partial 812 555/);
  assert.match(result.cleanedText, /real phone 812-555-3434/);
  assert.equal(result.changes.filter((change) => change.type === "contact_format" && /812 555 1212/.test(change.before)).length, 0);
});

test("phone cleanup leaves uncertain 10-digit-looking number sequences unchanged", () => {
  const raw = [
    "410 Spruce Ct 3 trees 40 ft 2500 maybe",
    "option 1 2 trees 2500",
    "job 123 456 7890",
    "quote 123 456 7890",
    "mixed 123 456 7890 2500",
  ].join("\n");
  const result = textCleanupNormalizer(raw);

  assert.equal(result.cleanedText, raw);
  assert.equal(result.changes.filter((change) => change.type === "contact_format").length, 0);
});

test("uncertainty language and numbers remain visible", () => {
  const raw = "maybe around 2500, same price? separate? not included with stump?";
  const result = textCleanupNormalizer(raw);

  assert.equal(result.cleanedText, raw);
  assert.ok(result.warnings.includes("ambiguous_text_left_unchanged"));
  assert.ok(result.warnings.includes("numbers_present_preserved"));
});

test("do-no-harm cases keep names, street names, counts, measurements, options, and uncertainty", () => {
  const raw = [
    "Jon Smyth",
    "410 Spruce Ct",
    "Vally View",
    "take down oak",
    "option 1, 2 trees",
    "3 trees",
    "40 ft",
    "2500 maybe",
    "same price??",
    "with stump??",
    "2500 or 2800 with stump not sure",
  ].join("\n");
  const result = textCleanupNormalizer(raw);

  assert.equal(result.cleanedText, raw);
  assert.ok(result.warnings.includes("ambiguous_text_left_unchanged"));
  assert.ok(result.warnings.includes("numbers_present_preserved"));
  assert.equal(result.changes.length, 0);
});

test("parser input includes raw source of truth and cleaned reading aid", () => {
  const raw = "  john @ gmail . com\nremvoe oak,,, 2500$  ";
  const cleanup = textCleanupNormalizer(raw);
  const parserInput = buildTextCleanupParserInput(cleanup);

  assert.equal(cleanup.rawInput, raw);
  assert.match(parserInput, /Original raw TD1 notes/);
  assert.match(parserInput, /Literal cleaned text/);
  assert.match(parserInput, /Coherent note from deterministic pre-AI rewrite/);
  assert.match(parserInput, /Pre-AI evidence JSON/);
  assert.match(parserInput, /Pre-AI rewrite_trace/);
  assert.match(parserInput, /preserve this exactly in raw_input\.customer_text/);
  assert.match(parserInput, /raw TD1 notes win/i);
  assert.match(parserInput, /john @ gmail \. com/);
  assert.match(parserInput, /john@gmail\.com/);
  assert.match(parserInput, /remove oak, \$2500/);
});

test("coherent note repairs spaced email variants without replacing raw input", () => {
  const cases = [
    "email john . smith @ example . com",
    "email john . smith@example . com",
    "email JOHN . SMITH@EXAMPLE . COM",
  ];

  for (const raw of cases) {
    const result = textCleanupNormalizer(raw);
    assert.equal(result.rawInput, raw);
    assert.match(result.coherentNote, /Email: john\.smith@example\.com/);
    assert.equal(result.evidence.email.value, "john.smith@example.com");
    assert.ok(result.rewriteTrace.some((entry) => entry.field === "email" && entry.type === "contact_repair"));
  }
});

test("coherent note repairs common messy phone variants", () => {
  const cases = [
    "ph 812 . 555 . 1036",
    "fone 812/555/1036",
    "call 812-555 1036",
    "reach at +1 812 555 1036",
  ];

  for (const raw of cases) {
    const result = coherentNoteNormalizer(raw, raw);
    assert.match(result.coherentNote, /Phone: 812-555-1036/);
    assert.equal(result.evidence.phone.value, "812-555-1036");
    assert.ok(result.rewriteTrace.some((entry) => entry.field === "phone" && entry.type === "contact_repair"));
  }
});

test("coherent note splits options and keeps price before address on prior option", () => {
  const raw = [
    "customer=Quinn Frost text/call 812-555 1095",
    "eml-ish quinn.frost95@ example.com",
    "option A grind $800 option B grind and haul $1250 addr there at 763Sycamore Trail Salem IN maybe stump unclear",
  ].join(" ");
  const result = textCleanupNormalizer(raw);

  assert.equal(result.rawInput, raw);
  assert.match(result.coherentNote, /Customer: Quinn Frost/);
  assert.match(result.coherentNote, /Phone: 812-555-1095/);
  assert.match(result.coherentNote, /Email: quinn\.frost95@example\.com/);
  assert.match(result.coherentNote, /Service address: 763 Sycamore Trail Salem IN/);
  assert.match(result.coherentNote, /Option A: grind — \$800/);
  assert.match(result.coherentNote, /Option B: grind and haul — \$1,250/);
  assert.match(result.coherentNote, /Other notes: maybe stump unclear/);
  assert.equal(result.evidence.options.length, 2);
  assert.equal(result.evidence.options[1].price, "$1,250");
  assert.ok(result.rewriteTrace.some((entry) => entry.field === "service_address" && entry.type === "address_repair"));
  assert.ok(result.rewriteTrace.some((entry) => entry.field === "option_b" && entry.type === "option_segmentation"));
});

test("coherent note strips label noise from customer names", () => {
  const cases = [
    ["ish Quinn Frost phone 812-555-1036", "Quinn Frost"],
    ["label Ella Knox call 812-555-1036", "Ella Knox"],
    ["no labels Theo Grant fone 812-555-1036", "Theo Grant"],
  ];

  for (const [raw, expectedName] of cases) {
    const result = textCleanupNormalizer(raw);
    assert.match(result.coherentNote, new RegExp(`Customer: ${expectedName}`));
    assert.equal(result.evidence.customer.value, expectedName);
  }
});

test("coherent note repairs glued street starts", () => {
  const cases = [
    ["svc addr 797Oak Lane phone 812-555-1036", "797 Oak Lane"],
    ["job location 1647Highway 421 call 812-555-1036", "1647 Highway 421"],
  ];

  for (const [raw, expectedAddress] of cases) {
    const result = textCleanupNormalizer(raw);
    assert.match(result.coherentNote, new RegExp(`Service address: ${expectedAddress}`));
    assert.equal(result.evidence.service_address.value, expectedAddress);
    assert.ok(result.rewriteTrace.some((entry) => entry.field === "service_address" && entry.type === "address_repair"));
  }
});

test("parser input includes contact metadata and option-price pre-normalizer clues", () => {
  const raw = "  john@example.com call 812 555 1212 remvoe oak option A $ 2500 option B price 3100 maybe with stump?  ";
  const cleanup = textCleanupNormalizer(raw);
  const contact = normalizeContactFields({ rawText: raw });
  const optionPrice = buildOptionPriceCandidateView(raw);
  const parserInput = buildPreNormalizerParserInput({
    textCleanupResult: cleanup,
    contactNormalizationResult: contact,
    optionPriceCandidateView: optionPrice,
  });

  assert.equal(contact.email.value, "john@example.com");
  assert.equal(contact.phone.display, "812-555-1212");
  assert.match(parserInput, /Pre-AI contact normalizer metadata/);
  assert.match(parserInput, /candidate evidence only; do not treat it as final truth/);
  assert.match(parserInput, /\"accepted_email\": \"john@example\.com\"/);
  assert.match(parserInput, /\"accepted_phone\": \"812-555-1212\"/);
  assert.match(parserInput, /\"source\": \"raw_unlabeled\"/);
  assert.match(parserInput, /Pre-AI option\/price normalizer clues/);
  assert.match(parserInput, /\"normalized\": \"\$2,500\"/);
  assert.match(parserInput, /\"normalized\": \"\$3,100\"/);
  assert.match(parserInput, /candidate clues only; do not create final options or assign final prices/);
  assert.doesNotMatch(parserInput, /service_options/);
});

test("evidence-backed coherent note uses contact and option-price sidecars", () => {
  const raw = "need big oak remuved at 2400 River Rd, cust name maybe Jen Allen or J Allen, phone 812-555-2400, email j.allen2400 maybe gmail maybe not. three optons: A cut tree and leave wood/brush 1500. B cut tree and hawl away brush/logs 2100. C cut tree, hawl away, cleen up yard, and stump grind 2800. gate by alley, dog in yard, text is best.";
  const literalCleanup = textCleanupNormalizer(raw);
  const contact = normalizeContactFields({ rawText: raw });
  const optionPrice = buildOptionPriceCandidateView(raw);
  const result = buildEvidenceBackedTextCleanupResult({
    textCleanupResult: literalCleanup,
    contactNormalizationResult: contact,
    optionPriceCandidateView: optionPrice,
  });

  assert.equal(result.rawInput, raw);
  assert.equal(result.coherentNoteSource, "raw_input_plus_evidence_sidecars");
  assert.match(result.coherentNote, /Customer: Jen Allen, also referred to as J Allen\./);
  assert.match(result.coherentNote, /Phone: 812-555-2400/);
  assert.match(result.coherentNote, /Email: missing or incomplete; note says "j\.allen2400 maybe gmail maybe not"/);
  assert.match(result.coherentNote, /Service address: 2400 River Rd/);
  assert.match(result.coherentNote, /Work requested: Remove one big oak/);
  assert.match(result.coherentNote, /Option A: cut tree and leave wood\/brush .* \$1,500/);
  assert.match(result.coherentNote, /Option B: cut tree and haul away brush\/logs .* \$2,100/);
  assert.match(result.coherentNote, /Option C: cut tree, haul away, clean up yard, and stump grind .* \$2,800/);
  assert.match(result.coherentNote, /Other notes: gate by alley, dog in yard, text is best/);
  assert.doesNotMatch(result.coherentNote, /Work requested: .*Option B/i);
  assert.equal(result.evidence.sidecar_summary.option_price_pairing_count, 3);
  assert.ok(result.rewriteTrace.some((entry) => entry.type === "sidecar_excluded_number_evidence"));
  assert.ok(result.rewriteTrace.some((entry) => entry.type === "sidecar_option_price_pairing"));
});

test("coherent note option lines stop before contact address and access notes", () => {
  const raw =
    "option A trim only $950 option B trim and cleanup $1450; reach at 812 . 555 . 1036; quote email riley . west36 @example . com; service addy 712 Grant Line Rd.";
  const literalCleanup = textCleanupNormalizer(raw);
  const contact = normalizeContactFields({ rawText: raw });
  const optionPrice = buildOptionPriceCandidateView(raw);
  const result = buildEvidenceBackedTextCleanupResult({
    textCleanupResult: literalCleanup,
    contactNormalizationResult: contact,
    optionPriceCandidateView: optionPrice,
  });

  assert.match(result.coherentNote, /Phone: 812-555-1036/);
  assert.match(result.coherentNote, /Email: riley\.west36@example\.com/);
  assert.match(result.coherentNote, /Service address: 712 Grant Line Rd/);
  assert.match(result.coherentNote, /Option A: trim only .* \$950/);
  assert.match(result.coherentNote, /Option B: trim and cleanup .* \$1,450/);
  assert.doesNotMatch(result.coherentNote, /Option B: .*812-555-1036/i);
  assert.doesNotMatch(result.coherentNote, /Option B: .*riley\.west36/i);
  assert.doesNotMatch(result.coherentNote, /Option B: .*712 Grant Line Rd/i);
});

test("parser input rebuilds coherent note from sidecars when given literal cleanup", () => {
  const raw = "need big oak remuved at 2400 River Rd, cust name maybe Jen Allen or J Allen, phone 812-555-2400, email j.allen2400 maybe gmail maybe not. three optons: A cut tree and leave wood/brush 1500. B cut tree and hawl away brush/logs 2100. C cut tree, hawl away, cleen up yard, and stump grind 2800.";
  const literalCleanup = textCleanupNormalizer(raw);
  const contact = normalizeContactFields({ rawText: raw });
  const optionPrice = buildOptionPriceCandidateView(raw);
  const parserInput = buildPreNormalizerParserInput({
    textCleanupResult: literalCleanup,
    contactNormalizationResult: contact,
    optionPriceCandidateView: optionPrice,
  });

  assert.match(parserInput, /Service address: 2400 River Rd/);
  assert.match(parserInput, /Option C: cut tree, haul away, clean up yard, and stump grind .* \$2,800/);
  assert.match(parserInput, /"option_price_pairings"/);
  assert.match(parserInput, /"option_price_pairing_count": 3/);
});

test("parser input can be metadata-only when cleaned text matches raw input", () => {
  const raw = "Customer email tree@example.com Customer phone 812-555-1212 Remove oak option A 2500";
  const cleanup = textCleanupNormalizer(raw);
  const contact = normalizeContactFields({ rawText: raw });
  const parserInput = buildPreNormalizerParserInput({
    textCleanupResult: cleanup,
    contactNormalizationResult: contact,
  });

  assert.equal(cleanup.cleanedText, raw);
  assert.match(parserInput, /Original raw TD1 notes/);
  assert.match(parserInput, /Pre-AI contact normalizer metadata/);
  assert.match(parserInput, /\"accepted_email\": \"tree@example\.com\"/);
  assert.match(parserInput, /\"accepted_phone\": \"812-555-1212\"/);
});
