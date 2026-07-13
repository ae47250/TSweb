import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  annotateTreeServiceText,
  classifyTreeServiceScope,
  TREE_SERVICE_LEXICON,
  TREE_SERVICE_LEXICON_ID,
  TREE_SERVICE_LEXICON_INDEXES,
  TREE_SERVICE_LEXICON_VERSION,
  TREE_SERVICE_PATTERNS,
  TREE_SERVICE_PATTERN_SOURCES,
  validateTreeServiceLexicon,
} from "../lib/treeServiceLexicon.js";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";

function hasExpectedMatch(result, expected) {
  return result.matches.some((match) =>
    match.concept_id === expected.concept_id &&
    match.polarity === expected.polarity &&
    (!expected.match_type || match.match_type === expected.match_type),
  );
}

function hasExpectedScopeItem(result, expected) {
  return result.scope_items.some((item) => {
    if (item.service_concept_id !== expected.service_concept_id) return false;
    if (item.polarity !== expected.polarity) return false;
    for (const conceptId of expected.object_concept_ids || []) {
      if (!item.object_concept_ids?.includes(conceptId)) return false;
    }
    for (const conceptId of expected.target_concept_ids || []) {
      if (!item.target_concept_ids?.includes(conceptId)) return false;
    }
    return true;
  });
}

const CLASSIFICATION_FIXTURE_PATH = "tests/fixtures/tree-dude-service-classification-60.json";

test("tree service lexicon validates at startup and exposes versioned source data", () => {
  assert.deepEqual(validateTreeServiceLexicon(), []);
  assert.equal(TREE_SERVICE_LEXICON.lexicon.id, TREE_SERVICE_LEXICON_ID);
  assert.equal(TREE_SERVICE_LEXICON.lexicon.version, TREE_SERVICE_LEXICON_VERSION);
  assert.equal(TREE_SERVICE_LEXICON.lexicon.intended_source_of_truth, true);
  assert.equal(TREE_SERVICE_LEXICON.service_kind_crosswalk["service.pruning"], "tree_trim");
  assert.equal(TREE_SERVICE_LEXICON.service_kind_crosswalk["service.stump_grinding"], "stump_grinding");
  assert.equal(TREE_SERVICE_LEXICON.service_kind_crosswalk["service.stump_removal"], "other_supported_service");
});

test("runtime phrase index is generated longest-first from source concepts", () => {
  const phrases = TREE_SERVICE_LEXICON_INDEXES.phrases_longest_first.map((entry) => entry.phrase);
  assert.ok(phrases.indexOf("stump grinding") < phrases.indexOf("stumping"));
  assert.ok(phrases.indexOf("tree removal") < phrases.indexOf("remove"));
  assert.match(TREE_SERVICE_PATTERN_SOURCES.workScope, /stump\\s\+grinding|stump/);
});

for (const example of TREE_SERVICE_LEXICON.acceptance_examples) {
  test(`lexicon acceptance example: ${example.id}`, () => {
    const result = annotateTreeServiceText(example.input);

    if (example.expected.must_preserve_raw_text) {
      assert.equal(result.raw_text, example.input);
    }

    for (const expected of example.expected.matches || []) {
      assert.ok(hasExpectedMatch(result, expected), `${example.id} missing ${JSON.stringify(expected)} in ${JSON.stringify(result.matches)}`);
    }

    for (const expected of example.expected.scope_items || []) {
      assert.ok(hasExpectedScopeItem(result, expected), `${example.id} missing scope item ${JSON.stringify(expected)} in ${JSON.stringify(result.scope_items)}`);
    }

    for (const flag of example.expected.routing_flags || []) {
      assert.ok(result.routing_flags.includes(flag), `${example.id} missing routing flag ${flag}`);
    }

    for (const warning of example.expected.warnings || []) {
      assert.ok(result.warnings.includes(warning), `${example.id} missing warning ${warning}`);
    }

    for (const conceptId of example.expected.must_not_emit_without_other_evidence || []) {
      assert.equal(result.matches.some((match) => match.concept_id === conceptId), false);
    }

    for (const blocked of example.expected.must_not_normalize || []) {
      assert.match(result.raw_text, new RegExp(`\\b${blocked.surface}\\b`, "i"));
      assert.equal(
        result.matches.some((match) =>
          match.raw_span.toLowerCase() === blocked.surface.toLowerCase() &&
          match.evidence?.candidate?.toLowerCase() === blocked.to.toLowerCase(),
        ),
        false,
      );
    }
  });
}

test("AlphaJSON normalization carries observable lexicon annotation without replacing raw input", () => {
  const raw = "Top it off and make it half as tall. Phone 812-555-1212.";
  const alphaJson = normalizeToAlphaJsonV14({}, raw);
  const annotation = alphaJson.normalization.tree_service_lexicon;

  assert.equal(alphaJson.raw_input.customer_text, raw);
  assert.equal(annotation.lexicon_id, TREE_SERVICE_LEXICON_ID);
  assert.equal(annotation.lexicon_version, TREE_SERVICE_LEXICON_VERSION);
  assert.ok(annotation.matches.some((match) => match.concept_id === "practice.topping"));
  assert.ok(annotation.routing_flags.includes("non_standard_practice_review"));
});

test("expanded lexicon captures access and difficulty signals without changing raw text", () => {
  const raw = "Large pine in fenced backyard, tight gate, nowhere to drop it, over the house, down in the holler.";
  const annotation = annotateTreeServiceText(raw);
  const conceptIds = annotation.matches.map((match) => match.concept_id);

  assert.equal(annotation.raw_text, raw);
  assert.ok(conceptIds.includes("species.pine"));
  assert.ok(conceptIds.includes("access.limited_access"));
  assert.ok(conceptIds.includes("access.no_drop_zone"));
  assert.ok(conceptIds.includes("access.slope_or_remote_site"));
  assert.ok(annotation.routing_flags.includes("access_review"));
  assert.match(TREE_SERVICE_PATTERN_SOURCES.accessDifficulty, /tight\\s\+gate|nowhere\\s\+to\\s\+drop\\s\+it/);
});

test("expanded lexicon captures condition and risk signals", () => {
  const annotation = annotateTreeServiceText("Hollow storm damaged pine is leaning with a dead top and cracked trunk.");
  const conceptIds = annotation.matches.map((match) => match.concept_id);

  assert.ok(conceptIds.includes("condition.decay_or_hollow"));
  assert.ok(conceptIds.includes("condition.storm_damaged"));
  assert.ok(conceptIds.includes("condition.leaning"));
  assert.ok(conceptIds.includes("condition.dead_top"));
  assert.ok(conceptIds.includes("condition.cracked_or_split"));
  assert.ok(conceptIds.includes("species.pine"));
  assert.ok(TREE_SERVICE_PATTERNS.conditionRisk.test("punky hollow trunk"));
});

test("expanded lexicon captures common regional species", () => {
  const annotation = annotateTreeServiceText("Remove sycamore, hickory, beech, elm, cherry, Bradford pear, dogwood, locust, and sweetgum.");
  const conceptIds = annotation.matches.map((match) => match.concept_id);

  for (const conceptId of [
    "species.sycamore",
    "species.hickory",
    "species.beech",
    "species.elm",
    "species.cherry",
    "species.bradford_pear",
    "species.dogwood",
    "species.locust",
    "species.sweetgum",
  ]) {
    assert.ok(conceptIds.includes(conceptId), `missing ${conceptId}`);
  }
});

test("expanded lexicon captures option and price-role cue words as annotations", () => {
  const annotation = annotateTreeServiceText("Option A basic drop only 900. Option B full cleanup included plus stump grind extra 400.");
  const conceptIds = annotation.matches.map((match) => match.concept_id);

  assert.ok(conceptIds.includes("price_cue.option_label"));
  assert.ok(conceptIds.includes("price_cue.tiered_option"));
  assert.ok(conceptIds.includes("price_cue.excluded_or_limited_scope"));
  assert.ok(conceptIds.includes("price_cue.included_scope"));
  assert.ok(conceptIds.includes("price_cue.incremental_addon"));
  assert.ok(conceptIds.includes("service.stump_grinding"));
  assert.ok(TREE_SERVICE_PATTERNS.priceCue.test("plus stump grind extra"));
});

test("shared classifier keeps the frozen 60-note service categories conservative", () => {
  const fixtures = JSON.parse(fs.readFileSync(CLASSIFICATION_FIXTURE_PATH, "utf8"));
  assert.equal(fixtures.length, 60);
  assert.deepEqual(
    Object.fromEntries([...new Set(fixtures.map((fixture) => fixture.category))]
      .map((category) => [category, fixtures.filter((fixture) => fixture.category === category).length])),
    {
      straightforward_base: 15,
      clear_dependent_addon: 15,
      explicit_option_totals: 10,
      independent_alternatives: 10,
      ambiguous_review: 10,
    },
  );

  for (const fixture of fixtures) {
    const actual = classifyTreeServiceScope(fixture.raw_service_phrase);
    for (const expectedKind of fixture.expected.service_kinds) {
      assert.ok(
        actual.candidate_kinds.includes(expectedKind),
        `${fixture.id}: missing ${expectedKind}; got ${actual.candidate_kinds.join(", ")}`,
      );
    }

    if (fixture.category === "straightforward_base") {
      assert.equal(actual.relationship_role, "base_service", fixture.id);
      assert.equal(actual.review_required, false, fixture.id);
    }
    if (fixture.category === "clear_dependent_addon" || fixture.category === "explicit_option_totals") {
      assert.equal(actual.relationship_role, "base_with_dependent_addon", fixture.id);
      assert.equal(actual.review_required, false, fixture.id);
      assert.equal(actual.price_role_hint, fixture.expected.option_b_price_role, fixture.id);
    }
    if (fixture.category === "independent_alternatives") {
      assert.equal(actual.relationship_role, "independent_alternative", fixture.id);
      assert.equal(actual.review_required, true, fixture.id);
    }
    if (fixture.category === "ambiguous_review") {
      assert.equal(actual.review_required, true, fixture.id);
    }
  }
});

test("shared classifier exposes nested service concepts inside price cue phrases", () => {
  const actual = classifyTreeServiceScope("Option B tree removal with stump grinding extra 500");

  assert.deepEqual(actual.base_service_kinds, ["tree_removal"]);
  assert.deepEqual(actual.addon_service_kinds, ["stump_grinding"]);
  assert.equal(actual.relationship_role, "base_with_dependent_addon");
  assert.equal(actual.price_role_hint, "incremental_addon");
  assert.equal(actual.review_required, false);
});
