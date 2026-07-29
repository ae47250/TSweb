import { attachClaimGraph } from "./claimGraph.js";
import { attachContactDecisionEnvelopes } from "./contactDecisionEnvelope.js";
import { buildClaimGraphFromRaw } from "./detectClaimRelationships.js";
import { attachPriceDecisionEnvelope } from "./priceDecisionEnvelope.js";

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
 * Attach contact + price decision envelopes and claim graph after domain resolvers run.
 * Does not alter selected AlphaJSON field values.
 */
export function attachPipelineDecisionEnvelopes(alphaJson = {}, contactNormalizationResult = null, rawInput = "") {
  let next = alphaJson;
  next = attachContactDecisionEnvelopes(next, contactNormalizationResult);
  next = attachPriceDecisionEnvelope(next);
  next = attachPipelineClaimGraph(next, rawInput);
  return next;
}
