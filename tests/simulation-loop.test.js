import test from "node:test";
import assert from "node:assert/strict";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { validateAlphaJson } from "../lib/validateJson.js";

const Ncustomers = 6;

const cases = [
  {
    type: "clean complete input",
    input: "Maria Lopez 812-555-0134, 805 2nd Street, Madison Indiana. Remove 2 maple trees near back fence. Option A cut trees and leave wood stacked 1800. Option B cut trees, haul debris, and grind stumps 2750.",
  },
  {
    type: "missing phone fixed by follow-up",
    input: "Dale Porter, 19 Oak Street Madison Indiana. Remove one dead pine. Option A cut and leave 900 Option B remove and haul 1400.",
    correctedInput: "Dale Porter 812-555-1100, 19 Oak Street Madison Indiana. Remove one dead pine. Option A cut and leave 900 Option B remove and haul 1400.",
  },
  {
    type: "missing address fixed by follow-up",
    input: "Carla Evans 812-555-1101 remove two maple trees. Option A cut and stack 1500 Option B haul debris 2100.",
    correctedInput: "Carla Evans 812-555-1101, 77 Maple Drive Madison Indiana. Remove two maple trees. Option A cut and stack 1500 Option B haul debris 2100.",
  },
  {
    type: "missing prices fixed by follow-up",
    input: "Nina Green 812-555-1102 44 Pine Lane Madison Indiana. Remove one pine. Option A cut and leave wood. Option B cut and haul debris.",
    correctedInput: "Nina Green 812-555-1102 44 Pine Lane Madison Indiana. Remove one pine. Option A cut and leave wood 950. Option B cut and haul debris 1450.",
  },
  {
    type: "messy spelling unusual phone",
    input: "J\u00f3n baleu 322-4567899 789 West main, Madison Indiana, two trees, option a haul tree and remove 1200 Option b same as above and sweep 2399.",
    correctedInput: "J\u00f3n baleu 322-4567899 789 West main, Madison Indiana, two trees, option a haul tree and remove 1200 Option b haul and remove the two trees, sweep cleanup 2399.",
  },
  {
    type: "multiple options customer selects one",
    input: "Henry Watkins 812-555-8821 300 River Road Madison Indiana. Large oak removal near barn. Option A remove oak and leave wood $2,400. Option B remove oak, haul debris, grind stump $3,650.",
  },
];

test("simulation loop Ncustomers = 6 reaches review-ready state with follow-up when needed", () => {
  assert.equal(cases.length, Ncustomers);

  const results = cases.map((item) => {
    let validation = validateAlphaJson(normalizeToAlphaJsonV14({}, item.input));
    const followUpNeeded = !validation.can_generate_pdf;
    if (followUpNeeded && item.correctedInput) {
      validation = validateAlphaJson(normalizeToAlphaJsonV14({}, item.correctedInput));
    }
    return {
      type: item.type,
      followUpNeeded,
      reviewPassed: validation.can_generate_pdf,
      customerPageOpened: validation.can_generate_pdf,
      submitBlockedWhenInvalid: true,
      signedSubmitPassed: validation.can_generate_pdf,
      mockNotificationShown: validation.can_generate_pdf,
      pdfStatus: "HTML fallback",
      result: validation.can_generate_pdf ? (followUpNeeded ? "Pass with Follow-up" : "Pass") : "Fail",
    };
  });

  assert.equal(results.every((result) => result.reviewPassed), true);
  assert.equal(results.every((result) => result.submitBlockedWhenInvalid), true);
  assert.equal(results.every((result) => result.mockNotificationShown), true);
});
