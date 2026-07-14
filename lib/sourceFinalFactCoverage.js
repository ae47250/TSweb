import { normalizeContactFields } from "./contactNormalizer.js";

export const SOURCE_FINAL_FACT_COVERAGE_VERSION = "source-final-fact-coverage-v0.2";

const MATERIAL_FACTS = new Set([
  "option_label",
  "price",
  "work_actions",
  "species",
  "tree_quantity",
  "stump_quantity",
  "stump_treatment",
  "debris_disposition",
  "target_qualifiers",
]);

const WARNING_FACTS = new Set([
  "condition_qualifiers",
  "access_qualifiers",
  "safety_qualifiers",
]);

const FACT_DEFINITIONS = [
  ["option_label", "Option label"],
  ["price", "Price"],
  ["work_actions", "Work actions"],
  ["species", "Tree species/object"],
  ["tree_quantity", "Tree quantity"],
  ["stump_quantity", "Stump quantity"],
  ["stump_treatment", "Stump treatment"],
  ["debris_disposition", "Debris disposition"],
  ["target_qualifiers", "Target/location qualifier"],
  ["condition_qualifiers", "Condition"],
  ["access_qualifiers", "Access qualifier"],
  ["safety_qualifiers", "Safety qualifier"],
];

const FACT_CODES = {
  option_label: "INVALID_OPTION_LABEL_SEQUENCE",
  price: "SOURCE_OPTION_PRICE_CHANGED",
  work_actions: "SOURCE_OPTION_ACTION_OMITTED",
  species: "SOURCE_SPECIES_CHANGED",
  tree_quantity: "SOURCE_TREE_QUANTITY_CHANGED",
  stump_quantity: "SOURCE_STUMP_QUANTITY_CHANGED",
  stump_treatment: "SOURCE_STUMP_TREATMENT_CHANGED",
  debris_disposition: "SOURCE_DEBRIS_DISPOSITION_CHANGED",
  target_qualifiers: "SOURCE_TARGET_QUALIFIER_OMITTED",
  condition_qualifiers: "SOURCE_CONDITION_QUALIFIER_REVIEW",
  access_qualifiers: "SOURCE_ACCESS_QUALIFIER_REVIEW",
  safety_qualifiers: "SOURCE_SAFETY_QUALIFIER_REVIEW",
};

const CONTACT_FACT_DEFINITIONS = [
  ["customer_phone", "Customer phone", "SOURCE_PHONE_CHANGED"],
  ["customer_email", "Customer email", "SOURCE_EMAIL_CHANGED"],
  ["service_address", "Service address", "SOURCE_SERVICE_ADDRESS_CHANGED"],
];

const SPECIES = [
  "ornamental pear",
  "ash",
  "beech",
  "birch",
  "cedar",
  "cherry",
  "elm",
  "hickory",
  "locust",
  "maple",
  "oak",
  "pear",
  "pine",
  "poplar",
  "spruce",
  "sycamore",
  "walnut",
  "willow",
];

const ADDRESS_SUFFIX =
  "(?:Street|St|Road|Rd|Ave|Avenue|Drive|Dr|Lane|Ln|Court|Ct|Way|Blvd|Boulevard|Highway|Hwy|Route|Pike|Circle|Cir|Place|Pl|Terrace|Ter|Trail|Trl|Parkway|Pkwy|Bend|Main)";

const NUMBER_WORDS = {
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
  both: 2,
};

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function compact(value) {
  return asString(value).replace(/\s+/g, " ").trim();
}

function normalizeFactText(value) {
  return compact(value)
    .toLowerCase()
    .replace(/\bbrsh\b/g, "brush")
    .replace(/\bhawlin\b/g, "hauling")
    .replace(/\bdebrs?\b/g, "debris")
    .replace(/\bstmp\b/g, "stump")
    .replace(/\bclnup\b/g, "cleanup")
    .replace(/\bn\b/g, "and")
    .replace(/\bft\b/g, "foot")
    .replace(/\bflush-cut\b/g, "flush cut")
    .replace(/[^a-z0-9\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhoneForEquality(value) {
  const digits = compact(value).replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function normalizeEmailForEquality(value) {
  return compact(value).toLowerCase();
}

function normalizeAddressForEquality(value) {
  return compact(value)
    .toLowerCase()
    .replace(/\b(?:street|st)\b/g, "st")
    .replace(/\b(?:road|rd)\b/g, "rd")
    .replace(/\b(?:avenue|ave)\b/g, "ave")
    .replace(/\b(?:drive|dr)\b/g, "dr")
    .replace(/\b(?:lane|ln)\b/g, "ln")
    .replace(/\b(?:court|ct)\b/g, "ct")
    .replace(/\b(?:boulevard|blvd)\b/g, "blvd")
    .replace(/\b(?:highway|hwy)\b/g, "hwy")
    .replace(/\b(?:indiana|in)\b/g, " ")
    .replace(/\b\d{5}(?:-\d{4})?\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contactEqualityResult({ fact, label, code, sourceValue, finalValue, normalize }) {
  const normalizedSource = normalize(sourceValue);
  const normalizedFinal = normalize(finalValue);
  const matches = Boolean(normalizedFinal) && normalizedSource === normalizedFinal;
  const status = matches ? "ok" : normalizedFinal ? "changed" : "missing";
  const message = matches
    ? ""
    : `${label} from the source note ${normalizedFinal ? "does not match" : "is missing from"} the final estimate. Confirm or correct it before confirming the estimate.`;
  return {
    option_label: "",
    fact,
    fact_label: label,
    source_value: sourceValue,
    final_value: finalValue,
    status,
    blocks_pdf: !matches,
    warning_only: false,
    code,
    message,
  };
}

function contactEqualityCoverage({ rawText, finalCustomer, finalJob }) {
  if (!finalCustomer || typeof finalCustomer !== "object") {
    return { source: {}, final: {}, results: [] };
  }
  const sourceContact = normalizeContactFields({ rawText: originalTextBeforeFollowUps(rawText) });
  const source = {
    customer_phone: sourceContact.phone?.value || "",
    customer_email: sourceContact.email?.value || "",
    service_address: sourceContact.address?.completeness === "complete" ? sourceContact.address?.value || "" : "",
  };
  const final = {
    customer_phone: finalCustomer.phone_primary || finalCustomer.phone_display || "",
    customer_email: finalCustomer.email || "",
    service_address: finalJob?.service_address?.display || "",
  };
  const normalizers = {
    customer_phone: normalizePhoneForEquality,
    customer_email: normalizeEmailForEquality,
    service_address: normalizeAddressForEquality,
  };
  const results = CONTACT_FACT_DEFINITIONS
    .filter(([fact]) => Boolean(source[fact]))
    .map(([fact, label, code]) => contactEqualityResult({
      fact,
      label,
      code,
      sourceValue: source[fact],
      finalValue: final[fact],
      normalize: normalizers[fact],
    }));
  return { source, final, results };
}

function originalTextBeforeFollowUps(text) {
  return String(text || "").split(/\bFollow-up\s+\d+\s*:/i)[0] || "";
}

function countTokenToNumber(token) {
  const normalized = normalizeFactText(token);
  if (/^\d+$/.test(normalized)) {
    const value = Number(normalized);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  return NUMBER_WORDS[normalized] || null;
}

function numberWord(value) {
  const match = Object.entries(NUMBER_WORDS).find(([, number]) => number === value && value !== 2);
  if (match) return match[0];
  if (value === 2) return "two";
  return String(value || "");
}

function amountTokensInText(value) {
  return [...String(value || "").matchAll(/(?<![\w@.-])\$?\s*(\d{1,3}(?:,\d{3})+|\d{3,6})(?![\w@-])/g)]
    .map((match) => Number(String(match[1] || "").replace(/,/g, "")))
    .filter((amount) => Number.isFinite(amount) && amount > 0);
}

function removePriceLikeAmounts(value) {
  return String(value || "")
    .replace(/\$\s*\d[\d,]*/g, " ")
    .replace(/(?<![\w@.-])\d{3,6}(?:,\d{3})*(?![\w@-])/g, " ");
}

function optionAmount(option = {}) {
  const amount = Number(option?.price?.amount ?? option?.price?.min_amount);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null;
}

function optionText(option = {}) {
  const title = compact(option.title);
  const description = compact(option.description);
  if (title && description && normalizeFactText(title) === normalizeFactText(description)) return title;
  return compact([title, description].filter(Boolean).join(" "));
}

function labelTokenFromText(value) {
  const text = compact(value);
  const letterMatch = text.match(/^(?:Option|Opt)?\s*([A-E])\b/i);
  if (letterMatch) return letterMatch[1].toUpperCase();
  const numberMatch = text.match(/^(?:Option|Opt)?\s*([1-5])\b/i);
  if (!numberMatch) return "";
  return String.fromCharCode(64 + Number(numberMatch[1]));
}

function labelTokenForOption(option = {}, index = 0) {
  return labelTokenFromText(option.raw_label || option.label || option.title || option.name || "") ||
    String.fromCharCode(65 + index);
}

function isReferencedSourceOptionLabel(text, match) {
  const start = match.index ?? 0;
  const before = String(text || "").slice(Math.max(0, start - 40), start);
  return /\b(?:includes?|including|included|same\s+as|based\s+on)\s+$/i.test(before);
}

function labelMatchesInText(text) {
  const explicit = [...text.matchAll(/\b(?:Option|Opt)\s*([A-E]|[1-5])\b\s*[:.)-]?/gi)]
    .filter((match) => !isReferencedSourceOptionLabel(text, match))
    .map((match) => {
      const token = /^[1-5]$/.test(match[1])
        ? String.fromCharCode(64 + Number(match[1]))
        : match[1].toUpperCase();
      return {
        token,
        label: `Option ${token}`,
        start: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
      };
    });
  if (new Set(explicit.map((label) => label.token)).size >= 2) return explicit;

  return [...text.matchAll(/(^|[\s,.;])([A-E])\s*[:.)-]?\s+(?=(?:remove|rmv|drop|cut|tree|trim|stump|grind|haul|chip|clean|cleanup|leave|stack|full)\b)/gi)]
    .map((match) => {
      const start = (match.index ?? 0) + match[1].length;
      const token = match[2].toUpperCase();
      return {
        token,
        label: `Option ${token}`,
        start,
        end: start + match[0].slice(match[1].length).length,
      };
    });
}

export function explicitSourceOptionsForCoverage(rawText = "") {
  const text = originalTextBeforeFollowUps(String(rawText || ""));
  const labels = labelMatchesInText(text)
    .sort((left, right) => left.start - right.start);
  const uniqueTokens = new Set(labels.map((label) => label.token));
  if (uniqueTokens.size < 2) return [];

  return labels.map((label, index) => {
    const next = labels[index + 1];
    const segment = text.slice(label.end, next ? next.start : text.length);
    const totalMatch = segment.match(/\btotal\b/i);
    const amountsBeforeTotal = totalMatch ? amountTokensInText(segment.slice(0, totalMatch.index)) : [];
    const amounts = amountsBeforeTotal.length ? amountsBeforeTotal : amountTokensInText(segment);
    return {
      label: label.label,
      token: label.token,
      amount: amounts.at(-1) || null,
      segment,
    };
  });
}

function explicitSourcePreamble(rawText = "") {
  const text = originalTextBeforeFollowUps(String(rawText || ""));
  const labels = labelMatchesInText(text)
    .sort((left, right) => left.start - right.start);
  if (new Set(labels.map((label) => label.token)).size < 2) return "";
  return text.slice(0, labels[0].start);
}

function speciesFromText(value) {
  const text = normalizeFactText(String(value || "")
    .replace(new RegExp(`\\b\\d+\\s+(?:[A-Za-z0-9.]+\\s+){0,5}${ADDRESS_SUFFIX}\\b`, "gi"), " "));
  for (const item of SPECIES) {
    const singular = item.replace(" ", "\\s+");
    const plural = `${item}s`.replace(" ", "\\s+");
    if (new RegExp(`\\b${singular}\\b`).test(text)) return item;
    if (new RegExp(`\\b${plural}\\b`).test(text)) return item;
  }
  return "";
}

function treeQuantityFromText(value) {
  const text = normalizeFactText(value);
  const count = "(one|two|three|four|five|six|seven|eight|nine|ten|both|[1-9]|10)";
  const speciesPattern = SPECIES.map((item) => `${item.replace(" ", "\\s+")}s?`).join("|");
  const countedSpeciesMatches = [...text.matchAll(new RegExp(`\\b${count}\\s+(?:dead\\s+|large\\s+|big\\s+|small\\s+|leaning\\s+|fallen\\s+)?(?:${speciesPattern})\\b`, "gi"))]
    .map((match) => countTokenToNumber(match[1]))
    .filter((amount) => Number.isFinite(amount) && amount > 0);
  if (countedSpeciesMatches.length > 1) {
    return countedSpeciesMatches.reduce((sum, amount) => sum + amount, 0);
  }
  const treeMatch = text.match(new RegExp(`\\b${count}\\s+(?:[a-z]+\\s+){0,4}trees?\\b`, "i"));
  if (treeMatch) return countTokenToNumber(treeMatch[1]);
  const speciesCount = text.match(new RegExp(`\\b${count}\\s+(?:dead\\s+|large\\s+|big\\s+|small\\s+|leaning\\s+|fallen\\s+)?(?:${speciesPattern})\\b`, "i"));
  if (speciesCount) return countTokenToNumber(speciesCount[1]);
  if (/\bboth\b/.test(text) && /\b(?:trees?|stumps?|maples?|oaks?|pines?|spruces?|walnuts?|cedars?|ashes|birches|sycamores?)\b/.test(text)) return 2;
  return null;
}

function stumpQuantityFromText(value) {
  const text = normalizeFactText(removePriceLikeAmounts(value));
  const count = "(one|two|three|four|five|six|seven|eight|nine|ten|both|[1-9]|10)";
  const beforeStump = text.match(new RegExp(`\\b${count}\\s+stumps?\\b`, "i"));
  if (beforeStump) return countTokenToNumber(beforeStump[1]);
  const afterStump = text.match(new RegExp(`\\bstumps?\\s+(?:x\\s*)?${count}\\b`, "i"));
  if (afterStump) return countTokenToNumber(afterStump[1]);
  return null;
}

function impliedStumpQuantityFromText(value, treeQuantity = null) {
  const text = normalizeFactText(removePriceLikeAmounts(value));
  if (!Number.isFinite(treeQuantity) || treeQuantity < 2) return null;
  if (!/\bstumps\b/.test(text)) return null;
  if (!/\b(?:grind(?:ing)?|cut|flush cut)\b/.test(text)) return null;
  return treeQuantity;
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function workActionsFromText(value) {
  const text = normalizeFactText(value);
  const actions = [];
  if (/\b(?:remove|removal|rmv|take down|cut down|drop|tree down|tree out)\b/.test(text)) actions.push("remove_tree");
  if (/\b(?:trim|trimming|prune|pruning|crown)\b/.test(text)) actions.push("trim_tree");
  if (/\b(?:limbs?|branches?)\b/.test(text) && /\b(?:remove|removal|cut|clear|cleanup|clean up|trim|prune)\b/.test(text)) actions.push("limb_work");
  if (/\b(?:storm|wind|downed)\b/.test(text) && /\b(?:cleanup|clean up|clear|debris|limbs?|branches?)\b/.test(text)) actions.push("storm_cleanup");
  if (/\broot\s+grind(?:ing)?\b|\bgrind(?:ing)?\s+(?:the\s+)?roots?\b/.test(text)) actions.push("grind_stump");
  if (/\bgrind(?:ing)?\b.{0,30}\bstumps?\b|\bstumps?\b.{0,30}\bgrind(?:ing)?\b/.test(text)) actions.push("grind_stump");
  if (/\bflush cut\b.{0,30}\bstumps?\b|\bcut\b.{0,30}\bstumps?\b.{0,30}\blow\b|\bstumps?\b.{0,30}\bcut\b.{0,30}\blow\b/.test(text)) actions.push("cut_stump_low");
  if (/\bchip(?:ping)?\b.{0,30}\b(?:brush|limbs?|branches?)\b|\b(?:brush|limbs?|branches?)\b.{0,30}\bchip(?:ping)?\b|\bchip\s+brush\b/.test(text)) actions.push("chip_brush");
  if (/\b(?:haul|hual|hawl)\b.{0,30}\bbrush\b|\bbrush\b.{0,30}\b(?:haul|hual|hawl)\b/.test(text)) actions.push("haul_brush");
  if (/\b(?:haul|hual|hawl)\b.{0,30}\b(?:debris|logs?|wood)\b|\b(?:debris|logs?|wood)\b.{0,30}\b(?:haul|hual|hawl)\b|\bdebris\s+haul\b|\bhaul\s+debris\b|\blog\s+hauling\b|\bwood\s+removal\b/.test(text)) actions.push("haul_debris");
  if (!actions.includes("haul_brush") && !actions.includes("haul_debris") && /\b(?:haul|hauling|hauled|hual|hawl)\b/.test(text)) actions.push("haul_debris");
  if (/\b(?:cleanup|clean up|clean the work area|clean work area|clean yard|clean the yard|site cleanup|final cleanup|yard protection cleanup|access cleanup|yard cleanup|rake(?:[-\s]?up)?)\b/.test(text)) actions.push("cleanup");
  return unique(actions);
}

function debrisDispositionFromText(value) {
  const text = normalizeFactText(value);
  const values = [];
  if (/\bleave\b.{0,30}\bbrush\b|\bbrush\s+stays?\b/.test(text)) values.push("leave_brush");
  if (/\bleave\b.{0,30}\bdebris\b|\bdebris\s+stays?\b/.test(text)) values.push("leave_debris");
  if (/\bleave\b.{0,30}\bwood\b|\bwood\s+stays?\b|\bleave\s+wood\s+on\s+site\b|\bstack\s+(?:wood|firewood)\b/.test(text)) values.push("leave_wood_on_site");
  if (/\bleave\b.{0,30}\blogs?\b|\blogs?\s+stays?\b/.test(text)) values.push("leave_logs");
  if (/\bstack\b.{0,30}\b(?:wood|firewood)\b|\b(?:wood|firewood)\b.{0,30}\bstack\b/.test(text)) values.push("leave_wood_on_site");
  if (/\bstack\b.{0,30}\blogs?\b|\blogs?\b.{0,30}\bstack\b/.test(text)) values.push("stack_logs");
  if (/\b(?:haul|hual|hawl)\b.{0,30}\bbrush\b|\bbrush\b.{0,30}\b(?:haul|hual|hawl)\b/.test(text)) values.push("haul_brush");
  if (/\b(?:haul|hual|hawl)\b.{0,30}\b(?:debris|logs?|wood)\b|\b(?:debris|logs?|wood)\b.{0,30}\b(?:haul|hual|hawl)\b|\bdebris\s+haul\b|\bhaul\s+debris\b|\blog\s+hauling\b|\bwood\s+removal\b/.test(text)) values.push("haul_debris");
  if (!values.includes("haul_brush") && !values.includes("haul_debris") && /\b(?:haul|hauling|hauled|hual|hawl)\b/.test(text)) values.push("haul_debris");
  if (/\bchip(?:ping)?\b.{0,30}\b(?:brush|limbs?|branches?)\b|\b(?:brush|limbs?|branches?)\b.{0,30}\bchip(?:ping)?\b|\bchip\s+brush\b/.test(text)) values.push("chip_brush");
  if (/\b(?:mulch\s+)?chip(?:ping)?\s+and\s+leave\b|\bleave\b.{0,30}\bchips?\b|\bchips?\s+left\s+on\s+site\b|\bchip\s+and\s+leave\b/.test(text)) values.push("leave_chips_on_site");
  if (/\b(?:cleanup|clean up|clean the work area|clean work area|clean yard|clean the yard|site cleanup|final cleanup|yard protection cleanup|access cleanup|yard cleanup|rake(?:[-\s]?up)?)\b/.test(text)) values.push("cleanup");
  return unique(values);
}

function stumpTreatmentFromText(value) {
  const text = normalizeFactText(value);
  const values = [];
  if (/\bgrind(?:ing)?\b.{0,30}\bstumps?\b|\bstumps?\b.{0,30}\bgrind(?:ing)?\b/.test(text)) values.push("grind_stump");
  if (/\bflush cut\b.{0,30}\bstumps?\b|\bcut\b.{0,30}\bstumps?\b.{0,30}\blow\b|\bstumps?\b.{0,30}\bcut\b.{0,30}\blow\b/.test(text)) values.push("cut_stump_low");
  if (/\bleave\b.{0,30}\bstumps?\b|\bstumps?\s+stays?\b|\bno\s+stump\s+grind(?:ing)?\b/.test(text)) values.push("leave_stump");
  return unique(values);
}

function phraseIfPresent(text, pattern, phrase) {
  return pattern.test(text) ? phrase : "";
}

function targetQualifiersFromText(value) {
  const text = normalizeFactText(value);
  const backYardPattern =
    /\b(?:tree|trees|stump|stumps|limb|limbs|brush|debris|work|remove|trim|cut|cleanup|clean up)\b.{0,30}\bback\s+yard\b|\bback\s+yard\b.{0,30}\b(?:tree|trees|stump|stumps|limb|limbs|brush|debris|work|remove|trim|cut|cleanup|clean up)\b/;
  const dogBackYardPattern = /\bdog\b.{0,30}\bback\s+yard\b|\bback\s+yard\b.{0,30}\bdog\b/;
  return unique([
    phraseIfPresent(text, /\bover\b.{0,20}\broof\b/, "over roof"),
    phraseIfPresent(text, /\bnear\b.{0,10}\bdriveway\b/, "near driveway"),
    phraseIfPresent(text, /\bbeside\b.{0,10}\bdriveway\b/, "beside driveway"),
    phraseIfPresent(text, /\b(?:by|near)\b.{0,10}\bshed\b/, "by shed"),
    phraseIfPresent(text, /\bby\b.{0,10}\bfence\b|\bclose to\b.{0,10}\bfence\b/, "by fence"),
    phraseIfPresent(text, /\bnear\b.{0,10}\balley\b/, "near alley"),
    phraseIfPresent(text, /\bbehind\b.{0,10}\bgarage\b/, "behind garage"),
    phraseIfPresent(text, /\bnext to\b.{0,10}\bbarn\b|\bby\b.{0,10}\bbarn\b/, "next to barn"),
    phraseIfPresent(text, /\b(?:near|by|at)?\s*(?:the\s+)?(?:\d+[-\s]*foot|twenty\s+two[-\s]+foot|22[-\s]*foot)\s+drive\s+opening\b/, "22 foot drive opening"),
    !dogBackYardPattern.test(text) && backYardPattern.test(text) ? "back yard" : "",
    phraseIfPresent(text, /\bclean\b.{0,10}\bcreek\s+area\b|\bby\b.{0,10}\bcreek\b/, "by creek"),
    phraseIfPresent(text, /\bclean\b.{0,10}\bporch\s+area\b|\bby\b.{0,10}\bporch\b/, "by porch"),
  ]);
}

function conditionQualifiersFromText(value) {
  const text = normalizeFactText(value);
  return unique([
    phraseIfPresent(text, /\bdead\b/, "dead"),
    phraseIfPresent(text, /\bfallen\b|\bdowned\b/, "fallen"),
    phraseIfPresent(text, /\bstorm(?: |-)?damaged\b|\bstorm\s+damage\b/, "storm damaged"),
    phraseIfPresent(text, /\bsplit\s+trunk\b|\btrunk\s+split\b/, "split trunk"),
    phraseIfPresent(text, /\blimbs?\s+low\b|\blow\s+limbs?\b/, "low limbs"),
    phraseIfPresent(text, /\bleaning\b/, "leaning"),
  ]);
}

function accessQualifiersFromText(value) {
  const text = normalizeFactText(value);
  return unique([
    phraseIfPresent(text, /\btight\s+access\b|\blimited\s+access\b|\brestricted\s+access\b/, "tight access"),
    phraseIfPresent(text, /\bnarrow\s+gate\b|\btight\s+gate\b/, "narrow gate"),
    phraseIfPresent(text, /\bblocked\s+access\b|\bno\s+access\b|\baccess\s+(?:is\s+)?bad\b/, "blocked access"),
    phraseIfPresent(text, /\bbucket\s+truck\b|\bcrane\b|\blift\s+access\b|\bmini\s+skid\b/, "equipment restriction"),
  ]);
}

function safetyQualifiersFromText(value) {
  const text = normalizeFactText(value);
  return unique([
    phraseIfPresent(text, /\b(?:service|power|utility)\s+line\b|\bwires?\b|\belectric\b/, "utility line"),
    phraseIfPresent(text, /\baggressive\s+dog\b|\bdog\b/, "dog"),
    phraseIfPresent(text, /\bhazard\b|\bunsafe\b|\bemergency\b|\bsame day\b/, "hazard"),
    phraseIfPresent(text, /\bunstable\b/, "unstable"),
  ]);
}

function factsFromText({ label = "", price = null, text = "" } = {}) {
  const treeQuantity = treeQuantityFromText(text);
  const explicitStumpQuantity = stumpQuantityFromText(text);
  return {
    label,
    price,
    species: speciesFromText(text),
    tree_quantity: treeQuantity,
    stump_quantity: explicitStumpQuantity || impliedStumpQuantityFromText(text, treeQuantity),
    work_actions: workActionsFromText(text),
    debris_disposition: debrisDispositionFromText(text),
    stump_treatment: stumpTreatmentFromText(text),
    target_qualifiers: targetQualifiersFromText(text),
    condition_qualifiers: conditionQualifiersFromText(text),
    access_qualifiers: accessQualifiersFromText(text),
    safety_qualifiers: safetyQualifiersFromText(text),
    text: compact(text),
  };
}

function speciesValuesFromText(value) {
  const text = normalizeFactText(String(value || "")
    .replace(new RegExp(`\\b\\d+\\s+(?:[A-Za-z0-9.]+\\s+){0,5}${ADDRESS_SUFFIX}\\b`, "gi"), " "));
  return SPECIES.filter((item) => {
    const singular = item.replace(" ", "\\s+");
    const plural = `${item}s`.replace(" ", "\\s+");
    return new RegExp(`\\b${singular}\\b`).test(text) || new RegExp(`\\b${plural}\\b`).test(text);
  });
}

function referencedOptionTokens(segment = "") {
  return [...String(segment || "").matchAll(/\b(?:includes?|including|same\s+as|based\s+on)\s+Option\s+([A-E]|[1-5])\b/gi)]
    .map((match) => /^[1-5]$/.test(match[1])
      ? String.fromCharCode(64 + Number(match[1]))
      : match[1].toUpperCase());
}

function localSourceFactsForOption(sourceOption) {
  return {
    ...factsFromText({
      label: sourceOption.token,
      price: sourceOption.amount,
      text: sourceOption.segment,
    }),
    source_segment: compact(sourceOption.segment),
  };
}

function sharedFactsForRawText(rawText = "") {
  const facts = factsFromText({
    text: explicitSourcePreamble(rawText),
  });
  return {
    ...facts,
    label: "",
    price: null,
    stump_quantity: null,
    work_actions: [],
    debris_disposition: [],
    stump_treatment: [],
  };
}

function inheritedFactsForSourceOption(sourceOption, sharedFacts = {}, localFactsByToken = new Map()) {
  const referencedFacts = referencedOptionTokens(sourceOption.segment)
    .map((token) => localFactsByToken.get(token))
    .filter(Boolean);
  return {
    species: referencedFacts.find((facts) => facts.species)?.species || sharedFacts.species || "",
    tree_quantity: referencedFacts.find((facts) => facts.tree_quantity)?.tree_quantity || sharedFacts.tree_quantity || null,
    work_actions: unique(referencedFacts.flatMap((facts) => facts.work_actions || [])),
    debris_disposition: unique(referencedFacts.flatMap((facts) => facts.debris_disposition || [])),
    stump_treatment: unique(referencedFacts.flatMap((facts) => facts.stump_treatment || [])),
    target_qualifiers: unique([
      ...(sharedFacts.target_qualifiers || []),
      ...referencedFacts.flatMap((facts) => facts.target_qualifiers || []),
    ]),
    condition_qualifiers: unique([
      ...(sharedFacts.condition_qualifiers || []),
      ...referencedFacts.flatMap((facts) => facts.condition_qualifiers || []),
    ]),
    access_qualifiers: unique([
      ...(sharedFacts.access_qualifiers || []),
      ...referencedFacts.flatMap((facts) => facts.access_qualifiers || []),
    ]),
    safety_qualifiers: unique([
      ...(sharedFacts.safety_qualifiers || []),
      ...referencedFacts.flatMap((facts) => facts.safety_qualifiers || []),
    ]),
  };
}

function sourceFactsForOption(sourceOption, inheritedFacts = {}) {
  const localFacts = localSourceFactsForOption(sourceOption);
  const localDebrisOverridesLeave = localFacts.debris_disposition.some((value) =>
    /^haul_/.test(value) || value === "chip_brush"
  );
  const inheritedDebris = localDebrisOverridesLeave
    ? (inheritedFacts.debris_disposition || []).filter((value) => !/^leave_/.test(value))
    : inheritedFacts.debris_disposition || [];
  return {
    ...localFacts,
    species: localFacts.species || inheritedFacts.species || "",
    tree_quantity: localFacts.tree_quantity || inheritedFacts.tree_quantity || null,
    work_actions: unique([
      ...(inheritedFacts.work_actions || []),
      ...(localFacts.work_actions || []),
    ]),
    debris_disposition: unique([
      ...inheritedDebris,
      ...(localFacts.debris_disposition || []),
    ]),
    stump_treatment: unique([
      ...(inheritedFacts.stump_treatment || []),
      ...(localFacts.stump_treatment || []),
    ]),
    target_qualifiers: unique([
      ...(inheritedFacts.target_qualifiers || []),
      ...(localFacts.target_qualifiers || []),
    ]),
    condition_qualifiers: unique([
      ...(inheritedFacts.condition_qualifiers || []),
      ...(localFacts.condition_qualifiers || []),
    ]),
    access_qualifiers: unique([
      ...(inheritedFacts.access_qualifiers || []),
      ...(localFacts.access_qualifiers || []),
    ]),
    safety_qualifiers: unique([
      ...(inheritedFacts.safety_qualifiers || []),
      ...(localFacts.safety_qualifiers || []),
    ]),
  };
}

function finalFactsForOption(option = {}, index = 0) {
  const text = optionText(option);
  return {
    ...factsFromText({
      label: labelTokenForOption(option, index),
      price: optionAmount(option),
      text,
    }),
    species: speciesValuesFromText(text),
    final_text: text,
  };
}

function finalContextText(finalJob = {}) {
  const treeDetails = finalJob?.tree_details || {};
  return compact([
    finalJob?.description,
    finalJob?.condition_details,
    finalJob?.cleanup_notes,
    finalJob?.debris_notes,
    treeDetails.tree_count,
    treeDetails.tree_type,
    treeDetails.tree_size,
  ].filter(Boolean).join(" "));
}

function finalContextFactsForJob(finalJob = {}) {
  const text = finalContextText(finalJob);
  return {
    ...factsFromText({ text }),
    species: speciesValuesFromText(text),
    final_text: text,
  };
}

function factsWithFinalContext(finalFacts = {}, finalContextFacts = {}) {
  const finalText = compact([finalFacts.final_text, finalContextFacts.final_text].filter(Boolean).join(" "));
  const treeQuantity = finalFacts.tree_quantity || finalContextFacts.tree_quantity || null;
  return {
    ...finalFacts,
    species: unique([
      ...(Array.isArray(finalFacts.species) ? finalFacts.species : [finalFacts.species]),
      ...(Array.isArray(finalContextFacts.species) ? finalContextFacts.species : [finalContextFacts.species]),
    ]),
    tree_quantity: treeQuantity,
    stump_quantity: finalFacts.stump_quantity ||
      finalContextFacts.stump_quantity ||
      impliedStumpQuantityFromText(finalText, treeQuantity),
    target_qualifiers: unique([
      ...(finalFacts.target_qualifiers || []),
      ...(finalContextFacts.target_qualifiers || []),
    ]),
    condition_qualifiers: unique([
      ...(finalFacts.condition_qualifiers || []),
      ...(finalContextFacts.condition_qualifiers || []),
    ]),
    access_qualifiers: unique([
      ...(finalFacts.access_qualifiers || []),
      ...(finalContextFacts.access_qualifiers || []),
    ]),
    safety_qualifiers: unique([
      ...(finalFacts.safety_qualifiers || []),
      ...(finalContextFacts.safety_qualifiers || []),
    ]),
    final_text: finalText,
  };
}

function displayValue(factKey, value) {
  if (Array.isArray(value)) return value.map((item) => displayValue(factKey, item)).join(", ");
  if (value == null || value === "") return "";
  if (factKey === "price") return `$${Math.round(Number(value)).toLocaleString("en-US")}`;
  if (factKey === "tree_quantity") return `${numberWord(value)} ${value === 1 ? "tree" : "trees"}`;
  if (factKey === "stump_quantity") return `${numberWord(value)} ${value === 1 ? "stump" : "stumps"}`;
  return String(value).replace(/_/g, " ");
}

function valuesEqual(left, right) {
  return normalizeFactText(left) === normalizeFactText(right);
}

function valuePresentInFinal(factKey, sourceValue, finalFacts) {
  const finalValue = finalFacts[factKey];
  if (Array.isArray(finalValue)) {
    return finalValue.some((value) => valuesEqual(value, sourceValue));
  }
  return valuesEqual(finalValue, sourceValue);
}

function targetPresentInFinal(sourceValue, finalFacts) {
  if (valuePresentInFinal("target_qualifiers", sourceValue, finalFacts)) return true;
  const source = normalizeFactText(sourceValue).replace(/\bthe\b/g, " ").replace(/\s+/g, " ").trim();
  const finalText = normalizeFactText(finalFacts.final_text || "").replace(/\bthe\b/g, " ").replace(/\s+/g, " ").trim();
  return Boolean(source && finalText.includes(source));
}

function missingSourceValues(factKey, sourceFacts, finalFacts) {
  const sourceValue = sourceFacts[factKey];
  if (Array.isArray(sourceValue)) {
    return sourceValue.filter((value) =>
      factKey === "target_qualifiers"
        ? !targetPresentInFinal(value, finalFacts)
        : !valuePresentInFinal(factKey, value, finalFacts)
    );
  }
  if (sourceValue == null || sourceValue === "") return [];
  if (factKey === "target_qualifiers") return targetPresentInFinal(sourceValue, finalFacts) ? [] : [sourceValue];
  return valuePresentInFinal(factKey, sourceValue, finalFacts) ? [] : [sourceValue];
}

function targetQualifierComparison(sourceFacts, finalFacts, missing = []) {
  const sourceTargets = Array.isArray(sourceFacts.target_qualifiers) ? sourceFacts.target_qualifiers : [];
  const finalTargets = Array.isArray(finalFacts.target_qualifiers) ? finalFacts.target_qualifiers : [];
  const missingSet = new Set(missing.map(normalizeFactText));
  const preserved = sourceTargets.filter((value) => !missingSet.has(normalizeFactText(value)));

  if (!missing.length) {
    return {
      preservation: "complete",
      preserved_source_values: preserved.map((value) => displayValue("target_qualifiers", value)),
      missing_source_values: [],
      final_values: finalTargets.map((value) => displayValue("target_qualifiers", value)),
    };
  }
  if (preserved.length) {
    return {
      preservation: "partial",
      preserved_source_values: preserved.map((value) => displayValue("target_qualifiers", value)),
      missing_source_values: missing.map((value) => displayValue("target_qualifiers", value)),
      final_values: finalTargets.map((value) => displayValue("target_qualifiers", value)),
    };
  }
  return {
    preservation: finalTargets.length ? "contradiction" : "missing",
    preserved_source_values: [],
    missing_source_values: missing.map((value) => displayValue("target_qualifiers", value)),
    final_values: finalTargets.map((value) => displayValue("target_qualifiers", value)),
  };
}

function factHasSourceValue(factKey, sourceFacts) {
  const value = sourceFacts[factKey];
  return Array.isArray(value) ? value.length > 0 : value != null && value !== "";
}

function factHasFinalValue(factKey, finalFacts) {
  const value = finalFacts[factKey];
  return Array.isArray(value) ? value.length > 0 : value != null && value !== "";
}

function sourceCoverageOverride(option = {}, factKey = "", code = "") {
  const flags = option?.review_flags || {};
  if (flags.source_to_final_verified_override !== true) return false;
  const facts = Array.isArray(flags.source_to_final_verified_override_facts)
    ? flags.source_to_final_verified_override_facts
    : [];
  const codes = Array.isArray(flags.source_to_final_verified_override_codes)
    ? flags.source_to_final_verified_override_codes
    : [];
  return facts.includes(factKey) || codes.includes(code);
}

export function acceptedIncrementalBundleRelationship({
  sourceAmount = null,
  finalAmount = null,
  priceReconciliation = {},
} = {}) {
  const source = Math.round(Number(sourceAmount));
  const final = Math.round(Number(finalAmount));
  if (!Number.isFinite(source) || !Number.isFinite(final)) return null;
  const entries = Array.isArray(priceReconciliation?.add_on_interpretations)
    ? priceReconciliation.add_on_interpretations
    : [];
  return entries.find((entry) =>
    Math.round(Number(entry?.add_on_amount)) === source &&
    Math.round(Number(entry?.combined_amount)) === final &&
    entry?.price_role === "INCREMENTAL_ADDON_PRICE" &&
    entry?.price_role_confidence === "high" &&
    entry?.amount_confidence === "high" &&
    ["medium", "high"].includes(entry?.pairing_confidence) &&
    entry?.candidate_status === "accepted" &&
    entry?.reason_code === "accepted_into_bundled_option"
  ) || null;
}

function resultMessage({ optionLabel, factLabel, factKey, missing, sourceFacts, finalFacts, blocksPdf, targetComparison = null }) {
  const sourceValue = displayValue(factKey, missing.length ? missing : sourceFacts[factKey]) || "not found";
  const finalValue = displayValue(factKey, finalFacts[factKey]) || "not found";
  const disposition = blocksPdf
    ? "Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override."
    : "Review whether this should stay as an internal TD note or be added to the customer-facing scope.";
  if (factKey === "target_qualifiers" && targetComparison?.preservation === "partial") {
    const preserved = displayValue(factKey, targetComparison.preserved_source_values) || "not found";
    return `${optionLabel} source also identifies the target/location as "${sourceValue}". Final TD2 preserves "${preserved}" but is missing "${sourceValue}". ${disposition}`;
  }
  if (factKey === "target_qualifiers" && targetComparison?.preservation === "contradiction") {
    return `${optionLabel} source identifies the target/location as "${sourceValue}", but final TD2 only says "${finalValue}". ${disposition}`;
  }
  return `${optionLabel} source says ${factLabel.toLowerCase()} is "${sourceValue}", but final TD2 says "${finalValue}". ${disposition}`;
}

function compareFact({
  sourceOption,
  finalOption,
  sourceFacts,
  finalFacts,
  factKey,
  factLabel,
  acceptedBundleRelationship = null,
}) {
  const code = FACT_CODES[factKey] || "SOURCE_FINAL_FACT_MISMATCH";
  const optionLabel = `Option ${sourceOption.token}`;
  const sourceHasValue = factHasSourceValue(factKey, sourceFacts);
  const finalHasValue = factHasFinalValue(factKey, finalFacts);
  const base = {
    option_label: sourceOption.token,
    fact: factKey,
    fact_label: factLabel,
    source_value: displayValue(factKey, sourceFacts[factKey]),
    final_value: displayValue(factKey, finalFacts[factKey]),
    status: "not_checked",
    blocks_pdf: false,
    warning_only: false,
    code,
    message: "",
  };

  if (!sourceHasValue) return base;

  if (factKey === "price" && acceptedBundleRelationship) {
    return {
      ...base,
      status: "transformed",
      transformation: "accepted_incremental_add_on_bundle",
      relationship_id: acceptedBundleRelationship.interpretation_id || "",
    };
  }

  const missing = missingSourceValues(factKey, sourceFacts, finalFacts);
  const targetComparison = factKey === "target_qualifiers"
    ? targetQualifierComparison(sourceFacts, finalFacts, missing)
    : null;
  if (!missing.length) {
    return {
      ...base,
      status: "ok",
      ...(targetComparison ? { target_comparison: targetComparison } : {}),
    };
  }

  const material = MATERIAL_FACTS.has(factKey);
  const warningOnly = WARNING_FACTS.has(factKey);
  const status = factKey === "target_qualifiers" && targetComparison?.preservation === "partial"
    ? "missing"
    : warningOnly ? "review_only" : finalHasValue ? "changed" : "missing";
  const overridden = sourceCoverageOverride(finalOption, factKey, code);
  const blocksPdf = material && !overridden;
  return {
    ...base,
    status: overridden ? "review_only" : status,
    missing_source_values: missing.map((value) => displayValue(factKey, value)),
    ...(targetComparison ? { target_comparison: targetComparison } : {}),
    blocks_pdf: blocksPdf,
    warning_only: warningOnly || overridden,
    override_recorded: overridden,
    message: resultMessage({
      optionLabel,
      factLabel,
      factKey,
      missing,
      sourceFacts,
      finalFacts,
      blocksPdf,
      targetComparison,
    }),
  };
}

export function buildSourceFinalFactCoverage({
  rawText = "",
  finalOptions = [],
  finalJob = {},
  finalCustomer = null,
  priceReconciliation = {},
} = {}) {
  const sourceOptions = explicitSourceOptionsForCoverage(rawText).filter((option) => option.amount).slice(0, 4);
  const contactCoverage = contactEqualityCoverage({ rawText, finalCustomer, finalJob });
  const optionCoverageApplicable = sourceOptions.length >= 2;
  if (!optionCoverageApplicable && !contactCoverage.results.length) {
    return {
      version: SOURCE_FINAL_FACT_COVERAGE_VERSION,
      applicable: false,
      source_options: [],
      final_options: [],
      source_contact: contactCoverage.source,
      final_contact: contactCoverage.final,
      results: [],
      blocking_results: [],
      warning_results: [],
      blocking_messages: [],
      warning_messages: [],
      blocking_codes: [],
    };
  }

  const sharedSourceFacts = optionCoverageApplicable ? sharedFactsForRawText(rawText) : {};
  const localFactsByToken = new Map(sourceOptions.map((sourceOption) => [
    sourceOption.token,
    localSourceFactsForOption(sourceOption),
  ]));
  const sourceFactsWithInheritance = (sourceOption) => sourceFactsForOption(
    sourceOption,
    inheritedFactsForSourceOption(sourceOption, sharedSourceFacts, localFactsByToken),
  );
  const finalByToken = new Map(finalOptions.map((option, index) => [labelTokenForOption(option, index), { option, index }]));
  const sourceFactRows = sourceOptions.map(sourceFactsWithInheritance);
  const finalFactRows = finalOptions.map((option, index) => finalFactsForOption(option, index));
  const finalContextFacts = finalContextFactsForJob(finalJob);
  const results = [...contactCoverage.results];

  for (const sourceOption of optionCoverageApplicable ? sourceOptions : []) {
    const sourceFacts = sourceFactsWithInheritance(sourceOption);
    const finalEntry = finalByToken.get(sourceOption.token) || { option: finalOptions[sourceOptions.indexOf(sourceOption)] || {}, index: sourceOptions.indexOf(sourceOption) };
    const finalFacts = factsWithFinalContext(finalFactsForOption(finalEntry.option, finalEntry.index), finalContextFacts);
    const acceptedBundleRelationship = acceptedIncrementalBundleRelationship({
      sourceAmount: sourceFacts.price,
      finalAmount: finalFacts.price,
      priceReconciliation,
    });
    for (const [factKey, factLabel] of FACT_DEFINITIONS) {
      results.push(compareFact({
        sourceOption,
        finalOption: finalEntry.option,
        sourceFacts,
        finalFacts,
        factKey,
        factLabel,
        acceptedBundleRelationship,
      }));
    }
  }

  const blockingResults = results.filter((result) => result.blocks_pdf);
  const warningResults = results.filter((result) => result.warning_only && result.message);
  return {
    version: SOURCE_FINAL_FACT_COVERAGE_VERSION,
    applicable: true,
    source_options: optionCoverageApplicable ? sourceFactRows : [],
    final_options: optionCoverageApplicable ? finalFactRows : [],
    source_contact: contactCoverage.source,
    final_contact: contactCoverage.final,
    results,
    blocking_results: blockingResults,
    warning_results: warningResults,
    blocking_messages: [...new Set(blockingResults.map((result) => `${result.code}: ${result.message}`))],
    warning_messages: [...new Set(warningResults.map((result) => result.message))],
    blocking_codes: [...new Set(blockingResults.map((result) => result.code))].sort(),
  };
}
