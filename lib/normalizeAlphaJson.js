import { createDraftAlphaJson, emptyNormalization } from "./alphaJson.js";

const ADDRESS_SUFFIX =
  "(?:Street|St|Road|Rd|Ave|Avenue|Drive|Dr|Lane|Ln|Court|Ct|Way|Blvd|Boulevard|Highway|Hwy|Route|State Route|County Road|CR|Pike|Circle|Cir|Place|Pl|Terrace|Ter|Trail|Trl|Parkway|Pkwy|Main)";

const NUMBER_WORDS = new Map([
  ["one", "1"],
  ["two", "2"],
  ["three", "3"],
  ["four", "4"],
  ["five", "5"],
  ["six", "6"],
  ["seven", "7"],
  ["eight", "8"],
  ["nine", "9"],
  ["ten", "10"],
]);

const NORMALIZATION_FIELD_KEYS = [
  "customer_name",
  "phone",
  "email",
  "service_address",
  "tree_count",
  "tree_type",
  "work_scope",
  "haul_away",
  "stump",
  "price",
  "options",
];

const TREE_SPECIES = [
  "bradford pear",
  "river birch",
  "silver maple",
  "sweet gum",
  "pine",
  "oak",
  "maple",
  "elm",
  "ash",
  "cedar",
  "sycamore",
  "hickory",
  "locust",
  "birch",
  "spruce",
  "walnut",
  "cherry",
];

const CORRECTION_RULES = [
  { pattern: /\bmapls\b/gi, original: "mapls", corrected: "maples", reason: "Corrected obvious tree-species typo." },
  { pattern: /\bmapl\b/gi, original: "mapl", corrected: "maple", reason: "Corrected obvious tree-species typo." },
  { pattern: /\bovr\b/gi, original: "ovr", corrected: "over", reason: "Expanded shorthand typo." },
  { pattern: /\bhawl\b/gi, original: "hawl", corrected: "haul", reason: "Corrected haul-away typo." },
  { pattern: /\brmv\b/gi, original: "rmv", corrected: "remove", reason: "Expanded tree-service shorthand." },
  { pattern: /\brmvl\b/gi, original: "rmvl", corrected: "removal", reason: "Expanded tree-service shorthand." },
  { pattern: /\btwp\b/gi, original: "twp", corrected: "two", reason: "Corrected number typo." },
  { pattern: /\btreess\b/gi, original: "treess", corrected: "trees", reason: "Corrected tree-count typo." },
  { pattern: /\btreee\b/gi, original: "treee", corrected: "tree", reason: "Corrected tree typo." },
  { pattern: /\bremovel\b/gi, original: "removel", corrected: "removal", reason: "Corrected removal typo." },
  { pattern: /\bhual\b/gi, original: "hual", corrected: "haul", reason: "Corrected haul-away typo." },
  { pattern: /\bhall\s+off\b/gi, original: "hall off", corrected: "haul off", reason: "Corrected haul-away typo." },
  { pattern: /\bhall\s+away\b/gi, original: "hall away", corrected: "haul away", reason: "Corrected haul-away typo." },
  { pattern: /\bdebree\b/gi, original: "debree", corrected: "debris", reason: "Corrected debris typo." },
  { pattern: /\bstomp\s+grind(?:ed|ing)?\b/gi, original: "stomp grinding", corrected: "stump grinding", reason: "Corrected stump-grinding typo." },
  { pattern: /\bstomp\b/gi, original: "stomp", corrected: "stump", reason: "Corrected stump typo." },
  { pattern: /\btriming\b/gi, original: "triming", corrected: "trimming", reason: "Corrected trimming typo." },
  { pattern: /\bbrnaches\b/gi, original: "brnaches", corrected: "branches", reason: "Corrected branches typo." },
  { pattern: /\bqoute\b/gi, original: "qoute", corrected: "quote", reason: "Corrected quote typo." },
];

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function firstString(...values) {
  for (const value of values) {
    const text = asString(value);
    if (text) return text;
  }
  return "";
}

function titleCaseName(value) {
  const text = asString(value);
  if (!text) return "";
  return text
    .split(/\s+/)
    .map((part) => (part ? part[0].toLocaleUpperCase() + part.slice(1) : part))
    .join(" ");
}

const PHONE_PATTERN = /(?:\+?1[-./\s]?)?\(?\d{3}\)?[-./\s]?\d{3}[-./\s]?\d{4}/g;

function stripEmails(value) {
  return asString(value).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ");
}

function stripPhones(value) {
  return asString(value).replace(PHONE_PATTERN, " ");
}

function escapeRegExp(value) {
  return asString(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanCustomerName(value) {
  let text = stripPhones(stripEmails(value))
    .replace(/\b(?:note\s+from|text\s+from|send\s+quote\s+to|customer\s+is|customer|client|homeowner|lady\s+named|lady|guy|person|office\s+said\s+call|call\/text|called\s+from|called|call|texted|text|said|or|text\s+mess)\b[:\s-]*/gi, " ")
    .replace(/\b(?:maybe|no\s+phone\s+in\s+note|email\s+only|estimate\s+from\s+yesterday|from\s+yesterday)\b.*$/i, "")
    .replace(/\b(?:phone|service|address|job|lives?|wants?|needs?|says?|property|place|at|on|remove|removal|take|cut|drop|tree|trees?|stump|option)\b.*$/i, "")
    .replace(/\/\s*(?:text|call)\b/gi, " ")
    .replace(/[,:;.?\s-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const reversed = text.match(/^([A-Za-z\u00c0-\u024f][A-Za-z\u00c0-\u024f.'-]+),\s*([A-Za-z\u00c0-\u024f][A-Za-z\u00c0-\u024f.'-]+)$/);
  if (reversed) text = `${reversed[2]} ${reversed[1]}`;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 4) text = words.slice(0, 4).join(" ");
  if (/^(?:and|or|is|email|phone|approval|email\s+for\s+approval(?:\s+is)?)$/i.test(text)) return "";
  return titleCaseName(text);
}

export function normalizePhone(value) {
  const digits = asString(value).replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length === 10) {
    return `${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6)}`;
  }
  return asString(value);
}

function money(amount) {
  return amount ? `$${Number(amount).toLocaleString("en-US")}` : "";
}

export function normalizeTreeServiceText(value) {
  return CORRECTION_RULES.reduce((text, rule) => text.replace(rule.pattern, rule.corrected), asString(value))
    .replace(/\s+/g, " ")
    .trim();
}

function stripStructuredContactLines(value) {
  const jobWords = /\b(remove|removal|trim|cut|drop|tree|trees|stump|haul|cleanup|grind|limb|branch|brush|debris|option|quote)\b/i;
  return asString(value)
    .split(/\r?\n/)
    .filter((line) => {
      const text = line.trim();
      if (!/^(?:Customer\s+name|Customer\s+phone|Customer\s+email|Service\s+address)\s*:/i.test(text)) return true;
      return jobWords.test(text);
    })
    .join("\n");
}

function stripFollowUpLines(value) {
  return asString(value)
    .split(/\r?\n/)
    .filter((line) => !/^\s*Follow-up\s+\d+\s*:/i.test(line))
    .join("\n");
}

function stripContactOnlyFollowUpLines(value) {
  return asString(value)
    .split(/\r?\n/)
    .filter((line) => {
      if (!/^\s*Follow-up\s+\d+\s*:/i.test(line)) return true;
      return /\b(option|opt|remove|removal|trim|trimming|cut|drop|take\s+down|haul|cleanup|clean|stump|grind|tree|trees|limb|brush|price|included|excluded|separate)\b/i.test(line);
    })
    .join("\n")
    .replace(/^\s*Follow-up\s+\d+\s*:\s*/gim, "");
}

function removeKnownValue(text, value) {
  const known = asString(value);
  if (!known) return text;
  return text.replace(new RegExp(escapeRegExp(known), "gi"), " ");
}

function cleanCorrectedInterpretation(value, alphaJson = null) {
  let text = stripStructuredContactLines(stripFollowUpLines(value))
    .replace(/\b(?:Customer\s+name|Customer\s+phone|Customer\s+email|Service\s+address|Exact\s+service\s+address)\s*:\s*/gi, " ")
    .replace(/\b(?:called\s+from|call(?:ed)?|phone|email(?:\s+for\s+approval)?)\b/gi, " ")
    .replace(/\bclean(?:up|\s+up)?\s+if\s+(?:customer|they|he|she)\s+wants?\b[.,;?]*/gi, " ")
    .replace(/\bstump\s+maybe\s+included\??/gi, " ")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
    .replace(PHONE_PATTERN, " ");

  if (alphaJson) {
    text = removeKnownValue(text, alphaJson.customer?.name);
    text = removeKnownValue(text, alphaJson.customer?.phone_display);
    text = removeKnownValue(text, alphaJson.customer?.phone_primary);
    text = removeKnownValue(text, alphaJson.customer?.email);
    text = removeKnownValue(text, alphaJson.job?.service_address?.display);
  }

  return normalizeTreeServiceText(text)
    .replace(/^[\s.,;:-]+/g, "")
    .replace(/^(?:and|or|then|also)\b[\s.,;:-]*/i, "")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/\b(?:and|or)\s*[.,;:]\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function textFromFirstWorkCue(value) {
  const text = stripEmails(stripStructuredContactLines(stripContactOnlyFollowUpLines(value)))
    .replace(PHONE_PATTERN, " ")
    .trim();
  const match = text.match(
    /\b(?:remove|removal|trim|trimming|cut|drop|take\s+down|haul|cleanup|clean|grind|(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:[a-z]+\s+){0,4}(?:trees?|limbs?|branches?|stumps?|brush|oaks?|maples?|pines?|elms?|ashes?|cedars?|sycamores?|hickories?|locusts?|birches?))\b/i,
  );
  return match ? text.slice(match.index).trim() : rawTextWithoutLeadContact(value);
}

function collectCorrections(rawInput) {
  const rawText = asString(rawInput);
  const corrections = [];
  for (const rule of CORRECTION_RULES) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(rawText)) {
      corrections.push({
        original: rule.original,
        corrected: rule.corrected,
        reason: rule.reason,
      });
    }
  }
  return corrections;
}

function sanitizeCorrection(item) {
  if (!isObject(item)) return null;
  const original = asString(item.original);
  const corrected = asString(item.corrected);
  if (!original || !corrected) return null;
  return {
    original,
    corrected,
    reason: asString(item.reason),
  };
}

function sanitizeUncertainty(item) {
  if (!isObject(item)) return null;
  const field = asString(item.field);
  const issue = asString(item.issue);
  if (!field || !issue) return null;
  return {
    field,
    issue,
    evidence: asString(item.evidence),
  };
}

function sanitizeFieldEvidence(value) {
  if (!isObject(value)) return {};
  return NORMALIZATION_FIELD_KEYS.reduce((evidence, key) => {
    const item = value[key];
    if (Array.isArray(item)) {
      evidence[key] = item.map(asString).filter(Boolean).slice(0, 5);
    } else {
      const text = asString(item);
      if (text) evidence[key] = text;
    }
    return evidence;
  }, {});
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sanitizeNormalization(value) {
  const normalized = emptyNormalization();
  if (!isObject(value)) return normalized;

  normalized.corrected_interpretation = cleanCorrectedInterpretation(value.corrected_interpretation);
  normalized.corrections_made = Array.isArray(value.corrections_made)
    ? value.corrections_made.map(sanitizeCorrection).filter(Boolean)
    : [];
  normalized.uncertainties = Array.isArray(value.uncertainties)
    ? value.uncertainties.map(sanitizeUncertainty).filter(Boolean)
    : [];
  normalized.field_evidence = sanitizeFieldEvidence(value.field_evidence);
  return normalized;
}

function buildBasicUncertainties(rawInput) {
  const rawText = asString(rawInput);
  const priceText = stripPhones(rawText);
  const uncertainties = [];
  if (/\btake care of\b/i.test(rawText)) {
    uncertainties.push({
      field: "work_scope",
      issue: "Unclear whether the work means removal, trimming, or another service.",
      evidence: "take care of",
    });
  }
  if (/\b(?:around|about|roughly|maybe)\s+\$?\s*[0-9][0-9,]*(?:k|000)?\b|\bprice\s+depends\b/i.test(priceText)) {
    uncertainties.push({
      field: "price",
      issue: "Price language is not firm enough for a customer-facing estimate.",
      evidence: priceText.match(/\b(?:around|about|roughly|maybe)\s+\$?\s*[0-9][0-9,]*(?:k|000)?\b|\bprice\s+depends\b/i)?.[0] || "",
    });
  }
  if (/\bstump\b.{0,24}\bmaybe\b|\bmaybe\b.{0,24}\bstump\b|\bstump\b.{0,24}\bincluded\??/i.test(rawText)) {
    uncertainties.push({
      field: "stump",
      issue: "Stump inclusion is unclear.",
      evidence: rawText.match(/\bstump\b.{0,24}\bmaybe\b|\bmaybe\b.{0,24}\bstump\b|\bstump\b.{0,24}\bincluded\??/i)?.[0] || "",
    });
  }
  if (/\bclean(?:\s+it)?\s+up\s+if\s+(?:they|he|she|customer)\s+wants?\b|\bhaul(?:\s+away)?\s+if\s+(?:they|he|she|customer)\s+wants?\b/i.test(rawText)) {
    uncertainties.push({
      field: "haul_away",
      issue: "Cleanup or haul-away scope is conditional or unclear.",
      evidence: rawText.match(/\bclean(?:\s+it)?\s+up\s+if\s+(?:they|he|she|customer)\s+wants?\b|\bhaul(?:\s+away)?\s+if\s+(?:they|he|she|customer)\s+wants?\b/i)?.[0] || "",
    });
  }
  return uncertainties;
}

function buildBasicNormalizationFromRawInput(rawInput, alphaJson) {
  const normalized = emptyNormalization();
  const correctedText = cleanCorrectedInterpretation(textFromFirstWorkCue(rawInput), alphaJson);
  normalized.corrected_interpretation = correctedText;
  normalized.corrections_made = collectCorrections(rawInput);
  normalized.uncertainties = buildBasicUncertainties(rawInput);
  normalized.field_evidence = {
    customer_name: alphaJson.customer?.name || "",
    phone: alphaJson.customer?.phone_display || alphaJson.customer?.phone_primary || "",
    email: alphaJson.customer?.email || "",
    service_address: alphaJson.job?.service_address?.display || "",
    tree_count: alphaJson.job?.tree_details?.tree_count || "",
    tree_type: alphaJson.job?.tree_details?.tree_type || "",
    work_scope: alphaJson.job?.description || "",
    price: (alphaJson.service_options?.items || []).map((option) => option.price?.display).filter(Boolean),
    options: (alphaJson.service_options?.items || []).map((option) => option.description).filter(Boolean),
  };
  return normalized;
}

function mergeNormalization(provided, basic) {
  return {
    corrected_interpretation: provided.corrected_interpretation || basic.corrected_interpretation,
    corrections_made: uniqueBy(
      [...provided.corrections_made, ...basic.corrections_made],
      (item) => `${item.original}\u0000${item.corrected}`,
    ),
    uncertainties: uniqueBy(
      [...provided.uncertainties, ...basic.uncertainties],
      (item) => `${item.field}\u0000${item.issue}\u0000${item.evidence}`,
    ),
    field_evidence: {
      ...basic.field_evidence,
      ...provided.field_evidence,
    },
  };
}

function parseAmount(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = asString(value);
  const match = text.match(/\$?\s*([0-9][0-9,]*)/);
  if (!match) return null;
  const amount = Number(match[1].replaceAll(",", ""));
  return Number.isFinite(amount) ? amount : null;
}

function extractPhoneFromRaw(rawInput) {
  const match = asString(rawInput).match(PHONE_PATTERN);
  return match ? normalizePhone(match[0]) : "";
}

function extractEmailFromRaw(rawInput) {
  const match = asString(rawInput).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : "";
}

function composeAddress(address) {
  if (!address || typeof address !== "object") return asString(address);
  return firstString(
    address.display,
    [address.street || address.line1, address.city, address.state || address.zip ? `${address.state || ""} ${address.zip || ""}`.trim() : ""]
      .filter(Boolean)
      .join(", "),
  );
}

function cleanServiceAddressCandidate(value) {
  const text = stripPhones(stripEmails(value)).replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (/\bsomewhere\b/i.test(text)) return "";
  if (/\b(?:wants?|needs?|option|opt|quote|estimate)\b/i.test(text)) return "";

  const hasStreetLikeAddress = new RegExp(`\\b\\d+\\s+(?:[A-Za-z0-9.]+\\s+){0,6}${ADDRESS_SUFFIX}\\b`, "i").test(text);
  if (!hasStreetLikeAddress) return "";

  const looksLikeJobText =
    text.split(/\s+/).length > 10 &&
    /\b(?:remove|removal|take\s+down|cut\s+down|trim|tree|trees|stump|haul|cleanup|brush|limb)\b/i.test(text);
  if (looksLikeJobText) return "";

  return text.replace(/\s+,/g, ",");
}

function firstCleanAddress(...values) {
  for (const value of values) {
    const address = cleanServiceAddressCandidate(value);
    if (address) return address;
  }
  return "";
}

function extractAddressFromRaw(rawInput) {
  const text = stripEmails(stripPhones(rawInput))
    .replace(/^.*?\b(?:job at|service at|service address|address|customer says property is|property is|lives(?:\s+at)?)\s+/i, "")
    .replace(/\s+/g, " ");
  const suffixPattern = new RegExp(`\\b\\d+\\s+(?:[A-Za-z0-9.]+\\s+){0,5}${ADDRESS_SUFFIX}\\b(?:\\s+\\d+(?:\\s*[NSEW]\\b)?)?`, "gi");
  const suffixMatches = Array.from(text.matchAll(suffixPattern))
    .filter((match) => !/\b(tree|trees|limb|limbs|branch|branches|brush|stump|haul|cleanup|remove|trim|cut|drop)\b/i.test(match[0]));
  const suffixMatch = suffixMatches.at(-1);
  if (suffixMatch) {
    let address = suffixMatch[0].trim().replace(/^(?:job at|service at|property is)\s+/i, "");
    const after = text.slice(suffixMatch.index + suffixMatch[0].length);
    const near = after.match(/^\s+near\s+(Madison|Hanover)\b(?:,?\s+(Indiana|IN))?/i);
    if (near) {
      address += ` near ${near[1]}${near[2] ? `, ${near[2]}` : ""}`;
      return address.trim().replace(/\s+,/g, ",");
    }
    const city = after.match(/(?:,|\s+in|\s+-)?\s+(Madison|Hanover)\b(?:,?\s+(Indiana|IN))?/i);
    if (city) address += `, ${city[1]}${city[2] ? `, ${city[2]}` : ""}`;
    return address.trim().replace(/\s+,/g, ",");
  }

  const mainMatch = text.match(/\b\d+\s+(?:West\s+)?Main\s+(?:Madison|Hanover)\s+(?:Indiana|IN)\b/i);
  if (mainMatch) return mainMatch[0].replace(/\s+(Madison|Hanover)\s+/i, ", $1, ");

  return "";
}

function normalizeTreeCount(value) {
  const text = asString(value);
  if (!text) return "";
  const numeric = text.match(/\b\d+\b/);
  if (numeric) return `${numeric[0]} ${Number(numeric[0]) === 1 ? "tree" : "trees"}`;
  const word = text.toLowerCase().match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/);
  if (word) {
    const count = NUMBER_WORDS.get(word[1]);
    return `${count} ${count === "1" ? "tree" : "trees"}`;
  }
  return text;
}

function extractTreeCountFromRaw(rawInput) {
  const text = normalizeTreeServiceText(stripPhones(rawInput)).split(/\b(?:Option|Opt)\b/i)[0];
  const word = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:[a-z]+\s+){0,4}trees?\b/i);
  if (word) {
    const count = NUMBER_WORDS.get(word[1].toLowerCase());
    return `${count} ${count === "1" ? "tree" : "trees"}`;
  }
  const numeric = text.match(/\b(\d+)\s+(?:[a-z]+\s+){0,4}trees?\b/i);
  if (numeric) return `${numeric[1]} ${Number(numeric[1]) === 1 ? "tree" : "trees"}`;
  const singleTreeWork = text.match(/\b(?:remove|trim|drop|cut)\s+(?:one\s+)?(?:dead\s+|large\s+|small\s+)?(?:pine|oak|maple|tree)\b/i);
  if (singleTreeWork) return "1 tree";
  return "";
}

function extractTreeTypeFromRaw(rawInput) {
  const text = normalizeTreeServiceText(stripPhones(rawInput)).split(/\b(?:Option|Opt)\b/i)[0];
  for (const species of TREE_SPECIES) {
    const escaped = escapeRegExp(species);
    const speciesNearTree = new RegExp(`\\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\\d+)?\\s*(?:dead|large|small|leaning|storm\\s+damaged|fallen)?\\s*${escaped}s?\\s+trees?\\b`, "i");
    const speciesAfterWork = new RegExp(`\\b(?:remove|removal|take\\s+down|cut\\s+down|drop|trim)\\b.{0,40}\\b${escaped}s?\\b`, "i");
    if (speciesNearTree.test(text) || speciesAfterWork.test(text)) return species;
  }
  return "";
}

function rawTextWithoutLeadContact(rawInput) {
  return stripEmails(stripStructuredContactLines(rawInput))
    .replace(/^\s*[A-Za-z\u00c0-\u024f.'-]+(?:\s+[A-Za-z\u00c0-\u024f.'-]+){0,3}\s+(?:called\s+from|call(?:ed)?|phone|email)\b/i, "")
    .replace(/(?:phone\s*)?(?:\+?1[-./\s]?)?\(?\d{3}\)?[-./\s]?\d{3}[-./\s]?\d{4}/i, "")
    .trim();
}

function normalizeOption(option, index) {
  const title = firstString(option.title, option.name, option.label, `Service Option ${String.fromCharCode(65 + index)}`);
  const description = cleanOptionPhrase(firstString(option.description, option.scope, option.work, title));
  const amount = parseAmount(option.price?.amount ?? option.amount ?? option.price);
  return {
    label: `Option ${String.fromCharCode(65 + index)}`,
    sort_order: index + 1,
    title: title.replace(/^Option\s+[A-D]\s*[:.-]?\s*/i, "").trim() || `Service Option ${String.fromCharCode(65 + index)}`,
    description,
    price: {
      price_type: amount ? "fixed" : "unknown",
      currency: "USD",
      amount,
      min_amount: null,
      max_amount: null,
      display: amount ? money(amount) : "",
      is_range: false,
      is_unclear: !amount,
    },
  };
}

function collectModelOptions(rawJson) {
  const service = rawJson?.service || {};
  const serviceList = Array.isArray(rawJson?.services) ? rawJson.services : [];
  const candidates = [
    rawJson?.service_options?.items,
    rawJson?.service_options,
    rawJson?.options,
    service?.options,
    ...serviceList.map((item) => item?.options),
  ];
  return candidates.find((candidate) => Array.isArray(candidate) && candidate.length) || [];
}

function cleanOptionPhrase(value) {
  let text = asString(value)
    .replace(/\b(?:and\s+)?(?:also|then\s+add(?:\s+to\s+that)?|add(?:\s+to\s+that)?|plus|in\s+addition(?:\s+to\s+that)?)\b/i, "")
    .replace(/^\s*(?:and|then|with)\s+/i, "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
    .replace(/(?:\+?1[-./\s]?)?\(?\d{3}\)?[-./\s]?\d{3}[-./\s]?\d{4}/g, "")
    .replace(/\${2,}/g, "$")
    .replace(/\$/g, "")
    .replace(/\b(?:lives?|address|service address|job at|service at)\b\s*$/i, "")
    .replace(/\b(?:for|at|price|cost|would be|is)\s*$/i, "")
    .replace(/[,:;.\s-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const workStart = text.search(/\b(remove|removal|trim|cut|drop|haul|cleanup|clean|grind|stump|limb|brush|debris|stack|leave|wood)\b/i);
  if (workStart > 0) text = text.slice(workStart).trim();
  text = text.replace(/\bit\b/i, "tree");
  return normalizeTreeServiceText(text);
}

function isAddOnPhrase(value) {
  const text = asString(value);
  return /\b(haul|haul away|debris|stump|grind|cleanup|clean up|sweep|stack|leave|wood|brush)\b/i.test(text) &&
    !/\b(remove|removal|cut|trim|drop)\b/i.test(text);
}

function textForOptionExtraction(rawInput) {
  let text = normalizeTreeServiceText(rawTextWithoutLeadContact(stripContactOnlyFollowUpLines(rawInput)))
    .replace(/\b([^.?!]*?\b(?:cleanup|clean up|haul(?:-away| away)?|stump|grind|debris|brush)[^.?!]*?)\s+(?:is|are)\s+included\s+in\s+(Option|Opt)\s*([A-E]|[1-5])\s+for\s+\$?\s*([0-9][0-9,]{2,})\b/gi, "$2 $3 $1 $4")
    .replace(/\s+/g, " ");
  const address = extractAddressFromRaw(rawInput);
  if (address) {
    text = text.replace(new RegExp(escapeRegExp(address), "i"), " ");
  }
  return text
    .replace(/\b\d+\s+(?:[A-Za-z0-9.]+\s+){0,5}(?:street|st|road|rd|ave|avenue|drive|dr|lane|ln|court|ct|way|highway|hwy|route|pike|trail|terrace|parkway)\b(?:\s+(?:in\s+)?(?:Madison|Hanover)\b(?:,?\s+(?:Indiana|IN))?)?/gi, " ")
    .replace(/\b(?:lives?|address|service address|job at|service at)\s+\d+\s+(?:[A-Za-z0-9.]+\s+){0,5}(?:street|st|road|rd|ave|avenue|drive|dr|lane|ln|court|ct|way|highway|hwy)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function amountFromMatch(value) {
  const amount = Number(asString(value).replaceAll(",", ""));
  return Number.isFinite(amount) ? amount : null;
}

function extractAddOnAmountOptions(text) {
  const options = [];
  const addOnPattern =
    /\b([0-9][0-9,]{2,})\s*(?:dollars?)?\s+(?:to|for)\s+(.+?)\s+(?:and\s+)?(?:also\s+)?(?:then\s+)?(?:add(?:\s+to\s+that)?|plus)\s+(.+?)\s+for\s+([0-9][0-9,]{2,})\b/i;
  const addOnMatch = text.match(addOnPattern);
  if (addOnMatch) {
    const baseDescription = cleanOptionPhrase(addOnMatch[2]);
    const addOnDescription = cleanOptionPhrase(addOnMatch[3]);
    if (baseDescription && addOnDescription) {
      options.push({ description: baseDescription, price: amountFromMatch(addOnMatch[1]) });
      options.push({ description: `${baseDescription} and ${addOnDescription}`, price: amountFromMatch(addOnMatch[4]) });
      return options;
    }
  }

  const forPattern =
    /(.+?)\s+for\s+([0-9][0-9,]{2,})\s*(?:dollars?)?\s+(?:and\s+)?(?:also\s+)?(.+?)\s+for\s+([0-9][0-9,]{2,})\b/i;
  const forMatch = text.match(forPattern);
  if (forMatch) {
    const baseDescription = cleanOptionPhrase(forMatch[1]);
    const addOnDescription = cleanOptionPhrase(forMatch[3]);
    if (baseDescription && addOnDescription) {
      options.push({ description: baseDescription, price: amountFromMatch(forMatch[2]) });
      options.push({
        description: isAddOnPhrase(addOnDescription) ? `${baseDescription} and ${addOnDescription}` : addOnDescription,
        price: amountFromMatch(forMatch[4]),
      });
      return options;
    }
  }

  const orMatch = text.match(/(.+?)\s+\$*\s*([0-9][0-9,]{2,})\s+or\s+(.+?)\s+\$*\s*([0-9][0-9,]{2,})\b/i);
  if (orMatch) {
    const baseDescription = cleanOptionPhrase(orMatch[1]);
    const secondPhrase = cleanOptionPhrase(orMatch[3]);
    if (baseDescription && secondPhrase) {
      options.push({ description: baseDescription, price: amountFromMatch(orMatch[2]) });
      options.push({
        description: /\ball\s+of\s+(?:it|that)\b|everything/i.test(secondPhrase)
          ? `${baseDescription} and all requested work`
          : isAddOnPhrase(secondPhrase)
            ? `${baseDescription} and ${secondPhrase}`
            : secondPhrase,
        price: amountFromMatch(orMatch[4]),
      });
      return options;
    }
  }

  return [];
}

function extractSlashPriceOptions(text) {
  const match = text.match(/\b(?:A\/B\s*)?\$?\s*([0-9][0-9,]{2,})\s*\/\s*\$?\s*([0-9][0-9,]{2,})(?:\s+(?:with\s+)?([A-Za-z\s]+?))?(?:[.;,]|$)/i);
  if (!match) return [];
  const trailing = asString(match[3]);
  const addOn = /vs\s+/i.test(trailing)
    ? cleanOptionPhrase(trailing.split(/vs\s+/i).at(-1))
    : cleanOptionPhrase(trailing);
  const explicitBase = /vs\s+/i.test(trailing)
    ? cleanOptionPhrase(trailing.split(/vs\s+/i)[0])
    : "";
  const baseDescription = cleanOptionPhrase(text.slice(0, match.index));
  const base = explicitBase || (/\b(tree|oak|pine|maple|limb|brush|stump|cleanup|work)\b/i.test(baseDescription)
    ? baseDescription
    : "basic tree work");
  return [
    { description: base, price: amountFromMatch(match[1]) },
    { description: addOn ? `${base} and ${addOn}` : `${base} and full requested work`, price: amountFromMatch(match[2]) },
  ];
}

function phraseHasWork(value) {
  return /remove|removal|haul|cut|trim|cleanup|clean|leave|debris|stump|grind|grinding|sweep|stack|wood|limb|brush|work|emergency|package|cheap|basic|normal|fancy|drop|clear|access|logs?/i.test(value);
}

function extractPackageOptions(text) {
  const packageMatches = Array.from(text.matchAll(/\b(cheap|basic|small|normal|full|big|fancy)\s+(?:package\s+)?([0-9][0-9,]{2,})\b/gi));
  if (packageMatches.length < 2) return [];
  const context = cleanOptionPhrase(text.slice(0, packageMatches[0].index));
  const base = /\b(tree|oak|pine|maple|limb|brush|stump|cleanup|work)\b/i.test(context) ? context : "quoted tree work";
  return packageMatches.slice(0, 4).map((match) => ({
    description: `${match[1].toLowerCase()} ${base}`,
    price: amountFromMatch(match[2]),
  }));
}

function extractImplicitOptionsFromRaw(rawInput) {
  const text = textForOptionExtraction(rawInput);
  const specialOptions = extractAddOnAmountOptions(text);
  if (specialOptions.length) return specialOptions.slice(0, 4);
  const slashOptions = extractSlashPriceOptions(text);
  if (slashOptions.length) return slashOptions.slice(0, 4);
  const packageOptions = extractPackageOptions(text);
  if (packageOptions.length) return packageOptions.slice(0, 4);

  const prices = Array.from(text.matchAll(/\$*\s*([0-9][0-9,]{2,})/g));
  if (!prices.length) return [];

  const options = [];
  let baseDescription = "";

  prices.forEach((priceMatch, index) => {
    const previousEnd = index === 0 ? 0 : prices[index - 1].index + prices[index - 1][0].length;
    const phrase = cleanOptionPhrase(text.slice(previousEnd, priceMatch.index));
    if (!phrase || !phraseHasWork(phrase)) return;
    const description = index > 0 && baseDescription && isAddOnPhrase(phrase)
      ? `${baseDescription} and ${phrase}`
      : phrase;
    if (!baseDescription) baseDescription = description;
    options.push({ description, price: Number(priceMatch[1].replaceAll(",", "")) });
  });

  const tail = prices.length
    ? text.slice(prices.at(-1).index + prices.at(-1)[0].length)
    : text;
  const tailAddOn = cleanOptionPhrase(tail);
  if (
    options.length === 1 &&
    baseDescription &&
    /\b(also|add|plus|in addition|then)\b/i.test(tail) &&
    tailAddOn &&
    isAddOnPhrase(tailAddOn)
  ) {
    options.push({ description: `${baseDescription} and ${tailAddOn}`, price: null });
  }

  return options.slice(0, 4);
}

function parseOptionBody(body) {
  const priceMatches = Array.from(body.matchAll(/\$*\s*([0-9][0-9,]{2,})/g));
  const priceMatch = priceMatches.at(-1);
  const amount = priceMatch ? Number(priceMatch[1].replaceAll(",", "")) : null;
  const before = cleanOptionPhrase(priceMatch ? body.slice(0, priceMatch.index) : body);
  const after = cleanOptionPhrase(priceMatch ? body.slice(priceMatch.index + priceMatch[0].length) : "");
  const description = phraseHasWork(before) || !after ? before : after;
  if (description || amount) return { description, price: amount };
  return null;
}

function extractLabeledOptionsFromRaw(rawInput) {
  const text = textForOptionExtraction(rawInput);
  const options = [];
  const patterns = [
    /\b(?:Option|Opt)\s*([A-E]|[1-5])\s*[:.)-]?\s*(.*?)(?=\b(?:Option|Opt)\s*(?:[A-E]|[1-5])\s*[:.)-]?\s*|$)/gi,
    /(?:^|\s)([A-E])\s+(.*?)(?=(?:\s+[A-E]\s+)|$)/gi,
  ];

  for (const regex of patterns) {
    options.length = 0;
    let match;
    while ((match = regex.exec(text))) {
      const parsed = parseOptionBody(match[2].trim());
      if (parsed && (phraseHasWork(parsed.description) || parsed.price)) options.push(parsed);
    }
    if (options.length >= 2 || (options.length === 1 && /option|opt/i.test(text))) return options;
  }

  return [];
}

function extractOptionsFromRaw(rawInput) {
  const labeledOptions = extractLabeledOptionsFromRaw(rawInput);
  return labeledOptions.length ? labeledOptions : extractImplicitOptionsFromRaw(rawInput);
}

function normalizeOptions(rawJson, rawInput) {
  const modelOptions = collectModelOptions(rawJson);
  const rawOptions = modelOptions.length ? modelOptions : extractOptionsFromRaw(rawInput);
  const normalized = rawOptions.map((option, index) => normalizeOption(option, index));
  return normalized
    .sort((a, b) => (a.price.amount || Number.MAX_SAFE_INTEGER) - (b.price.amount || Number.MAX_SAFE_INTEGER))
    .slice(0, 4)
    .map((option, index) => ({ ...option, label: `Option ${String.fromCharCode(65 + index)}`, sort_order: index + 1 }));
}

function extractNameFromRaw(rawInput) {
  const text = stripEmails(asString(rawInput)).replace(/\s+/g, " ");
  const namePattern = "([A-Za-z\\u00c0-\\u024f][A-Za-z\\u00c0-\\u024f.'-]+(?:,\\s*[A-Za-z\\u00c0-\\u024f][A-Za-z\\u00c0-\\u024f.'-]+|\\s+[A-Za-z\\u00c0-\\u024f][A-Za-z\\u00c0-\\u024f.'-]+){0,3})";
  const stopPattern = "(?=\\s*(?:--|;|\\.|,|\\n|\\d|call\\b|text\\b|phone\\b|email\\b|address\\b|service\\b|job\\b|contact\\b|later\\b|fallen\\b|scope\\b|wants?\\b|needs?\\b|says?\\b|remove\\b|take\\b|cut\\b|option\\b|$))";
  const patterns = [
    new RegExp(`\\b(?:note\\s+from|text\\s+from|send\\s+quote\\s+to|customer\\s+is|customer|client|lady\\s+named|guy|person)\\s+${namePattern}${stopPattern}`, "i"),
    new RegExp(`^\\s*${namePattern}\\s+(?:said|call\\/text|called\\s+from|called|call|text|phone|email|${PHONE_PATTERN.source})`, "i"),
    new RegExp(`(?:${PHONE_PATTERN.source}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,})\\s+(?:or\\s+)?${namePattern}${stopPattern}`, "i"),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = match?.[1];
    const cleaned = cleanCustomerName(candidate);
    if (cleaned && !/^(?:Text|Call|Or)$/i.test(cleaned)) return cleaned;
  }

  const beforePhone = text.split(PHONE_PATTERN)[0];
  return cleanCustomerName(beforePhone.replace(/[,\s]+$/g, ""));
}

function serviceZero(rawJson) {
  return Array.isArray(rawJson?.services) && rawJson.services.length ? rawJson.services[0] : {};
}

export function normalizeToAlphaJsonV14(rawJson = {}, rawInput = "") {
  const responseJson = isObject(rawJson) ? rawJson : {};
  const modelJson = isObject(responseJson.alphaJson) ? responseJson.alphaJson : responseJson;
  const providedNormalization = sanitizeNormalization(
    isObject(responseJson.alphaJson)
      ? responseJson.normalization || modelJson.normalization
      : modelJson.normalization,
  );
  const sourceRawInput = firstString(rawInput, modelJson?.raw_input?.customer_text, modelJson?.customer_text);
  const base = createDraftAlphaJson(sourceRawInput);
  const client = modelJson?.client || {};
  const customer = modelJson?.customer || {};
  const job = modelJson?.job || {};
  const service = modelJson?.service || {};
  const firstService = serviceZero(modelJson);
  const serviceTree = firstService?.tree || {};

  const name = cleanCustomerName(firstString(client.name, customer.name, modelJson.name, base.customer.name, extractNameFromRaw(sourceRawInput)));
  const phone = normalizePhone(firstString(client.phone, customer.phone, customer.contact?.phone, modelJson.phone, modelJson.phone_number, base.customer.phone_display, extractPhoneFromRaw(sourceRawInput)));
  const email = firstString(client.email, customer.email, customer.contact?.email, modelJson.email, modelJson.email_address, extractEmailFromRaw(sourceRawInput));
  const address = firstCleanAddress(
    client.service_address,
    customer.service_address,
    composeAddress(customer.address),
    composeAddress(job.address),
    composeAddress(job.service_address),
    modelJson.service_address,
    modelJson.address,
    extractAddressFromRaw(sourceRawInput),
    base.job.service_address.display,
  );
  const treeCount = normalizeTreeCount(
    firstString(
      service.tree_count_scope,
      firstService.tree_count,
      serviceTree.count,
      job.tree_count,
      modelJson.tree_count,
      base.job.tree_details.tree_count,
      extractTreeCountFromRaw(sourceRawInput),
    ),
  );
  const treeType = firstString(serviceTree.type, firstService.tree_type, job.tree_details?.tree_type, base.job.tree_details.tree_type, extractTreeTypeFromRaw(sourceRawInput));
  const treeSize = firstString(serviceTree.size, firstService.tree_size, job.tree_details?.tree_size, base.job.tree_details.tree_size);
  const location = firstString(serviceTree.location, firstService.location, job.condition_details, base.job.condition_details);
  const options = normalizeOptions(modelJson, sourceRawInput);
  const optionDescriptions = options.map((option) => option.description).filter(Boolean).join("; ");
  const description = firstString(
    job.description,
    service.description,
    firstService.description,
    modelJson.scope,
    optionDescriptions,
    rawTextWithoutLeadContact(sourceRawInput),
    base.job.description,
  );

  base.customer = {
    ...base.customer,
    ...customer,
    name,
    phone_primary: phone,
    phone_display: phone,
    email,
    display_name: name.slice(0, 30),
  };
  base.job = {
    ...base.job,
    ...job,
    service_address: {
      ...(base.job.service_address || {}),
      ...(typeof job.service_address === "object" ? job.service_address : {}),
      display: address,
    },
    description: normalizeTreeServiceText(description),
    condition_details: [location, job.condition_details].filter(Boolean).join(". "),
    tree_details: {
      ...(base.job.tree_details || {}),
      ...(job.tree_details || {}),
      tree_count: treeCount,
      tree_type: treeType,
      tree_size: treeSize,
    },
  };
  base.service_options = {
    ...(base.service_options || {}),
    max_normal_options: 4,
    items: options,
  };
  base.layout_flags = {
    ...(base.layout_flags || {}),
    option_count: options.length,
    over_normal_option_limit: collectModelOptions(modelJson).length > 4 || extractOptionsFromRaw(sourceRawInput).length > 4,
  };
  base.raw_input.customer_text = sourceRawInput;
  base.normalization = mergeNormalization(providedNormalization, buildBasicNormalizationFromRawInput(sourceRawInput, base));

  return base;
}
