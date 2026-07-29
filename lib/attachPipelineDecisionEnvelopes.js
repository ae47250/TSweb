import { attachContactDecisionEnvelopes } from "./contactDecisionEnvelope.js";
import { attachPriceDecisionEnvelope } from "./priceDecisionEnvelope.js";

/**
 * Attach contact + price decision envelopes after domain resolvers run.
 * Does not alter selected AlphaJSON field values.
 */
export function attachPipelineDecisionEnvelopes(alphaJson = {}, contactNormalizationResult = null) {
  let next = alphaJson;
  next = attachContactDecisionEnvelopes(next, contactNormalizationResult);
  next = attachPriceDecisionEnvelope(next);
  return next;
}
