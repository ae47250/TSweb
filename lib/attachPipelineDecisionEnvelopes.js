import { attachClaimGraph } from "./claimGraph.js";
import { attachContactDecisionEnvelopes } from "./contactDecisionEnvelope.js";
import { buildClaimGraphFromRaw } from "./detectClaimRelationships.js";
import { attachPriceDecisionEnvelope } from "./priceDecisionEnvelope.js";
import {
  attachTreeCountDecisionEnvelope,
  buildTreeCountDecisionEnvelope,
} from "./treeCountDecisionEnvelope.js";

/**
 * Build and attach the additive claim graph from raw notes.
 * Does not alter selected AlphaJSON field values.
 */
export function attachPipelineClaimGraph(alphaJson = {}, rawInput = "") {
  const text = String(
    rawInput
    || alphaJson?.raw_input?.customer_text
    || "",
  );
  const graph = buildClaimGraphFromRaw(text);
  return attachClaimGraph(alphaJson, graph);
}

/**
 * Attach contact + price + tree-count decision envelopes and claim graph after domain resolvers run.
 * Does not alter selected AlphaJSON field values.
 * Preserves a tree_count envelope already stamped by normalizeToAlphaJsonV14 when present.
 */
export function attachPipelineDecisionEnvelopes(alphaJson = {}, contactNormalizationResult = null, rawInput = "") {
  let next = alphaJson;
  next = attachContactDecisionEnvelopes(next, contactNormalizationResult);
  next = attachPriceDecisionEnvelope(next);
  if (!next?.normalization?.decisions?.tree_count) {
    next = attachTreeCountDecisionEnvelope(
      next,
      buildTreeCountDecisionEnvelope({
        selectedValue: next?.job?.tree_details?.tree_count || "",
        rawInput,
        treeCountOverride: next?.normalization?.field_evidence?.tree_count_override || "",
      }),
    );
  }
  next = attachPipelineClaimGraph(next, rawInput);
  return next;
}
