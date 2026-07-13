import test from "node:test";
import assert from "node:assert/strict";
import { normalizeContactFields, normalizeEmail, normalizePhoneCandidate } from "../lib/contactNormalizer.js";
import { LOCAL_INDIANA_TOWNS } from "../lib/localTowns.js";
import { contactNormalizerFixtures } from "./contactNormalizerFixtures.js";

function findCandidate(candidates, predicate) {
  return candidates.find(predicate);
}

test("normalizeEmail and normalizePhoneCandidate only normalize direct contact facts", () => {
  assert.equal(normalizeEmail("Ben.Reed721@Example.com."), "ben.reed721@example.com");
  assert.equal(normalizeEmail("Sam.Tree@gmial.cmo"), "sam.tree@gmial.cmo");
  assert.deepEqual(normalizePhoneCandidate("(812) 555-0134"), { value: "8125550134", display: "812-555-0134" });
  assert.equal(normalizeEmail("ben at example"), "");
  assert.equal(normalizePhoneCandidate("812-555"), null);
});

test("intake wins but raw candidates are still recorded", () => {
  const result = normalizeContactFields({
    rawText: "Call 812-555-9999 email wrong@example.com",
    intake: { email: "RIGHT@Example.COM ", phone: "(812) 555-0134" },
  });

  assert.equal(result.email.value, "right@example.com");
  assert.equal(result.phone.display, "812-555-0134");
  assert.ok(findCandidate(result.email.candidates, (candidate) => candidate.source === "intake" && candidate.accepted));
  assert.ok(findCandidate(result.phone.candidates, (candidate) => candidate.source === "intake" && candidate.accepted));
  assert.ok(findCandidate(result.email.candidates, (candidate) => candidate.raw === "wrong@example.com" && !candidate.accepted));
  assert.ok(findCandidate(result.phone.candidates, (candidate) => candidate.raw === "812-555-9999" && !candidate.accepted));
});

test("intake beats raw labeled contact values", () => {
  const result = normalizeContactFields({
    rawText: "Customer email: raw@example.com. Customer phone: 812-555-9999",
    intake: { email: "intake@example.com", phone: "812-555-0134" },
  });

  assert.equal(result.email.value, "intake@example.com");
  assert.equal(result.phone.display, "812-555-0134");
  assert.ok(findCandidate(result.email.candidates, (candidate) => candidate.source === "intake" && candidate.accepted));
  assert.ok(findCandidate(result.phone.candidates, (candidate) => candidate.source === "intake" && candidate.accepted));
  assert.ok(findCandidate(result.email.candidates, (candidate) => candidate.source === "raw_labeled" && !candidate.accepted));
  assert.ok(findCandidate(result.phone.candidates, (candidate) => candidate.source === "raw_labeled" && !candidate.accepted));
});

test("labeled raw email and phone are normalized directly", () => {
  const result = normalizeContactFields({
    rawText: "Customer email: Ben.Reed721@Example.com. Customer phone: 8125550134",
  });

  assert.equal(result.email.value, "ben.reed721@example.com");
  assert.equal(result.phone.display, "812-555-0134");
  assert.equal(findCandidate(result.email.candidates, (candidate) => candidate.source === "raw_labeled")?.label, "Customer email");
  assert.equal(findCandidate(result.phone.candidates, (candidate) => candidate.source === "raw_labeled")?.label, "Customer phone");
});

test("raw labeled contact values beat raw unlabeled contact values", () => {
  const result = normalizeContactFields({
    rawText: "loose@example.com 812-555-9999 Customer email: labeled@example.com Customer phone: 812-555-0134",
  });

  assert.equal(result.email.value, "labeled@example.com");
  assert.equal(result.phone.display, "812-555-0134");
  assert.ok(findCandidate(result.email.candidates, (candidate) => candidate.source === "raw_labeled" && candidate.accepted));
  assert.ok(findCandidate(result.phone.candidates, (candidate) => candidate.source === "raw_labeled" && candidate.accepted));
  assert.ok(findCandidate(result.email.candidates, (candidate) => candidate.source === "raw_unlabeled" && !candidate.accepted));
  assert.ok(findCandidate(result.phone.candidates, (candidate) => candidate.source === "raw_unlabeled" && !candidate.accepted));
});

test("call and text labels both produce phone candidates", () => {
  const result = normalizeContactFields({
    rawText: "Call: +1 812 555 0198. Text 812.555.7777.",
  });

  assert.equal(result.phone.display, "812-555-0198");
  assert.ok(result.phone.candidates.length >= 2);
  assert.match(result.phone.warnings.join(" "), /multiple/i);
  assert.equal(result.phone.candidates.filter((candidate) => candidate.accepted).length, 1);
  assert.ok(findCandidate(result.phone.candidates, (candidate) => candidate.raw.includes("812 555 0198")));
  assert.ok(findCandidate(result.phone.candidates, (candidate) => candidate.raw.includes("812.555.7777")));
});

test("unlabeled email and phone are normalized directly", () => {
  const result = normalizeContactFields({
    rawText: "ben.reed721@example.com remove three hickory trees 812-555-1721",
  });

  assert.equal(result.email.value, "ben.reed721@example.com");
  assert.equal(result.phone.display, "812-555-1721");
});

test("email typos are corrected only for email-shaped candidates", () => {
  const result = normalizeContactFields({
    rawText: "Sam.Tree@gmial.cmo email if needed.",
  });

  assert.equal(result.email.value, "sam.tree@gmail.com");
  assert.equal(findCandidate(result.email.candidates, (candidate) => candidate.raw === "Sam.Tree@gmial.cmo")?.confidence, "high");
});

test("strong email context upgrades a medium typo correction to high", () => {
  const result = normalizeContactFields({
    rawText: "Sam.Tree@gmal.net email if needed.",
  });

  assert.equal(result.email.value, "sam.tree@gmail.net");
  assert.equal(findCandidate(result.email.candidates, (candidate) => candidate.raw === "Sam.Tree@gmal.net")?.confidence, "high");
});

test("email typo corrections stay medium without strong email context", () => {
  const result = normalizeContactFields({
    rawText: "Sam.Tree@gmal.net remove two trees.",
  });

  assert.equal(result.email.value, "sam.tree@gmail.net");
  assert.equal(findCandidate(result.email.candidates, (candidate) => candidate.raw === "Sam.Tree@gmal.net")?.confidence, "medium");
});

test("labeled written-out email is normalized with high confidence", () => {
  const result = normalizeContactFields({
    rawText: "Reply to mike j at gmail dot com, phone 812-555-0101",
  });

  const candidate = findCandidate(result.email.candidates, (item) => item.raw === "mike j at gmail dot com");
  assert.equal(result.email.value, "mike.j@gmail.com");
  assert.equal(candidate?.source, "raw_labeled");
  assert.equal(candidate?.confidence, "high");
});

test("unlabeled written-out email is normalized with medium confidence", () => {
  const result = normalizeContactFields({
    rawText: "mike j at gmail dot com remove oak by garage",
  });

  const candidate = findCandidate(result.email.candidates, (item) => item.raw === "mike j at gmail dot com");
  assert.equal(result.email.value, "mike.j@gmail.com");
  assert.equal(candidate?.source, "raw_written");
  assert.equal(candidate?.confidence, "medium");
});

test("written-out email uses existing provider and tld typo correction", () => {
  const result = normalizeContactFields({
    rawText: "Customer email sam tree at gmal dot con. Phone: 812-555-0134",
  });

  const candidate = findCandidate(result.email.candidates, (item) => item.raw === "sam tree at gmal dot con");
  assert.equal(result.email.value, "sam.tree@gmail.com");
  assert.equal(candidate?.confidence, "high");
});

test("email cue with at home is recorded as low confidence, not accepted", () => {
  const result = normalizeContactFields({
    rawText: "Message me at home about the tree. Phone: 812-555-0134",
  });

  assert.equal(result.email.value, "");
  assert.equal(result.phone.display, "812-555-0134");
  assert.ok(result.low_confidence_spans.some((span) => span.field === "customer.email"));
  assert.match(result.low_confidence_spans.find((span) => span.field === "customer.email")?.reason || "", /no written-out email address/i);
});

test("bare address and mail raise confidence only for real email-shaped candidates", () => {
  const addressOnly = normalizeContactFields({
    rawText: "Service address is 3327 College Avenue. Remove oak.",
  });
  const mailContext = normalizeContactFields({
    rawText: "Use this mail Sam.Tree@gmal.net for the quote.",
  });

  assert.equal(addressOnly.email.value, "");
  assert.equal(mailContext.email.value, "sam.tree@gmail.net");
  assert.equal(findCandidate(mailContext.email.candidates, (candidate) => candidate.raw === "Sam.Tree@gmal.net")?.confidence, "high");
});

test("prices and addresses are not turned into phone or email values", () => {
  const result = normalizeContactFields({
    rawText: "3327 College Avenue remove three trees option A 1000 option B $1700",
  });

  assert.equal(result.email.value, "");
  assert.equal(result.phone.display, "");
  assert.equal(result.phone.candidates.filter((candidate) => candidate.accepted).length, 0);
});

test("invalid labeled email is left empty and recorded as low confidence", () => {
  const result = normalizeContactFields({
    rawText: "Customer email: ben at example. Phone: 812-555-0134",
  });

  assert.equal(result.email.value, "");
  assert.equal(result.phone.display, "812-555-0134");
  assert.ok(result.low_confidence_spans.some((span) => span.field === "customer.email"));
  assert.match(result.low_confidence_spans.find((span) => span.field === "customer.email")?.reason || "", /Email label was present/);
});

test("invalid phone-like text is left empty and recorded as low confidence", () => {
  const result = normalizeContactFields({
    rawText: "Phone: 812-555. Email: ben@example.com",
  });

  assert.equal(result.email.value, "ben@example.com");
  assert.equal(result.phone.display, "");
  assert.ok(result.low_confidence_spans.some((span) => span.field === "customer.phone"));
  assert.match(result.low_confidence_spans.find((span) => span.field === "customer.phone")?.reason || "", /Phone label was present/);
});

test("multiple emails keep the first direct candidate", () => {
  const result = normalizeContactFields({
    rawText: "email first@example.com or second@example.com phone 8125550134",
  });

  assert.equal(result.email.value, "first@example.com");
  assert.match(result.email.warnings.join(" "), /multiple/i);
  assert.ok(result.email.candidates.length >= 2);
  assert.equal(result.email.candidates.filter((candidate) => candidate.accepted).length, 1);
});

test("route and highway numbers are not accepted as phone numbers", () => {
  const result = normalizeContactFields({
    rawText: "Customer phone missing. Service at 777 Highway 421 Madison IN. Remove one tree 1200.",
  });

  assert.equal(result.phone.display, "");
  assert.equal(result.phone.candidates.filter((candidate) => candidate.accepted).length, 0);
});

test("11-digit leading-1 phone numbers normalize", () => {
  const result = normalizeContactFields({
    rawText: "Phone 1-812-555-0134",
  });

  assert.equal(result.phone.display, "812-555-0134");
  assert.equal(result.phone.value, "8125550134");
});

test("dot slash and spaced phone formats normalize", () => {
  assert.equal(normalizeContactFields({ rawText: "Phone 812.555.0134" }).phone.display, "812-555-0134");
  assert.equal(normalizeContactFields({ rawText: "Phone 812/555/0134" }).phone.display, "812-555-0134");
  assert.equal(normalizeContactFields({ rawText: "Phone 812 555 0134" }).phone.display, "812-555-0134");
});

test("phone matcher does not take substrings from longer numbers", () => {
  const result = normalizeContactFields({
    rawText: "Customer id 991812555013477. ZIP 47250-1234. measurement 8125550134%.",
  });

  assert.equal(result.phone.display, "");
  assert.equal(result.phone.candidates.filter((candidate) => candidate.accepted).length, 0);
});

test("prices and percentages are not matched as phones", () => {
  const result = normalizeContactFields({
    rawText: "$8125550134 is a bad price note. 8125550134% is a bad percentage note.",
  });

  assert.equal(result.phone.display, "");
  assert.equal(result.phone.candidates.filter((candidate) => candidate.accepted).length, 0);
});

test("adjacent local town makes a complete address high confidence and supplies Indiana", () => {
  const result = normalizeContactFields({
    rawText: "John, 456 Main Madison, option A remove tree 1000",
  });
  const accepted = result.address.candidates.find((candidate) => candidate.accepted);

  assert.equal(result.address.value, "456 Main, Madison, Indiana");
  assert.equal(result.address.completeness, "complete");
  assert.equal(result.address.town, "Madison");
  assert.equal(result.address.state_source, "local_town_default");
  assert.equal(accepted.confidence, "high");
  assert.deepEqual(accepted.span, { start: 6, end: 22 });
});

test("explicit Indiana and inferred Indiana share high confidence but retain provenance", () => {
  const inferred = normalizeContactFields({ rawText: "117 Main Street Madison, remove oak" }).address;
  const explicit = normalizeContactFields({ rawText: "117 Main Street Madison IN, remove oak" }).address;

  assert.equal(inferred.candidates.find((candidate) => candidate.accepted).confidence, "high");
  assert.equal(explicit.candidates.find((candidate) => candidate.accepted).confidence, "high");
  assert.equal(inferred.state_source, "local_town_default");
  assert.equal(explicit.state_source, "explicit");
});

test("street-only address stays incomplete and does not receive a guessed town", () => {
  const result = normalizeContactFields({
    rawText: "John, 456 Main Street, option A remove tree 1000",
  });
  const accepted = result.address.candidates.find((candidate) => candidate.accepted);

  assert.equal(result.address.value, "456 Main Street");
  assert.equal(result.address.completeness, "town_missing");
  assert.equal(result.address.town, "");
  assert.equal(result.address.state_source, "missing");
  assert.equal(accepted.confidence, "medium");
});

test("town name elsewhere in the note does not complete a street-only address", () => {
  const result = normalizeContactFields({
    rawText: "John in Madison, service address 456 Main Street, remove oak",
  });

  assert.equal(result.address.value, "456 Main Street");
  assert.equal(result.address.completeness, "town_missing");
  assert.equal(result.address.candidates.find((candidate) => candidate.accepted).confidence, "medium");
});

test("numbered road is included only when followed by complete town evidence", () => {
  const complete = normalizeContactFields({
    rawText: "Customer, 456 County Road 250 Hanover, remove oak",
  }).address;
  const priceAfterRoad = normalizeContactFields({
    rawText: "Customer, 456 County Road 2500 option A remove oak",
  }).address;

  assert.equal(complete.value, "456 County Road 250, Hanover, Indiana");
  assert.equal(complete.candidates.find((candidate) => candidate.accepted).confidence, "high");
  assert.equal(priceAfterRoad.value, "456 County Road");
  assert.equal(priceAfterRoad.completeness, "town_missing");
});

test("numbered highway keeps its route number before every listed local town", () => {
  for (const town of LOCAL_INDIANA_TOWNS) {
    const address = normalizeContactFields({
      rawText: `Customer, 456 Highway 421 ${town}, remove oak`,
    }).address;

    assert.equal(address.value, `456 Highway 421, ${town}, Indiana`, town);
    assert.equal(address.completeness, "complete", town);
    assert.equal(address.candidates.find((candidate) => candidate.accepted).confidence, "high", town);
  }

  const noTown = normalizeContactFields({
    rawText: "Customer, 456 Highway 421 option A remove oak 1000",
  }).address;

  assert.equal(noTown.value, "456 Highway");
  assert.equal(noTown.completeness, "town_missing");
});

test("contact-only fixture suite tracks current direct detection behavior", () => {
  const failures = [];

  for (const fixture of contactNormalizerFixtures) {
    const result = normalizeContactFields({
      rawText: fixture.rawText,
      intake: fixture.intake || {},
    });
    const actual = {
      email: result.email.value,
      phone: result.phone.display,
    };
    const lowConfidenceFields = new Set((result.low_confidence_spans || []).map((span) => span.field));
    const warningsText = [
      ...(result.email.warnings || []),
      ...(result.phone.warnings || []),
    ].join(" ");

    if (actual.email !== fixture.expected.email) {
      failures.push(`${fixture.id}: email expected ${fixture.expected.email || "<empty>"} got ${actual.email || "<empty>"}`);
    }
    if (actual.phone !== fixture.expected.phone) {
      failures.push(`${fixture.id}: phone expected ${fixture.expected.phone || "<empty>"} got ${actual.phone || "<empty>"}`);
    }
    for (const field of fixture.expectedLowConfidenceFields || []) {
      if (!lowConfidenceFields.has(field)) failures.push(`${fixture.id}: missing low-confidence field ${field}`);
    }
    for (const fragment of fixture.expectedWarningFragments || []) {
      if (!new RegExp(fragment, "i").test(warningsText)) failures.push(`${fixture.id}: missing warning fragment ${fragment}`);
    }
  }

  assert.deepEqual(failures, []);
});
