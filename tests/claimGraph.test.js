import test from "node:test";
import assert from "node:assert/strict";
import {
  CLAIM_CONFIDENCES,
  CLAIM_RELATIONSHIP_TYPES,
  CLAIM_SOURCES,
  attachClaimGraph,
  clearClientClaimGraph,
  createClaim,
  createClaimGraph,
  createRelationship,
  validateClaimGraph,
} from "../lib/claimGraph.js";

test("createClaim and createRelationship produce valid graph", () => {
  const claims = [
    createClaim({
      id: "scope-1",
      field: "job.target_trees",
      value: ["oak_1", "oak_2"],
      evidence: "Remove two oaks by the garage",
      start: 0,
      end: 29,
    }),
    createClaim({
      id: "scope-2",
      field: "job.target_trees",
      value: ["rear_oak"],
      evidence: "Actually, only remove the rear oak",
      start: 30,
      end: 64,
    }),
  ];
  const relationships = [
    createRelationship({
      from: "scope-2",
      to: "scope-1",
      type: "supersedes",
      reason: "explicit_correction_marker",
      confidence: "confirmed",
      signals: ["correction_marker"],
    }),
  ];
  const graph = createClaimGraph({ claims, relationships });
  const validation = validateClaimGraph(graph);
  assert.equal(validation.ok, true, validation.errors.join("; "));
});

test("all ClaimRelationship types are accepted by validateClaimGraph", () => {
  const claims = CLAIM_RELATIONSHIP_TYPES.map((type, index) => createClaim({
    id: `c-${index}`,
    field: "job.target_trees",
    value: index,
    evidence: `evidence ${type}`,
  }));
  const relationships = CLAIM_RELATIONSHIP_TYPES.map((type, index) => createRelationship({
    from: `c-${index}`,
    to: `c-${Math.max(0, index - 1)}`,
    type,
    reason: `reason_${type}`,
    confidence: CLAIM_CONFIDENCES[index % CLAIM_CONFIDENCES.length],
  }));
  const validation = validateClaimGraph(createClaimGraph({ claims, relationships }));
  assert.equal(validation.ok, true, validation.errors.join("; "));
});

test("all claim sources and confidences are accepted", () => {
  const claims = CLAIM_SOURCES.map((source, index) => createClaim({
    id: `s-${index}`,
    field: "customer.phone",
    value: index,
    evidence: `phone ${index}`,
    source,
  }));
  const relationships = CLAIM_CONFIDENCES.map((confidence, index) => createRelationship({
    from: `s-${index}`,
    to: "s-0",
    type: "duplicates",
    reason: "normalized_phone_equivalent",
    confidence,
  }));
  const validation = validateClaimGraph(createClaimGraph({ claims, relationships }));
  assert.equal(validation.ok, true, validation.errors.join("; "));
});

test("validateClaimGraph rejects unknown relationship types and dangling ids", () => {
  const graph = createClaimGraph({
    claims: [
      createClaim({
        id: "a",
        field: "customer.phone",
        value: "555",
        evidence: "555-123-4567",
      }),
    ],
    relationships: [
      createRelationship({
        from: "missing",
        to: "a",
        type: "duplicates",
        reason: "test",
        confidence: "confirmed",
      }),
      {
        from: "a",
        to: "a",
        type: "not_a_real_type",
        reason: "bad",
        confidence: "confirmed",
      },
    ],
  });
  const validation = validateClaimGraph(graph);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => /from must match/.test(error)));
  assert.ok(validation.errors.some((error) => /type is invalid/.test(error)));
});

test("validateClaimGraph rejects missing fields, duplicate ids, and bad confidence", () => {
  const validation = validateClaimGraph({
    claims: [
      { id: "", field: "", value: 1, evidence: "" },
      { id: "dup", field: "job.price", value: 1, evidence: "$1", source: "bogus" },
      { id: "dup", field: "job.price", value: 2, evidence: "$2" },
    ],
    relationships: [
      {
        from: "dup",
        to: "dup",
        type: "duplicates",
        reason: "",
        confidence: "nope",
        signals: "not-array",
      },
    ],
  });
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => /id is required/.test(error)));
  assert.ok(validation.errors.some((error) => /field is required/.test(error)));
  assert.ok(validation.errors.some((error) => /evidence is required/.test(error)));
  assert.ok(validation.errors.some((error) => /duplicate/.test(error)));
  assert.ok(validation.errors.some((error) => /source is invalid/.test(error)));
  assert.ok(validation.errors.some((error) => /confidence is invalid/.test(error)));
  assert.ok(validation.errors.some((error) => /reason is required/.test(error)));
  assert.ok(validation.errors.some((error) => /signals must be an array/.test(error)));
});

test("validateClaimGraph rejects non-object graphs", () => {
  assert.equal(validateClaimGraph(null).ok, false);
  assert.equal(validateClaimGraph(undefined).ok, false);
  assert.equal(validateClaimGraph("graph").ok, false);
});

test("createRelationship defaults invalid confidence to needs_review", () => {
  const edge = createRelationship({
    from: "a",
    to: "b",
    type: "contradicts",
    reason: "test",
    confidence: "bogus",
  });
  assert.equal(edge.confidence, "needs_review");
  assert.equal(edge.reason, "test");
});

test("createRelationship defaults empty reason to unspecified", () => {
  const edge = createRelationship({
    from: "a",
    to: "b",
    type: "qualifies",
    reason: "   ",
  });
  assert.equal(edge.reason, "unspecified");
});

test("attachClaimGraph and clearClientClaimGraph round-trip", () => {
  const alphaJson = { normalization: {} };
  const graph = createClaimGraph({
    claims: [
      createClaim({
        id: "phone-1",
        field: "customer.phone",
        value: { digits: "5551234567" },
        evidence: "555-123-4567",
      }),
    ],
    relationships: [],
  });
  attachClaimGraph(alphaJson, graph);
  assert.equal(alphaJson.normalization.claim_graph.claims.length, 1);
  clearClientClaimGraph(alphaJson);
  assert.equal(alphaJson.normalization.claim_graph, undefined);
});

test("attachClaimGraph with null graph does not wipe existing graph", () => {
  const alphaJson = {
    normalization: {
      claim_graph: createClaimGraph({ claims: [], relationships: [] }),
    },
  };
  attachClaimGraph(alphaJson, null);
  assert.ok(alphaJson.normalization.claim_graph);
});

test("clearClientClaimGraph is safe when normalization is missing", () => {
  const alphaJson = {};
  assert.equal(clearClientClaimGraph(alphaJson), alphaJson);
});
