import test from "node:test";
import assert from "node:assert/strict";
import { validateClaimGraph, clearClientClaimGraph } from "../lib/claimGraph.js";
import { buildClaimGraphFromRaw, detectClaimRelationships } from "../lib/detectClaimRelationships.js";
import { extractClaimsFromRaw } from "../lib/extractClaims.js";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { applyTrustedRouteValidationEvidence } from "../lib/validateRoutePayload.js";
import { buildDebugPipelinePayload } from "../lib/debugPipeline.js";
import { attachPipelineClaimGraph, attachPipelineDecisionEnvelopes } from "../lib/attachPipelineDecisionEnvelopes.js";

const CORRECTION_NOTES = [
  "Remove two oaks by the garage.",
  "Actually, only remove the rear oak.",
  "Quote $1,800 without stump grinding or $2,200 with stump grinding.",
].join("\n");

function scopeEdge(graph, type) {
  return graph.relationships.find((rel) =>
    rel.type === type && /^scope-/.test(rel.from) && /^scope-/.test(rel.to),
  );
}

function assertNoSupersessionOrNarrowing(graph) {
  assert.equal(graph.relationships.filter((rel) => rel.type === "supersedes").length, 0);
  assert.equal(graph.relationships.filter((rel) => rel.type === "narrows").length, 0);
}

test("oak correction example: later scope supersedes earlier with correction marker", () => {
  const graph = buildClaimGraphFromRaw(CORRECTION_NOTES);
  const validation = validateClaimGraph(graph);
  assert.equal(validation.ok, true, validation.errors.join("; "));

  assert.ok(graph.claims.some((claim) => claim.id === "scope-1" && /two oaks/i.test(claim.evidence)));
  assert.ok(graph.claims.some((claim) => claim.id === "scope-2" && /rear oak/i.test(claim.evidence)));

  const edge = graph.relationships.find((rel) => rel.from === "scope-2" && rel.to === "scope-1");
  assert.ok(edge, "expected scope-2 -> scope-1 relationship");
  assert.equal(edge.type, "supersedes");
  assert.equal(edge.reason, "explicit_correction_marker");
  assert.equal(edge.confidence, "confirmed");
  assert.ok(edge.signals.includes("correction_marker"));
  assert.ok(edge.signals.includes("document_order"));
});

test("opinion filler 'I actually think' does not supersede", () => {
  const graph = buildClaimGraphFromRaw(
    "Remove one oak. I actually think both trees should come down.",
  );
  assert.ok(graph.claims.length >= 2, "expected both claims extracted");
  assertNoSupersessionOrNarrowing(graph);
});

test("opinion fillers believe/feel/prefer/want do not supersede", () => {
  const fillers = ["believe", "feel", "prefer", "want"];
  for (const filler of fillers) {
    const graph = buildClaimGraphFromRaw(
      `Remove one oak. I actually ${filler} both trees should come down.`,
    );
    assert.ok(graph.claims.length >= 2, `expected claims for filler ${filler}`);
    assert.equal(
      graph.relationships.filter((rel) => rel.type === "supersedes").length,
      0,
      `filler ${filler} should not supersede`,
    );
  }
});

test("bare 'actually' substring alone is not enough without revision semantics", () => {
  // Opinion sentence contains "actually" but must not create supersession.
  const graph = buildClaimGraphFromRaw(
    "Remove the rear oak. I actually think both trees should come down.",
  );
  assert.equal(graph.relationships.filter((rel) => rel.type === "supersedes").length, 0);
});

test("with/without stump prices are alternatives, not conflicts", () => {
  const graph = buildClaimGraphFromRaw(CORRECTION_NOTES);
  const priceEdge = graph.relationships.find((rel) =>
    rel.type === "alternative_to"
    && /^price-/.test(rel.from)
    && /^price-/.test(rel.to),
  );
  assert.ok(priceEdge, "expected alternative_to between prices");
  assert.equal(priceEdge.confidence, "confirmed");
  assert.ok(
    priceEdge.signals.includes("with_without_pair") || priceEdge.signals.includes("option_or"),
  );
  assert.equal(
    graph.relationships.filter((rel) => rel.type === "contradicts" && /^price-/.test(rel.from)).length,
    0,
  );
});

test("or-linked prices without with/without are still alternatives", () => {
  const graph = buildClaimGraphFromRaw("Option A $1,200 or Option B $1,500.");
  const edge = graph.relationships.find((rel) => rel.type === "alternative_to");
  assert.ok(edge);
  assert.equal(edge.reason, "or_linked_price_options");
  assert.equal(edge.confidence, "confirmed");
});

test("distinct prices without option cue contradict with needs_review", () => {
  const graph = buildClaimGraphFromRaw("Quote $1,800. Later quote $2,200.");
  const edge = graph.relationships.find((rel) => rel.type === "contradicts");
  assert.ok(edge);
  assert.equal(edge.reason, "distinct_prices_no_option_cue");
  assert.equal(edge.confidence, "needs_review");
});

test("same price amounts are duplicates", () => {
  const graph = buildClaimGraphFromRaw("Quote $1800. Price $1,800.");
  const edge = graph.relationships.find((rel) => rel.type === "duplicates");
  assert.ok(edge);
  assert.equal(edge.reason, "same_price_amount");
  assert.equal(edge.confidence, "confirmed");
});

test("phone format variants are duplicates", () => {
  const graph = buildClaimGraphFromRaw("Call 555-123-4567 or (555) 123-4567");
  assert.equal(graph.claims.filter((claim) => claim.field === "customer.phone").length, 2);
  const edge = graph.relationships.find((rel) => rel.type === "duplicates");
  assert.ok(edge);
  assert.equal(edge.reason, "normalized_phone_equivalent");
  assert.equal(edge.confidence, "confirmed");
});

test("plus-one and dotted phones normalize as duplicates", () => {
  const graph = buildClaimGraphFromRaw("Call +1 555-123-4567. Also 555.123.4567.");
  const edge = graph.relationships.find((rel) => rel.type === "duplicates");
  assert.ok(edge);
  assert.equal(edge.confidence, "confirmed");
});

test("distinct phones contradict with needs_review", () => {
  const graph = buildClaimGraphFromRaw("Call 555-123-4567 or 555-999-8888");
  const edge = graph.relationships.find((rel) => rel.type === "contradicts");
  assert.ok(edge);
  assert.equal(edge.reason, "distinct_phones_no_correction_cue");
  assert.equal(edge.confidence, "needs_review");
});

test("two addresses without correction cue contradict", () => {
  const graph = buildClaimGraphFromRaw(
    "Job at 123 Main Street. Also listed 456 Oak Avenue.",
  );
  const edge = graph.relationships.find((rel) => rel.type === "contradicts");
  assert.ok(edge);
  assert.equal(edge.reason, "distinct_addresses_no_correction_cue");
  assert.equal(edge.confidence, "confirmed");
});

test("address format variants are duplicates", () => {
  const graph = buildClaimGraphFromRaw("Job at 123 Main Street. Service at 123 Main St.");
  const edge = graph.relationships.find((rel) => rel.type === "duplicates");
  assert.ok(edge);
  assert.equal(edge.reason, "normalized_address_equivalent");
  assert.equal(edge.confidence, "confirmed");
});

test("address with correction cue supersedes", () => {
  const graph = buildClaimGraphFromRaw("Job at 123 Main Street. Actually, 456 Oak Avenue.");
  const edge = graph.relationships.find((rel) => rel.type === "supersedes");
  assert.ok(edge);
  assert.equal(edge.reason, "explicit_correction_marker");
  assert.equal(edge.confidence, "confirmed");
});

test("remove oak plus leave maple is excludes", () => {
  const graph = buildClaimGraphFromRaw("Remove the oak. Leave the maple.");
  const edge = graph.relationships.find((rel) => rel.type === "excludes");
  assert.ok(edge);
  assert.equal(edge.reason, "leave_exclusion");
  assert.equal(edge.confidence, "confirmed");
  assert.match(edge.from, /^scope-/);
  assert.match(edge.to, /^scope-/);
});

test("don't remove and keep produce excludes", () => {
  const dont = buildClaimGraphFromRaw("Remove the oak. Don't remove the maple.");
  assert.ok(scopeEdge(dont, "excludes"));

  const keep = buildClaimGraphFromRaw("Remove the oak. Keep the pine.");
  assert.ok(scopeEdge(keep, "excludes"));
});

test("only/just without correction marker narrows plural to singular", () => {
  const onlyGraph = buildClaimGraphFromRaw("Remove two oaks. Only remove the rear oak.");
  const onlyEdge = scopeEdge(onlyGraph, "narrows");
  assert.ok(onlyEdge);
  assert.equal(onlyEdge.reason, "scope_restriction_singular");
  assert.equal(onlyEdge.confidence, "confirmed");
  assert.ok(onlyEdge.signals.includes("scope_restriction"));
  assert.ok(onlyEdge.signals.includes("plural_to_singular"));

  const justGraph = buildClaimGraphFromRaw("Remove two oaks. Just remove the rear oak.");
  const justEdge = scopeEdge(justGraph, "narrows");
  assert.ok(justEdge);
  assert.equal(justEdge.confidence, "confirmed");
});

test("instead / make that / scratch that correction markers supersede", () => {
  const instead = buildClaimGraphFromRaw("Remove two maples. Instead remove the front maple.");
  assert.equal(scopeEdge(instead, "supersedes")?.reason, "explicit_correction_marker");

  const makeThat = buildClaimGraphFromRaw("Remove three pines. Make that one pine.");
  assert.equal(scopeEdge(makeThat, "supersedes")?.reason, "explicit_correction_marker");

  const scratch = buildClaimGraphFromRaw("Remove two elms. Scratch that, remove the side elm.");
  assert.equal(scopeEdge(scratch, "supersedes")?.reason, "explicit_correction_marker");
});

test("unrelated species mentions are not linked", () => {
  const graph = buildClaimGraphFromRaw("Remove the oak. Remove the maple.");
  assert.equal(graph.claims.length, 2);
  assert.equal(graph.relationships.length, 0);
});

test("same-species conflict without cue is needs_review contradicts", () => {
  const graph = buildClaimGraphFromRaw(
    "Remove two oaks by the garage. Remove three oaks near the fence.",
  );
  const edge = scopeEdge(graph, "contradicts");
  assert.ok(edge);
  assert.equal(edge.reason, "same_field_distinct_values_no_cue");
  assert.equal(edge.confidence, "needs_review");
});

test("singular to plural with an expansion cue expands with confirmed confidence", () => {
  const graph = buildClaimGraphFromRaw("Remove the oak. Also remove two oaks by the fence.");
  const edge = scopeEdge(graph, "expands");
  assert.ok(edge);
  assert.equal(edge.reason, "scope_expansion_marker");
  assert.equal(edge.confidence, "confirmed");
  assert.ok(edge.signals.includes("expansion_marker"));
  assert.ok(edge.signals.includes("singular_to_plural"));
});

test("singular to plural without an expansion cue is needs_review expands", () => {
  const graph = buildClaimGraphFromRaw("Remove the oak. Remove two oaks by the fence.");
  const edge = scopeEdge(graph, "expands");
  assert.ok(edge);
  assert.equal(edge.reason, "singular_to_plural_same_entity");
  assert.equal(edge.confidence, "needs_review");
});

test("same singular entity with an added descriptive detail qualifies rather than contradicts", () => {
  const rawText = "Remove the oak. It's the one near the fence, out back.";
  const earlier = { id: "scope-1", field: "job.target_trees", value: ["oak"], evidence: "Remove the oak", start: 0, end: 15 };
  const later = { id: "scope-2", field: "job.target_trees", value: ["oak"], evidence: "It's the one near the fence, out back", start: 17, end: 55 };
  const relationships = detectClaimRelationships([earlier, later], rawText);
  const edge = relationships.find((rel) => rel.type === "qualifies");
  assert.ok(edge, "expected a qualifies relationship");
  assert.equal(edge.from, "scope-2");
  assert.equal(edge.to, "scope-1");
  assert.equal(edge.reason, "same_entity_additional_detail");
  assert.equal(edge.confidence, "needs_review");
  assert.ok(edge.signals.includes("qualifier_detail"));
});

test("plural to singular without only/just is needs_review narrows", () => {
  const graph = buildClaimGraphFromRaw("Remove two oaks. Remove the rear oak.");
  const edge = scopeEdge(graph, "narrows");
  assert.ok(edge);
  assert.equal(edge.reason, "plural_to_singular_same_entity");
  assert.equal(edge.confidence, "needs_review");
});

test("document order: later claim revises earlier, never the reverse", () => {
  const graph = buildClaimGraphFromRaw(
    "Remove two oaks by the garage. Actually, only remove the rear oak.",
  );
  const edge = scopeEdge(graph, "supersedes");
  assert.ok(edge);
  assert.equal(edge.from, "scope-2");
  assert.equal(edge.to, "scope-1");
  assert.ok((graph.claims.find((c) => c.id === edge.from).start)
    > (graph.claims.find((c) => c.id === edge.to).start));
});

test("overlapping nested remove phrases collapse to one restricted claim", () => {
  const claims = extractClaimsFromRaw("Actually, only remove the rear oak.");
  const scopeClaims = claims.filter((claim) => claim.field === "job.target_trees");
  assert.equal(scopeClaims.length, 1);
  assert.match(scopeClaims[0].evidence, /actually.*only remove the rear oak/i);
});

test("empty and whitespace input yield empty graph", () => {
  for (const input of ["", "   ", "\n\t"]) {
    const graph = buildClaimGraphFromRaw(input);
    assert.deepEqual(graph.claims, []);
    assert.deepEqual(graph.relationships, []);
    assert.equal(validateClaimGraph(graph).ok, true);
  }
});

test("cross-field claims do not create relationships", () => {
  const graph = buildClaimGraphFromRaw(
    "Remove two oaks. Call 555-123-4567. Quote $1,800. Job at 123 Main Street.",
  );
  assert.ok(graph.claims.some((claim) => claim.field === "job.target_trees"));
  assert.ok(graph.claims.some((claim) => claim.field === "customer.phone"));
  assert.ok(graph.claims.some((claim) => claim.field === "job.price"));
  assert.ok(graph.claims.some((claim) => claim.field === "customer.address"));
  assert.equal(graph.relationships.length, 0);
});

test("normalize applies the claim_graph tree_count winner", () => {
  const alphaJson = normalizeToAlphaJsonV14({}, CORRECTION_NOTES, {});
  assert.equal(alphaJson.job.tree_details.tree_count, "1 tree");
  const graph = alphaJson.normalization.claim_graph;
  assert.ok(graph);
  assert.equal(validateClaimGraph(graph).ok, true);
  assert.ok(graph.relationships.some((rel) => rel.type === "supersedes"));
});

test("trusted route validation clears client claim_graph and recomputes", () => {
  const alphaJson = normalizeToAlphaJsonV14({}, CORRECTION_NOTES, {});
  alphaJson.normalization.claim_graph = {
    claims: [{ id: "fake", field: "x", value: 1, evidence: "fake" }],
    relationships: [{
      from: "fake",
      to: "fake",
      type: "duplicates",
      reason: "client",
      confidence: "confirmed",
    }],
  };

  applyTrustedRouteValidationEvidence(alphaJson, { rawInput: CORRECTION_NOTES, intake: {} });
  const graph = alphaJson.normalization.claim_graph;
  assert.ok(graph);
  assert.ok(graph.claims.every((claim) => claim.id !== "fake"));
  assert.ok(graph.relationships.some((rel) => rel.type === "supersedes" || rel.type === "alternative_to"));
});

test("debug pipeline surfaces claimGraph", () => {
  const alphaJson = normalizeToAlphaJsonV14({}, CORRECTION_NOTES, {});
  const payload = buildDebugPipelinePayload({
    enabled: true,
    rawTd1Text: CORRECTION_NOTES,
    alphaJson,
  });
  assert.ok(payload.debugPipeline.claimGraph);
  assert.ok(Array.isArray(payload.debugPipeline.claimGraph.relationships));
});

test("debug pipeline omits claimGraph when disabled or missing", () => {
  const disabled = buildDebugPipelinePayload({
    enabled: false,
    alphaJson: { normalization: { claim_graph: { claims: [], relationships: [] } } },
  });
  assert.deepEqual(disabled, {});

  const missing = buildDebugPipelinePayload({
    enabled: true,
    alphaJson: { normalization: {} },
  });
  assert.equal(missing.debugPipeline.claimGraph, undefined);
});

test("extractClaimsFromRaw returns ordered claims across fields", () => {
  const claims = extractClaimsFromRaw(CORRECTION_NOTES);
  assert.ok(claims.some((claim) => claim.field === "job.target_trees"));
  assert.ok(claims.some((claim) => claim.field === "job.price"));
  for (let i = 1; i < claims.length; i += 1) {
    assert.ok((claims[i].start ?? 0) >= (claims[i - 1].start ?? 0));
  }
});

test("detectClaimRelationships is a pure function over claims", () => {
  const claims = extractClaimsFromRaw("Call 555-123-4567. Also 555.123.4567");
  const relationships = detectClaimRelationships(claims, "Call 555-123-4567. Also 555.123.4567");
  assert.ok(relationships.some((rel) => rel.type === "duplicates"));
});

test("detectClaimRelationships handles empty/null claims safely", () => {
  assert.deepEqual(detectClaimRelationships([]), []);
  assert.deepEqual(detectClaimRelationships(null), []);
  assert.deepEqual(detectClaimRelationships(undefined), []);
});

test("attachPipelineClaimGraph rebuilds from raw_input", () => {
  const alphaJson = {
    raw_input: { customer_text: CORRECTION_NOTES },
    normalization: {},
  };
  attachPipelineClaimGraph(alphaJson);
  assert.ok(alphaJson.normalization.claim_graph.relationships.some((rel) => rel.type === "supersedes"));
});

test("attachPipelineDecisionEnvelopes attaches claim graph alongside envelopes", () => {
  const alphaJson = normalizeToAlphaJsonV14({}, CORRECTION_NOTES, {});
  delete alphaJson.normalization.claim_graph;
  attachPipelineDecisionEnvelopes(alphaJson, null, CORRECTION_NOTES);
  assert.ok(alphaJson.normalization.claim_graph);
  assert.equal(validateClaimGraph(alphaJson.normalization.claim_graph).ok, true);
});

test("clearClientClaimGraph removes only the graph", () => {
  const alphaJson = {
    normalization: {
      claim_graph: { claims: [], relationships: [] },
      decisions: { phone: { field: "customer.phone" } },
    },
  };
  clearClientClaimGraph(alphaJson);
  assert.equal(alphaJson.normalization.claim_graph, undefined);
  assert.ok(alphaJson.normalization.decisions.phone);
});
