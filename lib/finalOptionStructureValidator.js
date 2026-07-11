import { createHash } from "node:crypto";
import {
  CANONICAL_SERVICE_ASSEMBLER_VERSION,
  FINAL_OPTION_STRUCTURE_ERROR_CODES,
  buildCanonicalShadowEstimate,
  inferServiceKindFromText,
  normalizeCanonicalText,
} from "./canonicalServiceAssembler.js";

export const ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT_FLAG = "ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT";
export const FINAL_OPTION_STRUCTURE_VALIDATOR_VERSION = "final-option-structure-validator-v0.1-shadow";

const STRUCTURAL_ERROR_CODE_SET = new Set(FINAL_OPTION_STRUCTURE_ERROR_CODES);
const DEPENDENT_ADD_ON_KINDS = new Set(["stump_grinding", "haul_away", "brush_cleanup"]);
const SAFETY_ACCESS_RE = /\b(?:service\s+line|power\s+line|utility|wire|unsafe|hazard)\b/i;

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function compact(value) {
  return asString(value).replace(/\s+/g, " ").trim();
}

function stableHash(value) {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
}

function optionAmount(option = {}) {
  const amount = Number(option?.price?.amount ?? option?.price?.min_amount);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null;
}

function optionText(option = {}) {
  return compact([option.title, option.description].filter(Boolean).join(" "));
}

function structuralError(code, message, details = {}) {
  return {
    code,
    message,
    field: details.field || "service_options.items",
    item_ids: details.item_ids || [],
    evidence_ids: details.evidence_ids || [],
    clearable_by: details.clearable_by || [
      "automatic_rebuild",
      "structured_relationship_edit",
      "structured_price_correction",
      "structured_scope_correction",
      "target_binding_correction",
    ],
  };
}

function uniqueErrors(errors = []) {
  return [...new Map(errors
    .filter((error) => error && STRUCTURAL_ERROR_CODE_SET.has(error.code))
    .map((error) => [JSON.stringify(error), error])).values()];
}

export function finalOptionStructureEnforcementEnabled(env = process.env) {
  return env?.[ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT_FLAG] === "true";
}

function optionHasKind(option, kind) {
  const metaKind = option.canonical_option?.service_kind || option.canonical_service_item?.service_kind || "";
  return metaKind === kind || inferServiceKindFromText(optionText(option)) === kind;
}

function optionIncludesText(option, expectedText) {
  const text = normalizeCanonicalText(optionText(option));
  return normalizeCanonicalText(expectedText)
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .every((word) => text.includes(word));
}

function hasStructuralRelationshipEvidence(alphaJson = {}, finalOptionModel = {}) {
  if (finalOptionModel.status && finalOptionModel.status !== "not_applicable") return true;
  const rec = alphaJson.normalization?.sidecar_price_reconciliation || {};
  return Boolean(
    (Array.isArray(rec.monetary_relationships) && rec.monetary_relationships.length) ||
    (Array.isArray(rec.add_on_interpretations) && rec.add_on_interpretations.length),
  );
}

function addScopeQualityErrors(options = [], shouldValidateScopeQuality = false) {
  if (!shouldValidateScopeQuality) return [];
  const errors = [];
  const pricedOptions = options.filter((option) => optionAmount(option));
  for (const option of pricedOptions) {
    const text = optionText(option);
    const normalized = normalizeCanonicalText(text);
    const label = compact(option.label) || "Option";
    if (
      pricedOptions.length > 1 &&
      (!normalized || /^(?:tree service|service|tree work|work|job|option)$/.test(normalized))
    ) {
      errors.push(structuralError(
        "GENERIC_OPTION_SCOPE",
        `${label} needs a specific customer-facing service scope before PDF.`,
      ));
    }
    if (/\b(?:phone|cell|email|e-?mail|addr|address|customer|hotmail|yahoo|icloud|gmail|aol|comcast|att)\b|@/i.test(text)) {
      errors.push(structuralError(
        "CONTAMINATED_OPTION_SCOPE",
        `${label} includes contact, address, or administrative text instead of customer service scope.`,
      ));
    }
    if (SAFETY_ACCESS_RE.test(text)) {
      errors.push(structuralError(
        "SAFETY_TEXT_IN_CUSTOMER_SCOPE",
        `${label} includes safety or access wording that should be stored outside customer option descriptions.`,
      ));
    }
  }
  return errors;
}

function optionsContainSafetyAccessScope(options = []) {
  return options.some((option) => SAFETY_ACCESS_RE.test(optionText(option)));
}

function activeOptionComparisonErrors(options = [], finalOptionModel = {}) {
  if (finalOptionModel.status !== "constructed") return [];
  const errors = [];
  const finalOptions = finalOptionModel.final_options || [];
  const expectedBase = finalOptions.find((option) => option.canonical_option?.option_kind === "base_service");
  const expectedExpanded = finalOptions.find((option) => option.canonical_option?.option_kind === "base_plus_dependent_addon");
  if (!expectedBase || !expectedExpanded) return errors;

  const baseAmount = optionAmount(expectedBase);
  const expandedAmount = optionAmount(expectedExpanded);
  const addOnItemIds = expectedExpanded.canonical_option?.add_on_item_ids || [];
  const addOnKinds = new Set(addOnItemIds
    .map((itemId) => finalOptionModel.relationships?.find((relationship) => relationship.add_on_item_id === itemId))
    .filter(Boolean)
    .map(() => null));
  for (const option of options) {
    const kind = inferServiceKindFromText(optionText(option));
    if (DEPENDENT_ADD_ON_KINDS.has(kind)) addOnKinds.add(kind);
  }

  const activeBase = options.find((option) => optionAmount(option) === baseAmount);
  const activeExpanded = options.find((option) => optionAmount(option) === expandedAmount);
  const standaloneAddOn = options.find((option) => {
    const amount = optionAmount(option);
    if (!amount || amount === expandedAmount) return false;
    const kind = inferServiceKindFromText(optionText(option));
    return DEPENDENT_ADD_ON_KINDS.has(kind);
  });

  if (!activeBase) {
    errors.push(structuralError(
      "MISSING_BASE_CHOICE",
      "Final customer choices are missing the base-service option.",
      { evidence_ids: expectedBase.canonical_option?.source_evidence_ids || [] },
    ));
  } else if (optionHasKind(activeBase, "stump_grinding") || optionHasKind(activeBase, "haul_away") || optionHasKind(activeBase, "brush_cleanup")) {
    errors.push(structuralError(
      "BASE_SCOPE_INCLUDES_ADDON",
      "The base option appears to contain only add-on scope.",
      { evidence_ids: expectedBase.canonical_option?.source_evidence_ids || [] },
    ));
  }

  if (standaloneAddOn) {
    errors.push(structuralError(
      "DEPENDENT_ADDON_STANDALONE",
      "A dependent add-on is displayed as a standalone customer choice instead of only as part of the expanded option.",
      { evidence_ids: expectedExpanded.canonical_option?.source_evidence_ids || [] },
    ));
  }

  if (!activeExpanded) {
    errors.push(structuralError(
      "MISSING_EXPANDED_CHOICE",
      "The dependent add-on is not represented as a cumulative expanded customer option.",
      { evidence_ids: expectedExpanded.canonical_option?.source_evidence_ids || [] },
    ));
  } else if (
    !optionIncludesText(activeExpanded, expectedBase.description) ||
    !optionIncludesText(activeExpanded, expectedExpanded.description)
  ) {
    errors.push(structuralError(
      "EXPANDED_SCOPE_INCOMPLETE",
      "The expanded option does not clearly include both the base service and dependent add-on scope.",
      { evidence_ids: expectedExpanded.canonical_option?.source_evidence_ids || [] },
    ));
  }

  return errors;
}

function unresolvedAddOnInterpretationErrors(alphaJson = {}, options = [], finalOptionModel = {}) {
  const rec = alphaJson.normalization?.sidecar_price_reconciliation || {};
  const interpretations = Array.isArray(rec.add_on_interpretations) ? rec.add_on_interpretations : [];
  if (!interpretations.length || finalOptionModel.status === "constructed") return [];
  const errors = [];
  for (const interpretation of interpretations) {
    const addOnAmount = Number(interpretation.add_on_amount ?? interpretation.add_on_price_value);
    const baseAmount = Number(interpretation.base_amount ?? interpretation.base_price_value);
    if (!Number.isFinite(addOnAmount) || !Number.isFinite(baseAmount)) continue;
    const activeAddOn = options.find((option) => {
      if (optionAmount(option) !== Math.round(addOnAmount)) return false;
      return DEPENDENT_ADD_ON_KINDS.has(inferServiceKindFromText(optionText(option)));
    });
    const activeBase = options.find((option) => optionAmount(option) === Math.round(baseAmount));
    const reviewish = interpretation.reason_code === "accepted_exact_final_price_with_warning" ||
      interpretation.reason_code === "needs_review_addon_ambiguity" ||
      interpretation.candidate_status === "rejected" ||
      /needs review|add-on|add on/i.test(interpretation.review_reason || "");
    if (!reviewish) continue;
    if (activeAddOn) {
      errors.push(structuralError(
        "DEPENDENT_ADDON_STANDALONE",
        "A possible dependent add-on is displayed as a standalone customer choice without a validated cumulative option.",
        { evidence_ids: [interpretation.interpretation_id, interpretation.add_on_price_id].filter(Boolean) },
      ));
    }
    if (activeBase && activeAddOn) {
      errors.push(structuralError(
        "AMBIGUOUS_OPTION_RELATIONSHIP",
        "Base service and add-on prices need structured relationship review before PDF readiness.",
        { evidence_ids: [interpretation.interpretation_id, interpretation.base_price_id, interpretation.add_on_price_id].filter(Boolean) },
      ));
    }
  }
  return errors;
}

function labelSequenceErrors(options = []) {
  const labels = options.map((option) => compact(option.label)).filter(Boolean);
  if (labels.length < 2) return [];
  const expected = labels.map((_, index) => `Option ${String.fromCharCode(65 + index)}`);
  if (labels.every((label, index) => label === expected[index])) return [];
  return [structuralError(
    "INVALID_OPTION_LABEL_SEQUENCE",
    "Customer option labels must be normalized after semantic construction.",
  )];
}

function blockingMessagesFor(errors = []) {
  return errors.map((error) => `${error.code}: ${error.message}`);
}

export function validateFinalOptionStructure(alphaJson = {}, {
  env = process.env,
  enforce = finalOptionStructureEnforcementEnabled(env),
} = {}) {
  const options = Array.isArray(alphaJson.service_options?.items) ? alphaJson.service_options.items : [];
  let shadow = null;
  let model = {
    version: "canonical-final-option-model-v0.1-shadow",
    status: "not_applicable",
    final_options: [],
    relationships: [],
    structural_errors: [],
    structural_error_codes: [],
    structural_hash: stableHash({ status: "not_applicable" }),
  };
  const errors = [];

  try {
    shadow = buildCanonicalShadowEstimate(alphaJson);
    model = shadow.finalOptionModel || model;
  } catch (error) {
    errors.push(structuralError(
      "UNSUPPORTED_FINAL_OPTION_COMBINATION",
      `Canonical final-option model could not be built: ${error.message}`,
    ));
  }

  errors.push(...(model.structural_errors || []));
  errors.push(...activeOptionComparisonErrors(options, model));
  errors.push(...unresolvedAddOnInterpretationErrors(alphaJson, options, model));
  errors.push(...addScopeQualityErrors(
    options,
    hasStructuralRelationshipEvidence(alphaJson, model) || optionsContainSafetyAccessScope(options),
  ));
  errors.push(...labelSequenceErrors(options));

  const structuralErrors = uniqueErrors(errors);
  const structuralHash = model.structural_hash || stableHash({
    validator_version: FINAL_OPTION_STRUCTURE_VALIDATOR_VERSION,
    options: options.map((option) => ({
      label: option.label,
      text: optionText(option),
      amount: optionAmount(option),
    })),
  });

  return {
    validator_version: FINAL_OPTION_STRUCTURE_VALIDATOR_VERSION,
    builder_version: CANONICAL_SERVICE_ASSEMBLER_VERSION,
    enforcement_enabled: Boolean(enforce),
    structural_errors: structuralErrors,
    structural_error_codes: [...new Set(structuralErrors.map((error) => error.code))].sort(),
    structural_blocking_errors: enforce ? blockingMessagesFor(structuralErrors) : [],
    final_option_structural_hash: structuralHash,
    canonical_option_model: model,
  };
}
