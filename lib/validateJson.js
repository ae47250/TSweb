import { normalizeTreeServiceText } from "./normalizeAlphaJson.js";
import { hasIndianaState, hasLocalIndianaTown, LOCAL_TOWN_PATTERN } from "./localTowns.js";
import { buildStructuredFollowUps } from "./followUpBuilder.js";

const ADDRESS_SUFFIX =
  "(?:Street|St|Road|Rd|Ave|Avenue|Drive|Dr|Lane|Ln|Court|Ct|Way|Blvd|Boulevard|Highway|Hwy|Route|State Route|County Road|CR|Pike|Circle|Cir|Place|Pl|Terrace|Ter|Trail|Trl|Parkway|Pkwy|Bend|Main)";

function looksLikeBadAddress(address) {
  if (!address) return false;
  const text = String(address);
  return (
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(text) ||
    /\b(somewhere|maybe|wants?|storm mess|phone|call|later|email|option|opt)\b/i.test(text) ||
    /^\s*[1-5]\s+\b(?:remove|removal|cut|drop|trim|haul|cleanup|clean)\b/i.test(text)
  );
}

function addressLooksLikeJobText(address) {
  return Boolean(address) && String(address).split(/\s+/).length > 10 && /\b(remove|trim|cleanup|tree|limb|brush|haul|quote|estimate)\b/i.test(address);
}

function mayNeedCityOrState(address) {
  return Boolean(address) && /\b\d+\b/.test(address) && !hasIndianaState(address) && !hasLocalIndianaTown(address);
}

function hasClearWorkScope(description, options) {
  const optionText = options.map((option) => option.description || "").join(" ");
  return /\b(tree|trees|limb|limbs|branch|branches|stump|brush|oak|pine|maple|elm|ash|cedar|sycamore|hickory|locust|birch|storm\s+limbs?|debris|cleanup|trim|trimming|remove|removal|drop)\b/i.test(`${description || ""} ${optionText}`);
}

function looksLikeMessyName(name) {
  if (!name) return false;
  return (
    /\b(customer|lady|guy|texted|maybe|phone|estimate|yesterday|cousin|office|call)\b/i.test(name) ||
    name.split(/\s+/).length > 4
  );
}

function optionLooksDirty(option) {
  return /\$|maybe|somewhere|lives?\b|email|phone/i.test(option?.description || "");
}

function optionDescriptionIsMissing(option) {
  const description = String(option?.description || "").trim();
  const title = String(option?.title || "").trim();
  const combined = `${title} ${description}`.trim();
  if (!combined) return true;
  return (
    /^service option [A-E]$/i.test(description) ||
    /^option [A-E]$/i.test(description) ||
    /\b(?:no descriptions?|description missing|scope not provided|scope missing|details missing)\b/i.test(combined)
  );
}

function pricedOptionsHaveNoScopeDescriptions(options) {
  const pricedOptions = options.filter((option) => option?.price?.display || option?.price?.amount);
  return pricedOptions.length > 0 && pricedOptions.every(optionDescriptionIsMissing);
}

function pricedOptionsHaveUnclearScope(options) {
  return options.some((option) => {
    if (!firmOptionPrice(option)) return false;
    const text = `${option?.title || ""} ${option?.description || ""}`;
    return option?.scope_unclear || /\bwork\s+scope\s+unclear\b|\bscope\s+unclear\b/i.test(text);
  });
}

function optionIsOnlyStumpWork(option) {
  const text = `${option?.title || ""} ${option?.description || ""}`;
  return /\bstumps?\b|\bgrind(?:ing)?\b/i.test(text) &&
    !/\b(remove|removal|take\s+down|cut\s+down|drop|trim|haul|cleanup|clean\s+up)\b/i.test(text);
}

function textHasRemovalScope(text) {
  return /\b(remove|removal|take\s+down|cut\s+down|drop)\b.{0,60}\btrees?\b|\btrees?\b.{0,60}\b(remove|removal|take\s+down|cut\s+down|drop)\b/i.test(
    text || "",
  );
}

function singleStumpPriceNeedsScopeConfirmation(rawText, description, options) {
  return options.length === 1 && optionIsOnlyStumpWork(options[0]) && textHasRemovalScope(`${rawText} ${description || ""}`);
}

function formatPrice(amount) {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

function firmOptionPrice(option) {
  const amount = Number(option?.price?.amount ?? option?.price?.min_amount);
  if (!Number.isFinite(amount) || amount <= 0 || option?.price?.is_unclear) return null;
  return {
    amount,
    display: option?.price?.display || formatPrice(amount),
    label: option?.label || "Option",
  };
}

function priceSpreadWarning(options) {
  const prices = options.map(firmOptionPrice).filter(Boolean).sort((a, b) => a.amount - b.amount);
  if (prices.length < 2) return "";
  const lowest = prices[0];
  const highest = prices.at(-1);
  if (highest.amount < lowest.amount * 3) return "";
  return `Large price spread: ${highest.label} ${highest.display} is 3x+ ${lowest.label} ${lowest.display}. Confirm price quote if this is correct. If not, edit info.`;
}

const SAFETY_ACCESS_TERMS =
  "power\\s*lines?|service\\s+drop|wire|wires|electric|blocked\\s+access|no\\s+access|access\\s+(?:is\\s+)?bad|aggressive\\s+dog|dog|gate\\s+(?:is\\s+)?(?:messed|damaged|broken|blocked)|blocked\\s+by\\s+trailer|trailer\\s+blocking\\s+access|call\\s+before\\s+entering|crew\\s+should\\s+call\\s+before\\s+entering|crew\\s+needs?\\s+caution|do\\s+not\\s+(?:enter|go\\s+in)|fence\\s+damage|neighbor\\s+fence|leaning\\s+toward|touching|across\\s+(?:drive|driveway|road|gate)|emergency|same-?day";

function hasSafetyOrAccessNote(text) {
  return new RegExp(`\\b(?:${SAFETY_ACCESS_TERMS})\\b`, "i").test(text || "");
}

function extractSafetyOrAccessNote(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const pattern = new RegExp(`[^.!?;]*\\b(?:${SAFETY_ACCESS_TERMS})\\b[^.!?;]*(?:[.!?;]|$)`, "i");
  const note = normalized.match(pattern)?.[0]?.trim().replace(/^[-,:\s]+/g, "").replace(/\s+/g, " ");
  if (!note) return "";
  const cleanedNote = normalizeTreeServiceText(note);
  return cleanedNote.length > 140 ? `${cleanedNote.slice(0, 137).trim()}...` : cleanedNote;
}

function textWithoutPhones(text) {
  return String(text || "").replace(/(?:\+?1[-./\s]?)?\(?\d{3}\)?[-./\s]?\d{3}[-./\s]?\d{4}/g, " ");
}

function latestFollowUpText(text) {
  const parts = String(text || "").split(/\bFollow-up\s+\d+\s*:/i);
  return parts.length > 1 ? parts.at(-1) : "";
}

function followUpHasClearWorkScope(text) {
  return /\b(remove|removal|trim|trimming|cut|drop|haul|cleanup|stump|grind|tree|trees|limb|brush)\b/i.test(latestFollowUpText(text));
}

function followUpHasFirmPrice(text) {
  return /\$?\s*[0-9][0-9,]{2,}\b/i.test(textWithoutPhones(latestFollowUpText(text)));
}

function hasAmbiguousWorkScope(text) {
  if (followUpHasClearWorkScope(text)) return false;
  return /\btake care of\b/i.test(text || "") && /\b(tree|trees|oak|pine|maple|elm|ash|cedar|sycamore|hickory|locust|birch|limb|branch)\b/i.test(text || "");
}

function followUpHasClearTreeCount(text) {
  return /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:[a-z]+\s+){0,4}trees?\b/i.test(latestFollowUpText(text));
}

function hasVagueTreeCount(text) {
  if (hasConflictingCountAndSpeciesPair(text)) return true;
  if (followUpHasClearTreeCount(text)) return false;
  return /\b(?:several|multiple|some|a\s+few|few)\s+(?:[a-z]+\s+){0,4}trees?\b|\bone\s+tree\s+or\s+(?:several|more|multiple)\b|\ba?\s*tree\s+or\s+maybe\s+more\b/i.test(text || "");
}

const TREE_SPECIES_TERMS = "pine|oak|maple|elm|ash|cedar|sycamore|hickory|locust|birch|spruce|walnut|cherry";
const TREE_COUNT_WORDS = new Map([
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10],
]);

const AUTO_TREE_COUNT_MAX = 15;
const REVIEW_TREE_COUNT_MAX = 30;
const PHONE_LIKE_DIGIT_PATTERN = /\b(?:\d[\s().-]?){6,}\d\b/g;

function countTokenToNumber(value) {
  const text = String(value || "").toLowerCase();
  if (/^\d+$/.test(text)) {
    const numeric = Number(text);
    return numeric > 0 && numeric <= AUTO_TREE_COUNT_MAX ? numeric : null;
  }
  return TREE_COUNT_WORDS.get(text) || null;
}

function hasConflictingCountAndSpeciesPair(value) {
  const text = String(value || "");
  const numberPattern = "\\d+|one|two|three|four|five|six|seven|eight|nine|ten";
  const directConflictMatch = text.match(
    new RegExp(`\\b(${numberPattern}|on)\\s+trees?\\s+(?:and\\s+)?(?:${TREE_SPECIES_TERMS})s?\\s+and\\s+(?:${TREE_SPECIES_TERMS})s?\\b`, "i"),
  );
  if (directConflictMatch) {
    const explicitCount = directConflictMatch[1].toLowerCase() === "on" ? 1 : countTokenToNumber(directConflictMatch[1]);
    return Boolean(explicitCount && explicitCount !== 2);
  }
  const explicitMatch = text.match(new RegExp(`\\b(${numberPattern})\\s+(?:[a-z]+\\s+){0,4}trees?\\b`, "i")) ||
    text.match(new RegExp(`\\b(${numberPattern})\\s+(?:dead\\s+|large\\s+|big\\s+|small\\s+|leaning\\s+|fallen\\s+)?(?:${TREE_SPECIES_TERMS})s?\\b`, "i")) ||
    text.match(/\b(on)\s+tree\b/i);
  const speciesPairMatch = text.match(new RegExp(`\\b(?:${TREE_SPECIES_TERMS})s?\\s+and\\s+(?:${TREE_SPECIES_TERMS})s?\\b`, "i"));
  if (!explicitMatch || !speciesPairMatch) return false;
  const explicitCount = explicitMatch[1].toLowerCase() === "on" ? 1 : countTokenToNumber(explicitMatch[1]);
  return Boolean(explicitCount && explicitCount !== 2);
}

function isAcceptedTreeCountOverride(value) {
  const text = String(value || "").trim();
  return Boolean(text && !/^Unknown$/i.test(text));
}

function isTreeCountStillUnclearOk(value) {
  return /^Still unclear but OK to proceed$/i.test(String(value || "").trim());
}

function hasNonFirmPriceLanguage(text) {
  if (followUpHasFirmPrice(text)) return false;
  const withoutPhones = textWithoutPhones(text);
  return /\b(?:around|about|roughly|maybe)\s+\$?\s*[0-9][0-9,]*(?:k|000)?\b|\bprice\s+depends\b/i.test(withoutPhones);
}

function textWithoutPhoneLikeNumbers(text) {
  return textWithoutPhones(text).replace(PHONE_LIKE_DIGIT_PATTERN, " ");
}

function textWithoutPriceLikeNumbers(text) {
  return textWithoutPhoneLikeNumbers(text)
    .replace(/\$?\s*(?:[0-9]{3,}|[0-9]{1,3},[0-9]{3})\s*\/\s*\$?\s*(?:[0-9]{3,}|[0-9]{1,3},[0-9]{3})/g, " ")
    .replace(/\$\s*[0-9][0-9,]*(?:\.\d{2})?/g, " ")
    .replace(/\b[0-9]{1,3},[0-9]{3}\b/g, " ");
}

function textWithoutAddressLikeNumbers(text) {
  return textWithoutPriceLikeNumbers(text)
    .replace(new RegExp(`\\b\\d+\\s+(?:[A-Za-z0-9.]+\\s+){0,5}${ADDRESS_SUFFIX}\\b(?:\\s+${LOCAL_TOWN_PATTERN})?(?:,?\\s+(?:Indiana|IN))?`, "gi"), " ")
    .replace(new RegExp(`\\b\\d+\\s+(?:[A-Za-z0-9.]+\\s+){1,4}${LOCAL_TOWN_PATTERN}\\b(?:,?\\s+(?:Indiana|IN))?`, "gi"), " ");
}

function numberNeedsTreeCountConfirmation(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > AUTO_TREE_COUNT_MAX && count <= REVIEW_TREE_COUNT_MAX;
}

function hasTreeCountConfirmationLanguage(text) {
  const cleaned = textWithoutAddressLikeNumbers(text || "");
  const treeMatch = cleaned.match(/\b(\d+)\s+(?:[a-z]+\s+){0,4}trees?\b/i);
  if (treeMatch && numberNeedsTreeCountConfirmation(treeMatch[1])) return true;

  const speciesMatch = cleaned.match(
    new RegExp(`\\b(\\d+)\\s+(?:dead\\s+|large\\s+|big\\s+|small\\s+|leaning\\s+|fallen\\s+)?(?:${TREE_SPECIES_TERMS})s?\\b`, "i"),
  );
  return Boolean(speciesMatch && numberNeedsTreeCountConfirmation(speciesMatch[1]));
}

function hasTreeCountConfirmationUncertainty(json) {
  const uncertainties = Array.isArray(json?.normalization?.uncertainties) ? json.normalization.uncertainties : [];
  return uncertainties.some((item) =>
    /tree_count|tree count|count/i.test(String(item?.field || "")) &&
    /unusually high|large number|ignored as a tree count|explicit confirmation|needs explicit confirmation|needs confirmation/i.test(String(item?.issue || "")),
  );
}

function hasAmbiguousStumpInclusion(text) {
  const followUp = latestFollowUpText(text);
  if (/\bstump\b/i.test(followUp) && /\b(grind|grinding|included|excluded|separate|option|add-?on)\b/i.test(followUp)) return false;
  return /\bstump\b.{0,24}\bmaybe\b|\bmaybe\b.{0,24}\bstump\b|\bstump\b.{0,24}\bincluded\??/i.test(text || "");
}

function hasConditionalCleanupOrHaul(text, options) {
  if (options.length > 1) return false;
  const normalizedText = normalizeTreeServiceText(text || "");
  const followUp = latestFollowUpText(normalizedText);
  if (/\b(cleanup|clean up|haul|haul away)\b/i.test(followUp) && followUpHasFirmPrice(text)) return false;
  return /\b(?:cleanup|clean(?:\s+it)?\s+up|haul(?:\s+away)?)\s+if\s+(?:they|he|she|customer)\s+wants?\b/i.test(normalizedText);
}

function hasConfirmedScopeOrPropertyResponsibility(text) {
  const normalizedText = normalizeTreeServiceText(text || "");
  const confirmationText = [normalizedText, latestFollowUpText(normalizedText)].filter(Boolean).join(" ");
  return (
    /\b(?:customer|homeowner|owner|neighbor|property\s+owner)\b.{0,50}\b(?:confirmed|approved|okayed|granted|gave|has)\b.{0,40}\b(?:permission|access|responsibility|responsible|approval)\b/i.test(confirmationText) ||
    /\b(?:permission|access|responsibility|responsible|approval)\b.{0,50}\b(?:confirmed|approved|okayed|granted|given)\b/i.test(confirmationText) ||
    /\b(?:customer|homeowner|owner|property\s+owner)\b.{0,40}\b(?:is\s+)?responsible\b/i.test(confirmationText)
  );
}

function hasUnclearScopeOrPropertyResponsibility(text) {
  const normalizedText = normalizeTreeServiceText(text || "");
  if (hasConfirmedScopeOrPropertyResponsibility(normalizedText)) return false;
  return (
    /\bscope\s*\/\s*property\s+responsibility\s+unclear\b/i.test(normalizedText) ||
    /\b(?:scope|property|responsibility|neighbor|owner)\b.{0,40}\b(?:unclear|unknown|not\s+sure|needs?\s+clarification|needs?\s+review)\b/i.test(normalizedText) ||
    /\b(?:unclear|unknown|not\s+sure|needs?\s+clarification|needs?\s+review)\b.{0,40}\b(?:scope|property|responsibility|neighbor|owner)\b/i.test(normalizedText)
  );
}

export function validateAlphaJson(input) {
  const json = structuredClone(input || {});
  const blocking = [];
  const warnings = [];
  const followUps = [];

  const rawText = json?.raw_input?.customer_text || "";
  const address = json?.job?.service_address?.display?.trim();
  const description = json?.job?.description?.trim();
  const customerName = json?.customer?.name?.trim();
  const phone = json?.customer?.phone_display?.trim() || json?.customer?.phone_primary?.trim();
  const email = json?.customer?.email?.trim();
  const treeCount = json?.job?.tree_details?.tree_count?.trim();
  const treeCountOverride = String(json?.normalization?.field_evidence?.tree_count_override || "").trim();
  const acceptedTreeCountOverride = isAcceptedTreeCountOverride(treeCountOverride);
  const options = Array.isArray(json?.service_options?.items) ? json.service_options.items : [];
  const optionsNeedScopeDescriptions = pricedOptionsHaveNoScopeDescriptions(options);
  const optionsHaveUnclearScope = pricedOptionsHaveUnclearScope(options);
  const treeCountIsVague = !acceptedTreeCountOverride && hasVagueTreeCount(rawText);
  const treeCountNeedsConfirmation =
    !acceptedTreeCountOverride &&
    (hasTreeCountConfirmationUncertainty(json) || hasTreeCountConfirmationLanguage(rawText));

  if (!address || /unknown|tbd|placeholder/i.test(address)) {
    blocking.push("Missing service address.");
    followUps.push("What is the exact service address for this job?");
  } else if (looksLikeBadAddress(address)) {
    blocking.push("Service address looks unclear.");
    followUps.push("What is the exact service address for this job?");
  }
  if (!phone && !email) {
    blocking.push("Missing customer phone or email.");
    followUps.push("What phone number or email should Alpha Tree Service use for this customer?");
  }
  if (/^Unknown$/i.test(treeCountOverride)) {
    blocking.push("Tree count is marked unknown.");
    followUps.push("How many trees should be included in this estimate?");
  } else if (treeCountNeedsConfirmation || treeCountIsVague) {
    blocking.push("Tree count is unclear.");
    followUps.push("How many trees should be included in this estimate?");
  }
  if (optionsNeedScopeDescriptions) {
    blocking.push("Priced option descriptions are missing.");
    followUps.push("What does each priced option include?");
  } else if (!acceptedTreeCountOverride && !treeCount && !treeCountIsVague && !treeCountNeedsConfirmation && !optionsHaveUnclearScope && !hasClearWorkScope(description, options)) {
    blocking.push("Missing tree count or clear scope.");
    followUps.push("How many trees, limbs, stumps, or brush areas are included?");
  }
  if (!description) {
    blocking.push("Missing job description.");
    followUps.push("What work is being quoted?");
  }
  if (options.length < 1) {
    blocking.push("Missing priced service option.");
    followUps.push(
      treeCount
        ? "What priced option should appear on the estimate?"
        : "How many trees are included, and what priced option should appear on the estimate?",
    );
  }
  if (hasAmbiguousWorkScope(rawText)) {
    blocking.push("Unclear work scope: remove, trim, or another service.");
    followUps.push("Should this job be removal, trimming, or another specific service?");
  }
  if (hasUnclearScopeOrPropertyResponsibility(rawText)) {
    blocking.push("Property responsibility or work scope is unclear.");
    followUps.push("Clarify the work scope and who is responsible before sending this estimate.");
  }
  if (optionsHaveUnclearScope) {
    blocking.push("Work scope unclear; confirm what this price covers.");
    followUps.push("Confirm what work each displayed price covers before sending this estimate.");
  }
  if (singleStumpPriceNeedsScopeConfirmation(rawText, description, options)) {
    blocking.push("Work scope unclear; confirm what this price covers.");
    followUps.push("Confirm whether the stump price covers stump work only or the full job.");
  }
  if (hasNonFirmPriceLanguage(rawText)) {
    blocking.push("Price is not firm enough for a customer-facing estimate.");
    followUps.push("What firm price should appear on the estimate?");
  }
  if (hasAmbiguousStumpInclusion(rawText)) {
    blocking.push("Stump inclusion is unclear.");
    followUps.push("Is stump grinding included, excluded, or a separate priced option?");
  }
  if (hasConditionalCleanupOrHaul(rawText, options)) {
    blocking.push("Cleanup or haul-away scope is unclear.");
    followUps.push("Should cleanup or haul-away be included, excluded, or listed as a separate priced option?");
  }
  if (options.length > 4 || json?.layout_flags?.over_normal_option_limit) {
    warnings.push("More than four options were provided; review final estimate formatting before sending.");
  }
  if (hasSafetyOrAccessNote(`${rawText} ${description}`)) {
    const safetyNote = extractSafetyOrAccessNote(rawText) || extractSafetyOrAccessNote(description);
    warnings.push(safetyNote ? `Safety/access note: ${safetyNote}` : "Safety or access note needs contractor review.");
  }
  if (customerName && looksLikeMessyName(customerName)) {
    warnings.push("Customer name may need review.");
  }
  if (mayNeedCityOrState(address)) {
    warnings.push("Service address may need city or state.");
  }
  if (addressLooksLikeJobText(address)) {
    warnings.push("Service address may include extra job notes.");
  }
  if (options.some(optionLooksDirty)) {
    warnings.push("One or more option descriptions may need cleanup.");
  }
  if (isTreeCountStillUnclearOk(treeCountOverride)) {
    warnings.push("Tree count is still unclear but was OK'd when the estimate was created.");
  } else if (/^\d\+\s+trees$/i.test(treeCountOverride || treeCount)) {
    warnings.push(`Tree count is set to ${(treeCountOverride || treeCount).replace(/\s+trees$/i, "")}; confirm exact count before final quote if needed.`);
  }

  const orderedOptions = options.some((option) => option.preserve_order)
    ? [...options]
    : [...options].sort((a, b) => {
        const priceA = a.price?.amount ?? a.price?.min_amount ?? Number.MAX_SAFE_INTEGER;
        const priceB = b.price?.amount ?? b.price?.min_amount ?? Number.MAX_SAFE_INTEGER;
        return Number(priceA) - Number(priceB);
      });
  const sortedOptions = orderedOptions
    .map((option) => ({
      ...option,
      price: option.price || {},
      numericPrice: option.price?.amount ?? option.price?.min_amount ?? Number.MAX_SAFE_INTEGER,
    }))
    .slice(0, 4)
    .map((option, index) => {
      const { numericPrice, ...rest } = option;
      return {
        ...rest,
        label: `Option ${String.fromCharCode(65 + index)}`,
        sort_order: index + 1,
      };
    });

  sortedOptions.forEach((option, index) => {
    if (!option.title || !option.description) {
      blocking.push(`${option.label || `Option ${index + 1}`} is missing title or description.`);
    }
    if (!option.price?.display || option.price?.is_unclear) {
      blocking.push(`${option.label || `Option ${index + 1}`} is missing a clear price.`);
      followUps.push(`What price should appear for ${option.label || `Option ${index + 1}`}?`);
    }
  });
  const spreadWarning = priceSpreadWarning(sortedOptions);
  if (spreadWarning) warnings.push(spreadWarning);

  json.service_options = { ...(json.service_options || {}), items: sortedOptions };
  json.layout_flags = {
    ...(json.layout_flags || {}),
    option_count: sortedOptions.length,
    over_normal_option_limit: Boolean(json?.layout_flags?.over_normal_option_limit || options.length > 4),
    long_notes: (json?.notes?.display_notes || "").length > 500,
    likely_two_page_pdf: (json?.job?.description || "").length + (json?.notes?.display_notes || "").length > 1200,
  };
  const blockingErrors = [...new Set(blocking)];
  const validationWarnings = [...new Set([...(json.validation?.warnings || []), ...warnings])];
  const treeDudeFollowUps = [...new Set(followUps)];
  const structuredFollowUps = buildStructuredFollowUps({
    alphaJson: json,
    blocking_errors: blockingErrors,
    warnings: validationWarnings,
    follow_ups: treeDudeFollowUps,
  });

  json.validation = {
    ...(json.validation || {}),
    blocking_errors: blockingErrors,
    warnings: validationWarnings,
    tree_dude_follow_ups: treeDudeFollowUps,
    structured_follow_ups: structuredFollowUps,
    missing_required_fields: blockingErrors,
    can_generate_pdf: blocking.length === 0,
    issue_status: blocking.length ? "blocking error + follow-up" : warnings.length ? "warning" : "none",
    blocking_errors_require_follow_up: true,
  };

  return {
    alphaJson: json,
    can_generate_pdf: blocking.length === 0,
    blocking_errors: json.validation.blocking_errors,
    warnings: json.validation.warnings,
    follow_ups: json.validation.tree_dude_follow_ups,
    structured_follow_ups: json.validation.structured_follow_ups,
  };
}
