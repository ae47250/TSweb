import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

let inferServiceKindDetails;
let normalizeToAlphaJsonV14;
let validateAlphaJson;
let parseOpenAiDraft;
let openAiDraftToNormalizerInput;
let normalizeContactFields;
let applyContactNormalizationOverlay;
let buildOptionPriceCandidateView;
let reconcileSidecarPrices;
let attachPipelineDecisionEnvelopes;

async function loadPipeline(pipelineRoot) {
  const moduleUrl = (relativePath) => pathToFileURL(resolve(pipelineRoot, relativePath)).href;
  ({ inferServiceKindDetails } = await import(moduleUrl("lib/canonicalServiceAssembler.js")));
  ({ normalizeToAlphaJsonV14 } = await import(moduleUrl("lib/normalizeAlphaJson.js")));
  ({ validateAlphaJson } = await import(moduleUrl("lib/validateJson.js")));
  ({ parseOpenAiDraft } = await import(moduleUrl("lib/openaiDraftSchema.js")));
  ({ openAiDraftToNormalizerInput } = await import(moduleUrl("lib/openaiDraftAdapter.js")));
  ({ normalizeContactFields } = await import(moduleUrl("lib/contactNormalizer.js")));
  ({ applyContactNormalizationOverlay } = await import(moduleUrl("lib/contactNormalizationOverlay.js")));
  ({ buildOptionPriceCandidateView } = await import(moduleUrl("lib/optionPriceNormalizer.js")));
  ({ reconcileSidecarPrices } = await import(moduleUrl("lib/priceReconciliation.js")));
  ({ attachPipelineDecisionEnvelopes } = await import(moduleUrl("lib/attachPipelineDecisionEnvelopes.js")));
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstText(...values) {
  for (const value of values) {
    const text = asString(value);
    if (text) return text;
  }
  return "";
}

function readCustomerText(row) {
  return firstText(
    row.raw_note,
    row.raw_td1,
    row.raw,
    row.raw_customer_input,
    row.customer_text,
    row.customerText,
    row.messy_input,
    row.input,
    row.text,
    typeof row.intake === "string" ? row.intake : "",
  );
}

function readStructuredIntake(row) {
  const intake = row.intake || row.structured_input || row.structuredInput || {};
  return isObject(intake) ? intake : {};
}

function readDraft(row) {
  const draft = row.raw_draft || row.draft || row.openai_draft || {};
  if (isObject(draft)) return draft;
  if (typeof draft === "string" && draft.trim()) {
    try {
      const parsed = JSON.parse(draft);
      return isObject(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function runOfflinePipeline(draft, customerText, intake) {
  const contactNormalizationResult = normalizeContactFields({ rawText: customerText, intake });
  const optionPriceCandidateView = buildOptionPriceCandidateView(customerText);
  let normalizerInput = {};
  if (Object.keys(draft).length) {
    const parsedDraft = parseOpenAiDraft(draft);
    normalizerInput = openAiDraftToNormalizerInput(parsedDraft.draft, {
      rawInput: customerText,
      intake,
    });
  }
  let alphaJson = reconcileSidecarPrices(
    applyContactNormalizationOverlay(
      normalizeToAlphaJsonV14(normalizerInput, customerText, intake),
      contactNormalizationResult,
    ),
    optionPriceCandidateView,
  );
  alphaJson = attachPipelineDecisionEnvelopes(
    alphaJson,
    contactNormalizationResult,
    customerText,
  );
  return validateAlphaJson(alphaJson);
}

function readExpected(row) {
  if (isObject(row.expected)) return row.expected;
  const expected = {
    customer_name: firstText(row.expected_customer_name, row.expected_name),
    phone_display: firstText(row.expected_phone_display, row.expected_phone),
    email: asString(row.expected_email),
    service_address: firstText(row.expected_service_address, row.expected_address),
    work_requested: firstText(row.expected_work_requested, row.expected_scope, row.expected_description),
    tree_count: firstText(row.expected_tree_count, row.expected_treeCount),
    prices: row.expected_prices || row.expected_service_option_prices || null,
    can_generate_pdf: typeof row.expected_can_generate_pdf === "boolean" ? row.expected_can_generate_pdf : row.can_generate_pdf_expected,
  };
  return Object.fromEntries(Object.entries(expected).filter(([, value]) => value !== "" && value != null));
}

function readDatasetRows(inputPath) {
  const raw = readFileSync(inputPath, "utf8").trim();
  if (!raw) return [];

  if (/\.json$/i.test(inputPath) || raw.startsWith("[") || raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.cases)) {
        const draftsById = new Map(asArray(parsed.frozen_drafts).map((draft) => [draft.case_id, draft.raw_draft]));
        return parsed.cases.map((row) => ({
          ...row,
          raw_draft: row.raw_draft || draftsById.get(row.case_id || row.id) || null,
        }));
      }
      if (isObject(parsed)) return [parsed];
    } catch {
      // Fall through to JSONL parsing so a .jsonl file whose first row is an
      // object is not mistaken for one invalid JSON document.
    }
  }

  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function summarizeOption(option) {
  return {
    label: option?.label || "",
    title: option?.title || "",
    description: option?.description || "",
    price_display: option?.price?.display || "",
    price_amount: option?.price?.amount ?? option?.price?.min_amount ?? null,
    sort_order: option?.sort_order ?? null,
    service_kind: option?.canonical_service_item?.service_kind || option?.canonical_option?.service_kind || "",
    relationship_type: option?.canonical_service_item?.relationship_type || option?.canonical_option?.relationship_type || "",
  };
}

function actualSummary(validation) {
  const alphaJson = validation.alphaJson || {};
  return {
    actual_customer_name: alphaJson.customer?.name || "",
    actual_phone: alphaJson.customer?.phone_display || alphaJson.customer?.phone_primary || "",
    actual_email: alphaJson.customer?.email || "",
    actual_service_address: alphaJson.job?.service_address?.display || "",
    actual_tree_count: alphaJson.job?.tree_details?.tree_count || "",
    actual_tree_type: alphaJson.job?.tree_details?.tree_type || "",
    actual_work_description: alphaJson.job?.description || "",
    actual_service_options: (alphaJson.service_options?.items || []).map(summarizeOption),
  };
}

function normalizeForMatch(value) {
  return asString(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function phoneDigits(value) {
  return asString(value).replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
}

function positiveAmount(value) {
  if (value == null || value === "") return null;
  const amount = Number(asString(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function quantityNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = normalizeForMatch(value);
  const digit = text.match(/\b(\d+)\b/);
  if (digit) return Number(digit[1]);
  const words = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  for (const [word, amount] of Object.entries(words)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) return amount;
  }
  return null;
}

function compareFields(expected, actual) {
  const matches = {};
  if (expected.customer_name) {
    matches.name = normalizeForMatch(expected.customer_name) === normalizeForMatch(actual.actual_customer_name);
  }
  const expectedPhone = firstText(expected.phone_display, expected.phone);
  if (expectedPhone) {
    matches.phone = phoneDigits(expectedPhone) === phoneDigits(actual.actual_phone);
  }
  if (expected.email) {
    matches.email = normalizeForMatch(expected.email) === normalizeForMatch(actual.actual_email);
  }
  if (expected.service_address) {
    const expectedAddress = normalizeForMatch(expected.service_address);
    const actualAddress = normalizeForMatch(actual.actual_service_address);
    matches.service_address = actualAddress === expectedAddress || actualAddress.includes(expectedAddress) || expectedAddress.includes(actualAddress);
  }
  if (expected.tree_count) {
    const expectedCount = quantityNumber(expected.tree_count);
    const actualCount = quantityNumber(actual.actual_tree_count);
    matches.tree_count = expectedCount != null && actualCount != null
      ? expectedCount === actualCount
      : normalizeForMatch(expected.tree_count) === normalizeForMatch(actual.actual_tree_count);
  }
  if (expected.species) {
    const expectedSpecies = normalizeForMatch(expected.species);
    const actualSpecies = normalizeForMatch(actual.actual_tree_type);
    matches.tree_species = actualSpecies === expectedSpecies ||
      actualSpecies.includes(expectedSpecies) ||
      expectedSpecies.includes(actualSpecies);
  }
  if (expected.town) {
    matches.address_town = normalizeForMatch(actual.actual_service_address).includes(normalizeForMatch(expected.town));
  }
  if (typeof expected.can_generate_pdf === "boolean") {
    matches.can_generate_pdf = expected.can_generate_pdf === actual.can_generate_pdf;
  }
  return matches;
}

function normalizeFact(value) {
  const fact = normalizeForMatch(value).replace(/\s+/g, "_");
  const aliases = {
    grind_stump: "grind_stumps",
    stump_grinding: "grind_stumps",
    haul_debris: "haul_away",
    remove_tree: "remove_tree",
    tree_removal: "remove_tree",
    trim_tree: "tree_trim",
    tree_trimming: "tree_trim",
    remove_limb: "limb_removal",
    remove_branch: "limb_removal",
  };
  return aliases[fact] || fact;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function sourceFinalCoverage(validation) {
  return validation.alphaJson?.validation?.source_final_fact_coverage || {};
}

function finalOptionFacts(validation) {
  const coverageOptions = asArray(sourceFinalCoverage(validation).final_options);
  if (coverageOptions.length) {
    return coverageOptions.map((option, index) => ({
      label: firstText(option.label, String.fromCharCode(65 + index)).replace(/^Option\s+/i, "").toUpperCase(),
      facts: unique([
        ...asArray(option.work_actions),
        ...asArray(option.debris_disposition),
        ...asArray(option.stump_treatment),
      ].map(normalizeFact)),
    }));
  }

  return asArray(validation.alphaJson?.service_options?.items).map((option, index) => {
    const text = normalizeForMatch(`${option.title || ""} ${option.description || ""}`);
    const facts = [];
    if (/\b(?:remove|removal|take down|cut down|drop)\b/.test(text)) facts.push("remove_tree");
    if (/\b(?:grind|grinding)\b.{0,18}\bstumps?\b|\bstumps?\b.{0,18}\bgrind/.test(text)) facts.push("grind_stumps");
    if (/\b(?:haul away|haul off|remove debris|debris removal)\b/.test(text)) facts.push("haul_away");
    if (/\b(?:trim|prune|pruning)\b/.test(text)) facts.push("tree_trim");
    if (/\b(?:branch|branches|limb|limbs)\b.{0,24}\b(?:remove|removal|take down)\b|\b(?:remove|removal|take down)\b.{0,24}\b(?:branch|branches|limb|limbs)\b/.test(text)) {
      facts.push("limb_removal");
    }
    if (/\b(?:brush cleanup|brush removal|clean up brush)\b/.test(text)) facts.push("brush_cleanup");
    return {
      label: firstText(option.label, String.fromCharCode(65 + index)).replace(/^Option\s+/i, "").toUpperCase(),
      facts: unique(facts),
    };
  });
}

function expectedOptionAmounts(expected) {
  if (Array.isArray(expected.options)) {
    return expected.options
      .map((option) => positiveAmount(option.price ?? option.amount))
      .filter((amount) => amount != null);
  }
  const amounts = [
    expected.option_a_amount ?? expected.a_price,
    expected.option_b_amount ?? expected.b_price,
  ]
    .map(positiveAmount)
    .filter((amount) => amount != null);
  if (amounts.length) return amounts;
  return asArray(expected.prices)
    .map(positiveAmount)
    .filter((amount) => amount != null);
}

function actualOptionAmounts(validation) {
  return asArray(validation.alphaJson?.service_options?.items)
    .map((option) => positiveAmount(option?.price?.amount ?? option?.price?.min_amount))
    .filter((amount) => amount != null);
}

function exactOrderedValues(expected, actual) {
  return expected.length === actual.length && expected.every((value, index) => value === actual[index]);
}

function expectedOptionCount(expected) {
  if (Array.isArray(expected.options)) return expected.options.length;
  const amounts = expectedOptionAmounts(expected);
  return amounts.length ? amounts.length : null;
}

function compareActionFacts(expected, validation) {
  if (!Array.isArray(expected.options)) return null;
  const expectedOptions = expected.options.filter((option) => Array.isArray(option.facts));
  if (!expectedOptions.length) return null;
  const actualByLabel = new Map(finalOptionFacts(validation).map((option) => [option.label, option.facts]));
  const missing = [];
  let expectedCount = 0;
  let matchedCount = 0;

  for (let index = 0; index < expectedOptions.length; index += 1) {
    const option = expectedOptions[index];
    const label = firstText(option.label, String.fromCharCode(65 + index)).replace(/^Option\s+/i, "").toUpperCase();
    const actualFacts = new Set(actualByLabel.get(label) || []);
    for (const rawFact of option.facts) {
      const fact = normalizeFact(rawFact);
      expectedCount += 1;
      if (actualFacts.has(fact)) matchedCount += 1;
      else missing.push({ option: label, fact });
    }
  }

  return {
    matched: matchedCount,
    expected: expectedCount,
    recall: expectedCount ? Number((matchedCount / expectedCount).toFixed(4)) : 1,
    complete: missing.length === 0,
    missing,
  };
}

function compareOptionBTerms(expected, validation) {
  const expectedTerms = unique(asArray(expected.b_terms).map(normalizeForMatch));
  if (!expectedTerms.length) return null;
  const optionB = asArray(validation.alphaJson?.service_options?.items)[1] || {};
  const text = normalizeForMatch(`${optionB.title || ""} ${optionB.description || ""}`);
  const patterns = {
    remove: /\b(?:remove|removal|take down|cut down|drop|fell)\b/,
    grind: /\b(?:grind|grinding)\b/,
    haul: /\b(?:haul|hauling|debris removal)\b/,
    cleanup: /\b(?:cleanup|clean up|rake|raking)\b/,
    chip: /\b(?:chip|chipping)\b/,
    split: /\b(?:split|splitting)\b/,
    backfill: /\b(?:backfill|back fill)\b/,
    topsoil: /\btopsoil\b/,
    seed: /\b(?:seed|seeding)\b/,
    buck: /\b(?:buck|bucking)\b/,
  };
  const missing = expectedTerms.filter((term) => !(patterns[term] || new RegExp(`\\b${term}\\b`)).test(text));
  return {
    expected: expectedTerms,
    matched: expectedTerms.length - missing.length,
    recall: Number(((expectedTerms.length - missing.length) / expectedTerms.length).toFixed(4)),
    complete: missing.length === 0,
    missing,
  };
}

function actualServiceKinds(validation) {
  const options = asArray(validation.alphaJson?.service_options?.items);
  const kinds = options.flatMap((option) => {
    const explicit = option?.canonical_service_item?.service_kind || option?.canonical_option?.service_kind;
    const inferred = inferServiceKindDetails(`${option?.title || ""} ${option?.description || ""}`).service_kind;
    return [explicit, inferred];
  });
  const facts = finalOptionFacts(validation).flatMap((option) => option.facts);
  const factKinds = facts.map((fact) => ({
    remove_tree: "tree_removal",
    tree_trim: "tree_trim",
    limb_removal: "limb_removal",
    grind_stumps: "stump_grinding",
    haul_away: "haul_away",
    brush_cleanup: "brush_cleanup",
  })[fact]);
  return unique([...kinds, ...factKinds]).filter((kind) => kind && kind !== "unresolved_service");
}

function compareServiceKinds(expected, validation) {
  const expectedKinds = unique(asArray(expected.service_kinds));
  if (!expectedKinds.length) return null;
  const actualKinds = actualServiceKinds(validation);
  const actualSet = new Set(actualKinds);
  const missing = expectedKinds.filter((kind) => !actualSet.has(kind));
  return {
    expected: expectedKinds,
    actual: actualKinds,
    matched: expectedKinds.length - missing.length,
    recall: Number(((expectedKinds.length - missing.length) / expectedKinds.length).toFixed(4)),
    complete: missing.length === 0,
    missing,
  };
}

function actualPriceRole(validation, customerText) {
  const rec = validation.alphaJson?.normalization?.sidecar_price_reconciliation || {};
  const roles = unique(asArray(rec.add_on_interpretations).map((item) => item.price_role));
  if (roles.includes("AMBIGUOUS_PRICE_ROLE")) return "ambiguous";
  if (roles.includes("INCREMENTAL_ADDON_PRICE")) return "incremental_addon";
  if (roles.includes("EXPLICIT_OPTION_TOTAL")) return "explicit_option_total";

  const amounts = actualOptionAmounts(validation);
  if (amounts.length >= 2) return "explicit_option_total";
  if (/\b(?:maybe|unclear|not sure|depending|approximately|around)\b/i.test(customerText) && /\d[\d,]*.*\d[\d,]*/.test(customerText)) {
    return "ambiguous";
  }
  return "none";
}

function actualRelationship(validation, customerText) {
  const priceRole = actualPriceRole(validation, customerText);
  if (priceRole === "ambiguous") return "unresolved";

  const options = finalOptionFacts(validation);
  if (options.length >= 2) {
    const firstFacts = new Set(options[0].facts);
    const secondFacts = new Set(options[1].facts);
    const secondContainsFirst = firstFacts.size > 0 && [...firstFacts].every((fact) => secondFacts.has(fact));
    if (secondContainsFirst && secondFacts.size > firstFacts.size) return "base_with_dependent_addon";
    return "independent_alternative";
  }

  const rec = validation.alphaJson?.normalization?.sidecar_price_reconciliation || {};
  if (asArray(rec.add_on_interpretations).some((item) =>
    item.price_role === "INCREMENTAL_ADDON_PRICE" || item.price_role === "EXPLICIT_OPTION_TOTAL")) {
    return "base_with_dependent_addon";
  }
  return actualOptionAmounts(validation).length ? "base_service" : "unresolved";
}

function sourceFinalFindings(validation) {
  const coverage = sourceFinalCoverage(validation);
  const findings = [
    ...asArray(coverage.blocking_results),
    ...asArray(coverage.warning_results),
  ];
  return {
    applicable: Boolean(coverage.applicable),
    codes: unique(findings.map((item) => item.code)),
    findings,
  };
}

function evaluateAccuracy(row, expected, validation, customerText) {
  const expectedAmounts = expectedOptionAmounts(expected);
  const actualAmounts = actualOptionAmounts(validation);
  const optionCount = expectedOptionCount(expected);
  const actualCount = asArray(validation.alphaJson?.service_options?.items).length;
  const actionFacts = compareActionFacts(expected, validation);
  const optionBTerms = compareOptionBTerms(expected, validation);
  const serviceKinds = compareServiceKinds(expected, validation);
  const primaryExpectedKinds = unique(asArray(expected.service_kinds));
  const primaryActualKind = inferServiceKindDetails(firstText(row.raw_service_phrase, customerText)).service_kind;
  const expectedPriceRole = firstText(
    expected.option_b_price_role,
    row.category === "incremental_addon" ? "incremental_addon" : "",
    row.category === "explicit_total" ? "explicit_option_total" : "",
  );
  const expectedRelationship = firstText(
    expected.relationship,
    ["incremental_addon", "explicit_total"].includes(row.category) ? "base_with_dependent_addon" : "",
  );
  const fieldMatches = compareFields(expected, {
    ...actualSummary(validation),
    can_generate_pdf: validation.can_generate_pdf,
  });
  const contactFields = ["name", "phone", "email"].filter((field) => field in fieldMatches);
  const metrics = {
    exact_option_prices: expectedAmounts.length ? exactOrderedValues(expectedAmounts, actualAmounts) : null,
    exact_option_count: optionCount == null ? null : optionCount === actualCount,
    primary_service_kind: primaryExpectedKinds.length ? primaryExpectedKinds.includes(primaryActualKind) : null,
    service_kind_recall_complete: serviceKinds ? serviceKinds.complete : null,
    action_fact_recall_complete: actionFacts ? actionFacts.complete : null,
    option_b_terms_recall_complete: optionBTerms ? optionBTerms.complete : null,
    option_relationship: expectedRelationship ? actualRelationship(validation, customerText) === expectedRelationship : null,
    option_b_price_role: expectedPriceRole ? actualPriceRole(validation, customerText) === expectedPriceRole : null,
    contact_equivalence: contactFields.length ? contactFields.every((field) => fieldMatches[field]) : null,
    address_equivalence: "service_address" in fieldMatches
      ? fieldMatches.service_address
      : ("address_town" in fieldMatches ? fieldMatches.address_town : null),
  };
  const factualChecks = [
    ...Object.entries(fieldMatches)
      .filter(([field]) => field !== "can_generate_pdf")
      .map(([, matched]) => matched),
    ...Object.values(metrics).filter((value) => typeof value === "boolean"),
  ];

  return {
    metrics,
    factually_correct: factualChecks.length ? factualChecks.every(Boolean) : null,
    expected_option_amounts: expectedAmounts,
    actual_option_amounts: actualAmounts,
    expected_option_count: optionCount,
    actual_option_count: actualCount,
    primary_service_kind: {
      expected: primaryExpectedKinds,
      actual: primaryActualKind,
      matched: metrics.primary_service_kind,
    },
    service_kind_recall: serviceKinds,
    action_fact_recall: actionFacts,
    option_b_terms_recall: optionBTerms,
    option_relationship: {
      expected: expectedRelationship || null,
      actual: expectedRelationship ? actualRelationship(validation, customerText) : null,
      matched: metrics.option_relationship,
    },
    option_b_price_role: {
      expected: expectedPriceRole || null,
      actual: expectedPriceRole ? actualPriceRole(validation, customerText) : null,
      matched: metrics.option_b_price_role,
    },
  };
}

function metricSummary(results, metricName) {
  const values = results
    .map((row) => row.accuracy?.metrics?.[metricName])
    .filter((value) => typeof value === "boolean");
  const matched = values.filter(Boolean).length;
  return {
    matched,
    total: values.length,
    rate: values.length ? Number((matched / values.length).toFixed(4)) : null,
  };
}

function readinessSafetyFromRow(row) {
  return row.readiness_safety ||
    row.validation?.readiness_safety ||
    row.alphaJson?.validation?.readiness_safety ||
    {};
}

function expectedReviewRequired(row) {
  const expected = row.expected || {};
  if (typeof expected.review_required === "boolean") return expected.review_required;
  return ["ambiguous_review", "independent_alternatives"].includes(row.category || row.group || "");
}

function expectedCorrectAbstention(row) {
  const expected = row.expected || {};
  if (expected.relationship === "unresolved") return true;
  if (expected.option_b_price_role === "ambiguous") return true;
  return (row.category || "") === "ambiguous_review";
}

function conflictDetected(row) {
  const readiness = readinessSafetyFromRow(row);
  if ((readiness.invariant_codes || []).includes("CONFLICTING_SUPPORTED_CANDIDATES")) return true;
  const decisions = row.alphaJson?.normalization?.decisions || {};
  return Object.values(decisions).some((envelope) =>
    envelope?.resolution?.reasonCode === "conflicting_supported_candidates" ||
    (
      (envelope?.resolution?.status === "unresolved" || envelope?.resolution?.status === "requires_review") &&
      asArray(envelope?.candidates).filter((candidate) =>
        ["explicit", "normalized_explicit"].includes(candidate.support) &&
        ["eligible", "selected"].includes(candidate.status),
      ).length >= 2
    ),
  );
}

function pipelineAbstained(row) {
  if (!row.can_generate_pdf) return true;
  const readiness = readinessSafetyFromRow(row);
  const codes = new Set(readiness.invariant_codes || []);
  if (
    codes.has("CONFLICTING_SUPPORTED_CANDIDATES") ||
    codes.has("HIGH_CONFIDENCE_PRICE_UNRESOLVED") ||
    codes.has("INFERRED_SCOPE_AFFECTS_PRICE_UNAPPROVED")
  ) {
    return true;
  }
  const decisions = row.alphaJson?.normalization?.decisions || {};
  return Object.values(decisions).some((envelope) =>
    envelope?.resolution?.status === "abstained" ||
    envelope?.resolution?.status === "requires_review" ||
    envelope?.resolution?.status === "unresolved",
  );
}

function reviewerOverrideSignals(row) {
  const review = row.alphaJson?.review || {};
  const overrides = review.overrides || {};
  const overrideKeys = Object.entries(overrides)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => key);
  const optionFlags = asArray(row.alphaJson?.service_options?.items).flatMap((option) => {
    const flags = option?.review_flags || {};
    const keys = [];
    if (flags.source_to_final_verified_override) keys.push("source_to_final_verified_override");
    if (flags.description_server_verified_td_edit) keys.push("description_server_verified_td_edit");
    if (flags.scope_approved_by_reviewer) keys.push("scope_approved_by_reviewer");
    return keys;
  });
  const overrideWarnings = asArray(review.override_warnings);
  return {
    used: overrideKeys.length > 0 || optionFlags.length > 0 || overrideWarnings.length > 0,
    override_keys: unique([...overrideKeys, ...optionFlags]),
    override_warning_count: overrideWarnings.length,
  };
}

function unsupportedSelectedFacts(row) {
  const coverage = sourceFinalCoverage(row.validation || row);
  const results = asArray(coverage.results).filter((result) =>
    ["option_label", "price", "work_actions", "species", "tree_quantity", "stump_quantity", "stump_treatment", "debris_disposition", "target_qualifiers", "customer_phone", "customer_email", "service_address"].includes(result?.fact) &&
    result?.source_value,
  );
  const unsupported = results.filter((result) =>
    ["missing", "changed"].includes(result.status) && !result.override_recorded,
  );
  return {
    checked: results.length,
    unsupported: unsupported.length,
    codes: unique(unsupported.map((result) => result.code)),
  };
}

function rateFromCounts(matched, total) {
  return {
    matched,
    total,
    rate: total ? Number((matched / total).toFixed(4)) : null,
  };
}

function summarizeReadinessSafety(results) {
  const factuallyCorrect = results.filter((row) => row.accuracy?.factually_correct === true);
  const factuallyIncorrect = results.filter((row) => row.accuracy?.factually_correct === false);
  const unscored = results.filter((row) => row.accuracy?.factually_correct == null);

  const unsafeReady = factuallyIncorrect.filter((row) => row.can_generate_pdf);
  const correctButBlocked = factuallyCorrect.filter((row) => !row.can_generate_pdf);

  const projectedWouldBlock = results.filter((row) => readinessSafetyFromRow(row).would_block_pdf);
  const unsafeReadyCaughtByShadow = unsafeReady.filter((row) => readinessSafetyFromRow(row).would_block_pdf);
  const correctReadyThatShadowWouldBlock = factuallyCorrect.filter((row) =>
    row.can_generate_pdf && readinessSafetyFromRow(row).would_block_pdf,
  );
  const projectedCorrectButBlocked = factuallyCorrect.filter((row) =>
    !row.can_generate_pdf || readinessSafetyFromRow(row).would_block_pdf,
  );

  const invariantTripCounts = {};
  const invariantCaseIds = {};
  for (const row of results) {
    for (const code of readinessSafetyFromRow(row).invariant_codes || []) {
      invariantTripCounts[code] = (invariantTripCounts[code] || 0) + 1;
      invariantCaseIds[code] ||= [];
      invariantCaseIds[code].push(row.case_id);
    }
  }

  const conflictGold = results.filter(expectedReviewRequired);
  const conflictRecallHits = conflictGold.filter(conflictDetected);

  const abstentionGold = results.filter(expectedCorrectAbstention);
  const correctAbstentionHits = abstentionGold.filter(pipelineAbstained);

  const overrideRows = results.map((row) => ({ row, signals: reviewerOverrideSignals(row) }));
  const overridesUsed = overrideRows.filter((entry) => entry.signals.used);

  const unsupportedRows = results.map((row) => ({ row, stats: unsupportedSelectedFacts(row) }));
  const unsupportedChecked = unsupportedRows.reduce((sum, entry) => sum + entry.stats.checked, 0);
  const unsupportedCount = unsupportedRows.reduce((sum, entry) => sum + entry.stats.unsupported, 0);

  return {
    factually_correct: factuallyCorrect.length,
    factually_incorrect: factuallyIncorrect.length,
    unscored: unscored.length,
    incorrect_but_ready: {
      case_ids: unsafeReady.map((row) => row.case_id),
      count: unsafeReady.length,
      caught_by_shadow_invariants: unsafeReadyCaughtByShadow.map((row) => row.case_id),
      caught_by_shadow_count: unsafeReadyCaughtByShadow.length,
      catch_rate: unsafeReady.length
        ? Number((unsafeReadyCaughtByShadow.length / unsafeReady.length).toFixed(4))
        : null,
    },
    correct_but_blocked: {
      case_ids: correctButBlocked.map((row) => row.case_id),
      count: correctButBlocked.length,
      projected_if_shadow_enforced: projectedCorrectButBlocked.map((row) => row.case_id),
      projected_count_if_shadow_enforced: projectedCorrectButBlocked.length,
      newly_blocked_if_shadow_enforced: correctReadyThatShadowWouldBlock.map((row) => row.case_id),
      newly_blocked_count: correctReadyThatShadowWouldBlock.length,
    },
    // Backward-compatible aliases used by existing reports.
    unsafe_ready: unsafeReady.map((row) => row.case_id),
    reviewer_overrides: {
      cases_with_overrides: overridesUsed.map((entry) => entry.row.case_id),
      count: overridesUsed.length,
      override_key_counts: overridesUsed.reduce((counts, entry) => {
        for (const key of entry.signals.override_keys) {
          counts[key] = (counts[key] || 0) + 1;
        }
        return counts;
      }, {}),
    },
    unresolved_conflict_recall: {
      ...rateFromCounts(conflictRecallHits.length, conflictGold.length),
      gold_case_ids: conflictGold.map((row) => row.case_id),
      detected_case_ids: conflictRecallHits.map((row) => row.case_id),
      missed_case_ids: conflictGold
        .filter((row) => !conflictDetected(row))
        .map((row) => row.case_id),
    },
    correct_abstention: {
      ...rateFromCounts(correctAbstentionHits.length, abstentionGold.length),
      gold_case_ids: abstentionGold.map((row) => row.case_id),
      abstained_case_ids: correctAbstentionHits.map((row) => row.case_id),
      guessed_case_ids: abstentionGold
        .filter((row) => !pipelineAbstained(row))
        .map((row) => row.case_id),
    },
    unsupported_selected_facts: {
      unsupported: unsupportedCount,
      checked: unsupportedChecked,
      rate: unsupportedChecked ? Number((unsupportedCount / unsupportedChecked).toFixed(4)) : null,
      cases_with_unsupported: unsupportedRows
        .filter((entry) => entry.stats.unsupported > 0)
        .map((entry) => entry.row.case_id),
    },
    shadow_invariants: {
      cases_would_block_pdf: projectedWouldBlock.map((row) => row.case_id),
      would_block_count: projectedWouldBlock.length,
      trip_counts_by_code: Object.fromEntries(Object.entries(invariantTripCounts).sort()),
      case_ids_by_code: Object.fromEntries(
        Object.keys(invariantCaseIds).sort().map((code) => [code, invariantCaseIds[code]]),
      ),
    },
  };
}

function summarizeRun(results) {
  const total = results.length;
  const ready = results.filter((row) => row.can_generate_pdf).length;
  const byGroup = {};
  const fieldTotals = {};
  const fieldMatches = {};
  const sourceFinalCodes = {};

  for (const row of results) {
    const group = row.group || row.difficulty || row.messiness || row.category || "unknown";
    byGroup[group] ||= { total: 0, ready: 0, blocking: 0 };
    byGroup[group].total += 1;
    if (row.can_generate_pdf) byGroup[group].ready += 1;
    if ((row.blocking_errors || []).length) byGroup[group].blocking += 1;

    for (const [field, matched] of Object.entries(row.field_matches || {})) {
      fieldTotals[field] = (fieldTotals[field] || 0) + 1;
      if (matched) fieldMatches[field] = (fieldMatches[field] || 0) + 1;
    }
    for (const finding of row.source_final?.findings || []) {
      if (!finding.code) continue;
      sourceFinalCodes[finding.code] = (sourceFinalCodes[finding.code] || 0) + 1;
    }
  }

  const factuallyCorrect = results.filter((row) => row.accuracy?.factually_correct === true);
  const factuallyIncorrect = results.filter((row) => row.accuracy?.factually_correct === false);
  const sourceFinalFlagged = results.filter((row) => (row.source_final?.codes || []).length > 0);
  const readinessSafety = summarizeReadinessSafety(results);

  return {
    total,
    can_generate_pdf: ready,
    blocked: total - ready,
    ready_rate: total ? Number((ready / total).toFixed(4)) : 0,
    by_group: byGroup,
    field_match_rates: Object.fromEntries(
      Object.keys(fieldTotals).sort().map((field) => [
        field,
        {
          matched: fieldMatches[field] || 0,
          total: fieldTotals[field],
          rate: Number(((fieldMatches[field] || 0) / fieldTotals[field]).toFixed(4)),
        },
      ]),
    ),
    accuracy: {
      exact_option_prices: metricSummary(results, "exact_option_prices"),
      exact_option_count: metricSummary(results, "exact_option_count"),
      primary_service_kind: metricSummary(results, "primary_service_kind"),
      service_kind_recall_complete: metricSummary(results, "service_kind_recall_complete"),
      action_fact_recall_complete: metricSummary(results, "action_fact_recall_complete"),
      option_b_terms_recall_complete: metricSummary(results, "option_b_terms_recall_complete"),
      option_relationship: metricSummary(results, "option_relationship"),
      option_b_price_role: metricSummary(results, "option_b_price_role"),
      contact_equivalence: metricSummary(results, "contact_equivalence"),
      address_equivalence: metricSummary(results, "address_equivalence"),
    },
    source_final_calibration: {
      applicable: results.filter((row) => row.source_final?.applicable).length,
      cases_with_codes: sourceFinalFlagged.length,
      omission_or_change_counts_by_code: Object.fromEntries(Object.entries(sourceFinalCodes).sort()),
      candidate_false_positive_cases: sourceFinalFlagged
        .filter((row) => row.accuracy?.factually_correct === true)
        .map((row) => row.case_id),
      candidate_false_negative_cases: factuallyIncorrect
        .filter((row) => !(row.source_final?.codes || []).length)
        .map((row) => row.case_id),
    },
    readiness_safety: readinessSafety,
  };
}

function buildReadinessSafetyReport(results, summary) {
  return {
    version: "readiness-safety-report-v0.1",
    total: results.length,
    can_generate_pdf: summary.can_generate_pdf,
    blocked: summary.blocked,
    metrics: {
      incorrect_but_ready: summary.readiness_safety.incorrect_but_ready,
      correct_but_blocked: summary.readiness_safety.correct_but_blocked,
      reviewer_overrides: summary.readiness_safety.reviewer_overrides,
      unresolved_conflict_recall: summary.readiness_safety.unresolved_conflict_recall,
      correct_abstention: summary.readiness_safety.correct_abstention,
      unsupported_selected_facts: summary.readiness_safety.unsupported_selected_facts,
    },
    shadow_invariants: summary.readiness_safety.shadow_invariants,
    per_case: results.map((row) => {
      const readiness = readinessSafetyFromRow(row);
      return {
        case_id: row.case_id,
        category: row.category || row.group || "",
        can_generate_pdf: row.can_generate_pdf,
        factually_correct: row.accuracy?.factually_correct ?? null,
        review_required_expected: expectedReviewRequired(row),
        would_block_pdf: Boolean(readiness.would_block_pdf),
        invariant_codes: readiness.invariant_codes || [],
        finding_count: asArray(readiness.findings).length,
      };
    }),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input;
  const outputPath = args.output || "reports/offline-eval-current-pipeline.jsonl";
  const summaryPath = args.summary || outputPath.replace(/\.jsonl$/i, "-summary.json");
  const readinessSummaryPath = args["readiness-summary"] ||
    (String(inputPath).includes("tree-dude-service-classification-60")
      ? "reports/readiness-safety-60-summary.json"
      : "");
  const limit = args.limit ? Number(args.limit) : null;
  const pipelineRoot = resolve(args["pipeline-root"] || process.cwd());

  if (!inputPath) {
    console.error("Usage: node scripts/eval-offline-dataset.js --input path/to/input.json-or-jsonl --output reports/offline-eval-current-pipeline.jsonl [--summary path] [--readiness-summary path] [--pipeline-root path]");
    process.exit(1);
  }

  await loadPipeline(pipelineRoot);
  const rows = readDatasetRows(inputPath);
  const selectedRows = Number.isFinite(limit) && limit > 0 ? rows.slice(0, limit) : rows;
  const results = [];

  selectedRows.forEach((row, index) => {
    const customerText = readCustomerText(row);
    const intake = readStructuredIntake(row);
    const draft = readDraft(row);
    const expected = readExpected(row);

    if (!customerText) {
      results.push({
        case_id: row.case_id || row.caseId || row.id || index + 1,
        id: row.id || "",
        group: row.group || row.difficulty || row.messiness || row.category || "",
        error: "No customer text field found.",
        expected,
      });
      return;
    }

    const validation = runOfflinePipeline(draft, customerText, intake);
    const actual = actualSummary(validation);
    const readinessSafety = validation.readiness_safety ||
      validation.alphaJson?.validation?.readiness_safety ||
      {};
    const result = {
      case_id: row.case_id || row.caseId || row.id || index + 1,
      id: row.id || "",
      group: row.group || "",
      difficulty: row.difficulty || row.messiness || "",
      category: row.category || row.email_case_type || "",
      email_present: row.email_present ?? null,
      input: customerText,
      expected,
      extracted_from_dataset: {
        name: row.extracted_name || "",
        phone: row.extracted_phone || "",
        email: row.extracted_email || "",
        service_address: row.extracted_service_address || "",
        work_requested: row.extracted_work_requested || "",
        prices: row.extracted_prices || null,
      },
      ...actual,
      can_generate_pdf: validation.can_generate_pdf,
      blocking_errors: validation.blocking_errors || [],
      warnings: validation.warnings || [],
      follow_ups: validation.follow_ups || [],
      structured_follow_ups: validation.structured_follow_ups || [],
      field_matches: {},
      accuracy: {},
      source_final: {},
      readiness_safety: readinessSafety,
      alphaJson: validation.alphaJson,
      validation,
    };
    result.field_matches = compareFields(expected, result);
    result.accuracy = evaluateAccuracy(row, expected, validation, customerText);
    result.source_final = sourceFinalFindings(validation);
    results.push(result);
  });

  const summary = summarizeRun(results);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${results.map((row) => JSON.stringify(row)).join("\n")}\n`);
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

  if (readinessSummaryPath) {
    mkdirSync(dirname(readinessSummaryPath), { recursive: true });
    writeFileSync(
      readinessSummaryPath,
      `${JSON.stringify(buildReadinessSafetyReport(results, summary), null, 2)}\n`,
    );
  }

  console.log(`Offline eval rows: ${results.length}`);
  console.log(`Pipeline root: ${pipelineRoot}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Summary: ${summaryPath}`);
  if (readinessSummaryPath) console.log(`Readiness summary: ${readinessSummaryPath}`);
  console.log(`Unsafe ready: ${summary.readiness_safety.incorrect_but_ready.count}`);
  console.log(`Shadow would-block: ${summary.readiness_safety.shadow_invariants.would_block_count}`);
  console.log(
    `Unsafe ready caught by shadow: ${summary.readiness_safety.incorrect_but_ready.caught_by_shadow_count}` +
    ` / ${summary.readiness_safety.incorrect_but_ready.count}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
