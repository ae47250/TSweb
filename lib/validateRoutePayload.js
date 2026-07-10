import { normalizeToAlphaJsonV14 } from "./normalizeAlphaJson.js";
import { stampServerVerifiedTdEditProvenance } from "./tdEditProvenance.js";
import { validateAlphaJson } from "./validateJson.js";

export function validateAlphaJsonRoutePayload(body = {}) {
  const alphaJson = body.alphaJson || body.json;
  if (!alphaJson) return null;

  const intake = body.intake || body.structured_input || body.structuredInput || {};
  const rawInput = body.customer_text || body.customerText || "";
  const normalized = normalizeToAlphaJsonV14(alphaJson, rawInput, intake);
  stampServerVerifiedTdEditProvenance(normalized, { sourceAlphaJson: alphaJson, rawInput, intake });

  return validateAlphaJson(normalized);
}
