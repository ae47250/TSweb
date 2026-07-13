import { createDraftAlphaJson, emptyNormalization } from "./alphaJson.js";
import { appendIndianaForLocalTown, LOCAL_TOWN_PATTERN } from "./localTowns.js";
import { buildOptionPriceCandidateView } from "./optionPriceNormalizer.js";
import { extractQuoteCleanupPricePair } from "./priceResolver.js";
import { annotateTreeServiceText, TREE_SERVICE_PATTERNS, TREE_SERVICE_PATTERN_SOURCES } from "./treeServiceLexicon.js";

const ADDRESS_SUFFIX =
  "(?:Street|St|Road|Rd|Ave|Avenue|Drive|Dr|Lane|Ln|Court|Ct|Way|Blvd|Boulevard|Highway|Hwy|Route|State Route|County Road|CR|Pike|Circle|Cir|Place|Pl|Terrace|Ter|Trail|Trl|Parkway|Pkwy|Bend|Main)";

const LOCAL_CITY_PATTERN = LOCAL_TOWN_PATTERN;
const US_STATE_PATTERN =
  "(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New\\s+Hampshire|New\\s+Jersey|New\\s+Mexico|New\\s+York|North\\s+Carolina|North\\s+Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode\\s+Island|South\\s+Carolina|South\\s+Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West\\s+Virginia|Wisconsin|Wyoming)";
const GENERIC_CITY_STATE_PATTERN = `([A-Za-z][A-Za-z.'-]*(?:\\s+[A-Za-z][A-Za-z.'-]*){0,3})(?:\\s*,\\s*|\\s+)(${US_STATE_PATTERN})(?:\\s+(\\d{5}(?:-\\d{4})?))?`;
const ADDRESS_STOP_WORD_PATTERN = new RegExp(
  `\\b(?:option|opt|price|quote|phone|email|near|by|beside|behind|over|along|toward|leaning|${TREE_SERVICE_PATTERN_SOURCES.baseService}|${TREE_SERVICE_PATTERN_SOURCES.addOnService}|${TREE_SERVICE_PATTERN_SOURCES.pruning}|trees?)\\b`,
  "i",
);

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

const AUTO_TREE_COUNT_MAX = 15;
const REVIEW_TREE_COUNT_MAX = 49;

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
  { pattern: /\bmapel\b/gi, original: "mapel", corrected: "maple", reason: "Corrected obvious tree-species typo." },
  { pattern: /\bmapl\b/gi, original: "mapl", corrected: "maple", reason: "Corrected obvious tree-species typo." },
  { pattern: /\bmple\b/gi, original: "mple", corrected: "maple", reason: "Corrected obvious tree-species typo." },
  { pattern: /\boke\s+tree\b/gi, original: "oke tree", corrected: "oak tree", reason: "Corrected obvious tree-species typo." },
  { pattern: /\bpin\s+tree\b/gi, original: "pin tree", corrected: "pine tree", reason: "Corrected obvious tree-species typo." },
  { pattern: /\bashy\b/gi, original: "ashy", corrected: "ash", reason: "Corrected obvious tree-species typo." },
  { pattern: /\bceder\b/gi, original: "ceder", corrected: "cedar", reason: "Corrected obvious tree-species typo." },
  { pattern: /\bspruse\b/gi, original: "spruse", corrected: "spruce", reason: "Corrected obvious tree-species typo." },
  { pattern: /\bsycamor\b/gi, original: "sycamor", corrected: "sycamore", reason: "Corrected obvious tree-species typo." },
  { pattern: /\bwalnutt\b/gi, original: "walnutt", corrected: "walnut", reason: "Corrected obvious tree-species typo." },
  { pattern: /\bhickry\b/gi, original: "hickry", corrected: "hickory", reason: "Corrected obvious tree-species typo." },
  { pattern: /\bovr\b/gi, original: "ovr", corrected: "over", reason: "Expanded shorthand typo." },
  { pattern: /\bhawl\b/gi, original: "hawl", corrected: "haul", reason: "Corrected haul-away typo." },
  { pattern: /\bhaila\s+way\b/gi, original: "haila way", corrected: "haul away", reason: "Corrected haul-away typo." },
  { pattern: /\bhaulaway\b/gi, original: "haulaway", corrected: "haul away", reason: "Corrected haul-away typo." },
  { pattern: /\brmv\b/gi, original: "rmv", corrected: "remove", reason: "Expanded tree-service shorthand." },
  { pattern: /\brmvl\b/gi, original: "rmvl", corrected: "removal", reason: "Expanded tree-service shorthand." },
  { pattern: /\bremvoe\b/gi, original: "remvoe", corrected: "remove", reason: "Corrected removal typo." },
  { pattern: /\bremuved\b/gi, original: "remuved", corrected: "removed", reason: "Corrected removal typo." },
  { pattern: /\bremuv\b/gi, original: "remuv", corrected: "remove", reason: "Corrected removal typo." },
  { pattern: /\bcutt\b/gi, original: "cutt", corrected: "cut", reason: "Corrected cut typo." },
  { pattern: /\btakedown\b/gi, original: "takedown", corrected: "take down", reason: "Expanded tree-service shorthand." },
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
  { pattern: /\bcleen\s+up\b/gi, original: "cleen up", corrected: "cleanup", reason: "Corrected cleanup typo." },
  { pattern: /\bcust\b/gi, original: "cust", corrected: "customer", reason: "Expanded customer shorthand." },
  { pattern: /\bmessd\s+up\b/gi, original: "messd up", corrected: "messed up", reason: "Corrected access-note typo." },
  { pattern: /\baggresiv\b/gi, original: "aggresiv", corrected: "aggressive", reason: "Corrected safety-note typo." },
  { pattern: /\bmite\s+bite\b/gi, original: "mite bite", corrected: "might bite", reason: "Corrected safety-note typo." },
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
const PHONE_LIKE_DIGIT_PATTERN = /\b(?:\d[\s().-]?){6,}\d\b/g;

function stripEmails(value) {
  return asString(value).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ");
}

function stripPhones(value) {
  return asString(value).replace(PHONE_PATTERN, " ");
}

function stripPhoneLikeNumbersForTreeCounts(value) {
  return stripPhones(value).replace(PHONE_LIKE_DIGIT_PATTERN, " ");
}

function stripPriceLikeNumbersForTreeCounts(value) {
  return asString(value)
    .replace(/\$?\s*(?:[0-9]{3,}|[0-9]{1,3},[0-9]{3})\s*\/\s*\$?\s*(?:[0-9]{3,}|[0-9]{1,3},[0-9]{3})/g, " ")
    .replace(/\$\s*[0-9][0-9,]*(?:\.\d{2})?/g, " ")
    .replace(/\b[0-9]{1,3},[0-9]{3}\b/g, " ");
}

function escapeRegExp(value) {
  return asString(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CUSTOMER_NAME_JOB_TEXT_PATTERN =
  /\b(?:oak|pine|maple|elm|ash|cedar|sycamore|hickory|locust|birch|spruce|walnut|cherry|tree|trees|limb|limbs|branch|branches|stump|brush|garage|garaje|yard|driveway|fence|remove|removal|take\s+down|take|cut|drop|trim|haul|cleanup|clean\s+up|grind|quote|option|opt)\b/i;
const CUSTOMER_NAME_PLACEHOLDER_PATTERN =
  /^(?:cust|customer|client|homeowner|name|no\s+name|unknown|none|n\/a|not\s+available)$/i;
const CUSTOMER_NAME_CUE_FRAGMENT_PATTERN =
  /^(?:wrote|written|write|says?|said|talked|spoke|called|texted)\b/i;
const CUSTOMER_NAME_NON_NAME_PATTERN =
  /\b(?:truck|trailer|pickup|van|car|suv|blue\s+truck|white\s+truck|red\s+truck|black\s+truck)\b/i;

function customerNameLooksLikeJobText(value) {
  const text = asString(value);
  return Boolean(text) && (/\d/.test(text) || CUSTOMER_NAME_JOB_TEXT_PATTERN.test(text));
}

function cleanCustomerName(value) {
  const rawCandidate = asString(value).replace(/^\s*[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b\s*/i, "");
  if (/@/.test(rawCandidate)) return "";

  let text = stripPhones(stripEmails(rawCandidate))
    .replace(/\b(?:note\s+from|text\s+from|send\s+quote\s+to|customer\s+is|customer|client|homeowner|lady\s+named|lady|guy|person|office\s+said\s+call|call\/text|called\s+from|called|call|texted|text|email\s+for\s+approval(?:\s+is)?|email|said|or|text\s+mess)\b[:\s-]*/gi, " ")
    .replace(/\b(?:maybe|no\s+phone\s+(?:in\s+note|written)(?:\s+no\s+email)?|no\s+email|contact\s+later|email\s+only|estimate\s+from\s+yesterday|from\s+yesterday)\b.*$/i, "")
    .replace(/\b(?:phone|email|service|address|job|lives?|wants?|needs?|says?|property|place|at|on|remove|removal|take|cut|drop|tree|trees?|stump|option)\b.*$/i, "")
    .replace(/\s+\d+\b.*$/i, "")
    .replace(/\b(?:no|only|contact(?:\s+later)?|later)\b\s*$/i, "")
    .replace(/\/\s*(?:text|call)\b/gi, " ")
    .replace(/[,:;.?\s-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const reversed = text.match(/^([A-Za-z\u00c0-\u024f][A-Za-z\u00c0-\u024f.'-]+),\s*([A-Za-z\u00c0-\u024f][A-Za-z\u00c0-\u024f.'-]+)$/);
  if (reversed) text = `${reversed[2]} ${reversed[1]}`;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 4) text = words.slice(0, 4).join(" ");
  if (/\b(?:text\s+only|works\s+nights|customer\s+works)\b/i.test(text)) return "";
  if (CUSTOMER_NAME_PLACEHOLDER_PATTERN.test(text)) return "";
  if (CUSTOMER_NAME_CUE_FRAGMENT_PATTERN.test(text)) return "";
  if (CUSTOMER_NAME_NON_NAME_PATTERN.test(text)) return "";
  if (/^price$/i.test(text)) return "";
  if (/^(?:and|or|is|email|phone|approval|for\s+approval(?:\s+is)?|email\s+for\s+approval(?:\s+is)?)$/i.test(text)) return "";
  if (customerNameLooksLikeJobText(text)) return "";
  return titleCaseName(text);
}

function firstCleanCustomerName(...values) {
  for (const value of values) {
    const cleaned = cleanCustomerName(value);
    if (cleaned) return cleaned;
  }
  return "";
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
  const jobWords = new RegExp(`\\b(?:option|quote|${TREE_SERVICE_PATTERN_SOURCES.workScope})\\b`, "i");
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
    .replace(/^\s*Follow-up\s+\d+\s*:\s*/gim, "")
    .replace(/\bFollow-up\s+details\s*:\s*/gi, "");
}

function stripInternalOperationalNotes(value) {
  return asString(value)
    .replace(/\b(?:text\s+only|customer\s+works\s+nights|works\s+nights|sent\s+from\s+phone|thanks,\s*sent\s+from\s+phone)[^.!?;]*(?:[.!?;]|$)/gi, " ")
    .replace(/\b(?:urgent\s+but\s+)?not\s+on\s+power\s+line\s*:\s*/gi, " ")
    .replace(/\b(?:heads?\s+up[:\s-]*)?(?:aggressive\s+dog|dog|blocked\s+access|no\s+access|access\s+(?:is\s+)?bad|gate\s+(?:is\s+)?(?:messed|damaged|broken)|call\s+before\s+entering|crew\s+should\s+call\s+before\s+entering|do\s+not\s+(?:enter|go\s+in))[^.!?;]*(?:[.!?;]|$)/gi, " ")
    .replace(/\b(?:near\s+)?(?:power\s*lines?|service\s+drop|wires?|electric)[^.!?;]*(?:[.!?;]|$)/gi, " ")
    .replace(/\b(?:crew\s+needs?\s+caution|crew\s+caution|gate\s+blocked|blocked\s+by\s+trailer|trailer\s+blocking\s+access)[^.!?;]*(?:[.!?;]|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripAddressEvidence(value) {
  const addressPattern = new RegExp(
    `\\b\\d+\\s+(?:[A-Za-z0-9.]+\\s+){0,5}${ADDRESS_SUFFIX}\\b(?:\\s*(?:,|-|in)?\\s*${LOCAL_CITY_PATTERN}\\b(?:,?\\s*(?:Indiana|IN))?)?`,
    "gi",
  );
  return asString(value)
    .replace(addressPattern, " ")
    .replace(/\b(?:exact\s+)?service\s+address\b\s*(?:is|at)?\s*(?=\s*(?:--|[-.;,]|$))/gi, " ")
    .replace(/\b(?:exact\s+)?service\s+address\b\s*(?:is|at)?\s*/gi, " ")
    .replace(/\b(?:job|service)\s+at\b\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeKnownValue(text, value) {
  const known = asString(value);
  if (!known) return text;
  return text.replace(new RegExp(escapeRegExp(known), "gi"), " ");
}

function cleanCorrectedInterpretation(value, alphaJson = null) {
  let text = stripStructuredContactLines(stripFollowUpLines(value))
    .replace(/\bFollow-up\s+(?:\d+|details)\s*:\s*/gi, " ")
    .replace(/\b(?:Customer\s+name|Customer\s+phone|Customer\s+email|Service\s+address|Exact\s+service\s+address)\s*:\s*/gi, " ")
    .replace(/\b(?:called\s+from|call(?:ed)?|phone|email(?:\s+for\s+approval)?)\b/gi, " ")
    .replace(/\bcustomer\s+wants?\s+text\s+no(?:\s+call)?\b[.,;?]*/gi, " ")
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

  return stripInternalOperationalNotes(stripAddressEvidence(normalizeTreeServiceText(text)))
    .replace(/\b([A-Za-z]+)(?:\s+\1\b)+/gi, "$1")
    .replace(/\b(?:the\s+)?customer\s+can\s+be\s+(?:reached|contacted)\s+(?:by|at|by\s+at)?\b[\s.,;:-]*/gi, " ")
    .replace(/\b(?:can\s+be\s+(?:reached|contacted)|is\s+requesting)\s+(?:by|at|by\s+at)\b[\s.,;:-]*/gi, " ")
    .replace(/\b(?:by\s+at|by\s+at\.|at\s+by)\b/gi, " ")
    .replace(/\bat\s*,\s*(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)(?:\s*,\s*(?:Indiana|IN))?\b/g, " ")
    .replace(/\bThe\s*,\s*(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)(?:\s*,\s*(?:Indiana|IN))?\s*[.!?]?/g, " ")
    .replace(/\b(?:at|by|in|for|with|and)\s*(?=[.!?]|$)/gi, " ")
    .replace(/\b(?:and\s+are\s+provided\s*,?\s+but\s+the\s*,?|but\s+the\s*,)\b/gi, " ")
    .replace(/^[\s.,;:-]+/g, "")
    .replace(/^(?:and|or|then|also)\b[\s.,;:-]*/i, "")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/(?:^|[.!?]\s+)(?:The|A|An)\s*[.!?](?=\s|$)/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/\b(?:and|or)\s*[.,;:]\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanCustomerFacingSummary(value, alphaJson = null) {
  return cleanCorrectedInterpretation(value, alphaJson);
}

function sentenceCase(value) {
  const text = asString(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  return `${text[0].toLocaleUpperCase()}${text.slice(1)}`;
}

function ensureSentence(value) {
  const text = sentenceCase(value).replace(/[,\s.;:-]+$/g, "").trim();
  return text ? `${text}.` : "";
}

function countWords(value) {
  const text = asString(value);
  if (/5\+/.test(text)) return "5+";
  const number = text.match(/\b\d+\b/)?.[0];
  if (!number) return "";
  if (number === "1") return "one";
  if (number === "2") return "two";
  if (number === "3") return "three";
  if (number === "4") return "four";
  return number;
}

function humanizeLeadingCount(value) {
  return asString(value).replace(/^\s*(1|2|3|4)\b/, (match) => {
    if (match.trim() === "1") return "one";
    if (match.trim() === "2") return "two";
    if (match.trim() === "3") return "three";
    if (match.trim() === "4") return "four";
    return match;
  });
}

function optionTextForSummary(alphaJson) {
  return (alphaJson.service_options?.items || [])
    .map((option) => [option.title, option.description].filter(Boolean).join(" "))
    .join(" ");
}

function sourceTextForSummary(alphaJson) {
  return cleanCorrectedInterpretation(
    [
      alphaJson.normalization?.field_evidence?.work_scope,
      alphaJson.normalization?.field_evidence?.tree_count,
      alphaJson.normalization?.corrected_interpretation,
      alphaJson.raw_input?.customer_text,
      alphaJson.job?.description,
    ].filter(Boolean).join(" "),
    alphaJson,
  );
}

function actionForSummary(alphaJson) {
  const text = `${alphaJson.job?.description || ""} ${optionTextForSummary(alphaJson)}`;
  const hasTreeDetails = Boolean(alphaJson.job?.tree_details?.tree_count || alphaJson.job?.tree_details?.tree_type);
  if (/\btrim|trimming\b/i.test(text)) return "Trim";
  if (hasTreeDetails) return "Remove";
  if (/\bhaul|cleanup|clean up|brush\b/i.test(text) && !/\bremove|removal|take down|cut down|drop\b/i.test(text)) {
    return "Perform";
  }
  return "Remove";
}

function normalizeLocationForSummary(value) {
  const text = asString(value)
    .replace(/\b(?:for|price|quoted|option)\b.*$/i, "")
    .replace(/\bwith\s+(?:two|three|different\s+)?options?\b.*$/i, "")
    .replace(/\bat\s+(?:his|her|their)\b.*$/i, "")
    .replace(/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:[a-z]+\s+){0,4}trees?\b.*$/i, "")
    .replace(/\b(?:customer|client|homeowner|tree|trees?)\s+(?:has\s+)?(?:wants?|would\s+like|requested|requests?|is\s+requesting|needs?)\b.*$/i, "")
    .replace(/\b(?:has\s+)?(?:requested|requests?|wants?|needs?)\s+(?:the\s+)?(?:removal|remove|trim|cut|estimate)\b.*$/i, "")
    .replace(/\b(?:at|by|in|for|with|and|but|as|is|the|a|an)\s*$/i, "")
    .replace(/\bthe\s+a\b/gi, "the")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || /\b(customer|phone|email|address|note lists|tree needing|service option)\b/i.test(text)) return "";

  const match = text.match(/^(near|by|beside|behind|over|along|close to|in|toward|leaning toward)\s+(?:the\s+)?(.+)$/i);
  if (!match) return text;

  const preposition = match[1].toLowerCase();
  const target = match[2]
    .replace(/\b(?:tree|trees)\b.*$/i, "")
    .replace(/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b.*$/i, "")
    .trim();
  const cleanedTarget = target
    .replace(/^(?:the\s+)?(?:his|her|their|my|our)\s+/i, "")
    .replace(/^(?:the\s+)?(?:there\s+are|there\s+is|he\s+wants?|she\s+wants?|they\s+want|customer\s+wants?|customer\s+needs?|client\s+wants?|client\s+needs?)\b.*$/i, "")
    .replace(/\b(?:remove|removed|removal|trim|trimming|cut|drop|take\s+down)\b.*$/i, "")
    .replace(/\b(?:at|by|in|for|with|and|but|as|is|the|a|an)\s*$/i, "")
    .replace(/\b(?:need|needs|if\s+it)\s*$/i, "")
    .replace(/\bthe\s+a\b/gi, "the")
    .trim();
  if (!cleanedTarget) return "";
  if (/\b(?:there|wants?|needs?|customer|client)\b/i.test(cleanedTarget)) return "";

  if (preposition === "by" || preposition === "close to") return `near the ${cleanedTarget}`;
  if (/^(near|beside|behind|over|along)$/.test(preposition)) return `${preposition} the ${cleanedTarget}`;
  if (/^(toward|leaning toward)$/.test(preposition)) return `leaning toward the ${cleanedTarget}`;
  return text;
}

function locationForSummary(alphaJson) {
  const text = sourceTextForSummary(alphaJson);
  const match = text.match(/\b(?:near|by|beside|behind|over|along|close to|toward|leaning toward)\s+(?:the\s+)?[^.!?;,$]{2,48}/i);
  if (!match) return "";
  return normalizeLocationForSummary(match[0]);
}

function sizeForSummary(alphaJson) {
  const explicitSize = asString(alphaJson.job?.tree_details?.tree_size);
  if (/^(?:large|big|small|dead|storm damaged|storm-damaged)$/i.test(explicitSize)) {
    return explicitSize.replace(/-/g, " ").toLowerCase() === "big" ? "large" : explicitSize.replace(/-/g, " ").toLowerCase();
  }

  const text = sourceTextForSummary(alphaJson);
  const match = text.match(/\b(?:large|big|small|dead|storm[-\s]+damaged)\s+(?:[a-z]+\s+){0,2}trees?\b/i);
  if (!match) return "";
  const descriptor = match[0].match(/\b(?:large|big|small|dead|storm[-\s]+damaged)\b/i)?.[0] || "";
  return descriptor.toLowerCase() === "big" ? "large" : descriptor.toLowerCase().replace(/-/g, " ");
}

function optionDescriptionLooksMissing(value) {
  const text = asString(value);
  return !text ||
    /^service option [A-E]$/i.test(text) ||
    /^option [A-E]$/i.test(text) ||
    /^no descriptions?$/i.test(text) ||
    /\bwork\s+scope\s+unclear\b|\bscope\s+unclear\b/i.test(text);
}

function pricedOptionsNeedSummaryDescriptions(alphaJson) {
  const options = alphaJson.service_options?.items || [];
  const pricedOptions = options.filter((option) => option?.price?.display || option?.price?.amount);
  return pricedOptions.length > 0 && pricedOptions.every((option) => optionDescriptionLooksMissing(option.description));
}

function blockedCaseSummaryCandidate(alphaJson) {
  const source = sourceTextForSummary(alphaJson);
  const location = locationForSummary(alphaJson);

  if (hasVagueTreeCountEvidence(source)) {
    const core = ensureSentence(`${actionForSummary(alphaJson)} several trees${location ? ` ${location}` : ""}`);
    return `${core} Exact tree count needs confirmation.`;
  }

  if (/\b(?:tree\s+)?remov(?:e|ed|al)?\s+maybe\b|\bmaybe\s+(?:tree\s+)?remov(?:e|ed|al)?\b/i.test(source)) {
    return "Possible tree removal. Scope and firm price need confirmation.";
  }

  if (pricedOptionsNeedSummaryDescriptions(alphaJson)) {
    return "Priced service options need work-scope descriptions.";
  }

  return "";
}

function cleanSummaryCandidate(value, alphaJson) {
  const text = cleanCorrectedInterpretation(value, alphaJson)
    .replace(/\$?\s*[0-9][0-9,]{2,}(?:\.\d{2})?\b/g, " ")
    .replace(/\bthe\s+a\b/gi, "the")
    .replace(/\b(?:for|at|by|with|and|but|as|is)\s*(?=[.!?]|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  if (/\b(?:customer|phone|email|service address|raw notes?|follow-up|note lists|tree needing removal is|internal evidence)\b/i.test(text)) return "";
  if (/\b(?:but the work|as, but|is\s*[.,]|the work\s*$)\b/i.test(text)) return "";
  if (/;/.test(text)) return "";
  if (/^(?:drop|cut|remove|trim|haul|cleanup|clean up)(?:\s+only)?$/i.test(text)) return "";
  if (/^(?:drop|cut|remove|trim)(?:\s+(?:plus\s+)?(?:haul(?:\s+away)?|cleanup|clean\s+up|leave\s+wood|stack\s+wood|stump(?:\s+grind)?))*$/i.test(text)) return "";
  if (!/\b(remove|removal|trim|trimming|cut|drop|take down|haul|cleanup|clean|grind|stump|limb|brush|tree|trees)\b/i.test(text)) return "";
  return ensureSentence(text);
}

function summaryHasDisplayRisk(value, alphaJson = {}) {
  const text = asString(value);
  if (!text) return true;
  const normalized = text.replace(/\s+/g, " ").trim();
  const address = asString(alphaJson.job?.service_address?.display);

  if (!/^[A-Z]/.test(normalized)) return true;
  if (!/[.!?]$/.test(normalized)) return true;
  if (/;/.test(normalized)) return true;
  if (/\b(?:at|by|in|for|with|and|but|as|is|the|a|an)\s*[,.!?]?\s*$/i.test(normalized.replace(/[.!?]$/, ""))) return true;
  if (/\bthe\s+a\b/i.test(normalized)) return true;
  if (/\bwith\s+(?:two|three|different\s+)?options?\b/i.test(normalized)) return true;
  if (/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+trees?\s+(?:has\s+)?(?:wants?|would\s+like|requested|requests?|is\s+requesting|needs?|as\s+requested|remove\b)/i.test(normalized)) return true;
  if (/\btrees?\s+(?:has\s+)?(?:wants?|would\s+like|requested|requests?|is\s+requesting|needs?)\b/i.test(normalized)) return true;
  if (/\b(?:at\s*,|by\s+at|at\s+by|located\s+at\s*[.]|with\s+and|and\s+are\s+provided|can\s+be\s+(?:reached|contacted)\s+(?:by\s+at|at\s+the|at)\b|customer\s+with\s+number\s+and\s+at)\b/i.test(normalized)) return true;
  if (/\b(?:The\s*,|at\s*,\s*[A-Z][a-z]+|The\s+customer\s+can\s+be\s+reached\s+at\s+The)\b/.test(normalized)) return true;
  if (/\bPerform\s+(?:one|two|three|four|\d+)?\s*(?:[a-z]+\s+)?trees?\b/i.test(normalized)) return true;
  if (/^(?:Drop|Cut|Remove|Trim|Haul|Cleanup|Clean up)(?:\s+only)?[.!?]$/i.test(normalized)) return true;
  if (/^(?:Drop|Cut|Remove|Trim)(?:\s+(?:plus\s+)?(?:haul(?:\s+away)?|cleanup|clean\s+up|leave\s+wood|stack\s+wood|stump(?:\s+grind)?))*[.!?]$/i.test(normalized)) return true;
  if (/\b(?:Tree Dude|raw notes?|customer name|customer phone|customer email|parser|evidence|follow-up|internal|note lists|tree needing removal is|text only|works nights|sent from phone|main work)\b|\bwork\s*:/i.test(normalized)) return true;
  if (/\b(?:aggressive\s+dog|dog\s+in\s+yard|gate\s+blocked|blocked\s+by\s+trailer|trailer\s+blocking\s+access|blocked\s+access|no\s+access|access\s+(?:is\s+)?bad|power\s*lines?|service\s+drop|wires?|electric|crew\s+caution|crew\s+needs?\s+caution|call\s+before\s+entering|do\s+not\s+(?:enter|go\s+in)|fence\s+damage|neighbor\s+fence|leaning\s+toward|touching|across\s+(?:drive|driveway|road|gate)|emergency|same-?day)\b/i.test(normalized)) return true;
  if (/\b(?:State\s+Road|State\s+Route|Route|County\s+Road|Highway|Hwy)\s+\d+\b/i.test(normalized)) return true;
  if (/\b(?:IN|Indiana)\s+(?:remove|trim|cut|drop|take\s+down|haul|cleanup|tree)\b/i.test(normalized)) return true;
  if (address && normalized.toLowerCase().includes(address.toLowerCase())) return true;
  return false;
}

function serviceModifierSummary(alphaJson = {}) {
  const text = (alphaJson.service_options?.items || [])
    .map((option) => option.description || option.title || "")
    .join(" ");
  const normalized = normalizeTreeServiceText(text);
  const modifiers = [];

  if (/\bleave\s+(?:wood|logs)|stack\s+(?:wood|logs)\b/i.test(normalized)) modifiers.push("leaving wood on site");
  if (/\bhaul(?:\s+away|\s+off)?|haul\s+debris|remove\s+(?:all\s+)?debris|haul\s+everything\b/i.test(normalized)) {
    modifiers.push("haul away");
  }
  if (/\bcleanup|clean\s+up|sweep\b/i.test(normalized)) modifiers.push("cleanup");
  if (/\bstump\s+(?:grind|grinding)|grind\s+(?:stumps?|the\s+stump)\b/i.test(normalized)) modifiers.push("stump grinding");

  const unique = [...new Set(modifiers)];
  if (!unique.length) return "";
  if (unique.length === 1) return ensureSentence(`Options include ${unique[0]}`);
  return ensureSentence(`Options include ${unique.slice(0, -1).join(", ")} or ${unique.at(-1)}`);
}

function withSafeServiceModifiers(coreSummary, alphaJson) {
  const core = safeSummaryOrFallback(coreSummary, alphaJson);
  if (core === "Tree service work as described in the selected quote option.") return core;
  const modifierSentence = serviceModifierSummary(alphaJson);
  if (!modifierSentence) return core;
  const combined = `${core} ${modifierSentence}`;
  return summaryHasDisplayRisk(combined, alphaJson) ? core : combined;
}

function safeSummaryOrFallback(candidate, alphaJson) {
  return summaryHasDisplayRisk(candidate, alphaJson)
    ? "Tree service work as described in the selected quote option."
    : candidate;
}

export function buildCustomerJobSummary(alphaJson = {}) {
  const tree = alphaJson.job?.tree_details || {};
  const countedSpecies = extractCountedSpeciesDetails(alphaJson.raw_input?.customer_text || sourceTextForSummary(alphaJson));
  const treeType = asString(tree.tree_type);
  const treeCountWord = countWords(tree.tree_count);
  const action = actionForSummary(alphaJson);
  const location = locationForSummary(alphaJson);
  const size = sizeForSummary(alphaJson);

  if (countedSpecies?.phrase && Number(countedSpecies.count) > 1) {
    const withLocation = ensureSentence(`${action} ${humanizeLeadingCount(countedSpecies.phrase)}${location ? ` ${location}` : ""}`);
    if (!summaryHasDisplayRisk(withLocation, alphaJson)) return withSafeServiceModifiers(withLocation, alphaJson);
  }

  if (treeCountWord || treeType) {
    const quantity = treeCountWord || "";
    const type = treeType ? `${treeType} ` : "";
    const sizeText = size ? `${size} ` : "";
    const noun = treeCountWord === "one" ? "tree" : "trees";
    const core = `${action} ${[quantity, `${sizeText}${type}${noun}`.trim()].filter(Boolean).join(" ")}`;
    const withLocation = ensureSentence(`${core}${location ? ` ${location}` : ""}`);
    if (!summaryHasDisplayRisk(withLocation, alphaJson)) return withSafeServiceModifiers(withLocation, alphaJson);
    return withSafeServiceModifiers(ensureSentence(core), alphaJson);
  }

  const blockedCandidate = blockedCaseSummaryCandidate(alphaJson);
  if (blockedCandidate) return safeSummaryOrFallback(blockedCandidate, alphaJson);

  const jobCandidate = cleanSummaryCandidate(alphaJson.job?.description || "", alphaJson);
  if (jobCandidate) return safeSummaryOrFallback(jobCandidate, alphaJson);

  const optionCandidate = (alphaJson.service_options?.items || [])
    .map((option) => cleanSummaryCandidate(option.description || option.title || "", alphaJson))
    .find(Boolean);
  if (optionCandidate) return safeSummaryOrFallback(optionCandidate, alphaJson);

  return "Tree service work as described in the selected quote option.";
}

function textFromFirstWorkCue(value) {
  const text = normalizeTreeServiceText(stripEmails(stripStructuredContactLines(stripContactOnlyFollowUpLines(value))))
    .replace(PHONE_PATTERN, " ")
    .trim();
  const match = text.match(
    /\b(?:remove|removed|removal|trim|trimming|cut|drop|take\s+down|haul|cleanup|clean|grind|(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:[a-z]+\s+){0,4}(?:trees?|limbs?|branches?|stumps?|brush|oaks?|maples?|pines?|elms?|ashes?|cedars?|sycamores?|hickories?|locusts?|birches?))\b/i,
  );
  return match ? text.slice(match.index).trim() : rawTextWithoutLeadContact(value);
}

function buildEvidenceViews(rawInput) {
  const rawEvidence = asString(rawInput);
  const contactOnlyFollowUpsRemoved = stripContactOnlyFollowUpLines(rawEvidence);
  const normalizedEvidence = normalizeTreeServiceText(rawEvidence);
  return {
    rawEvidence,
    contactAddressEvidence: normalizedEvidence,
    optionPriceEvidence: normalizeTreeServiceText(contactOnlyFollowUpsRemoved),
    customerJobSummaryEvidence: textFromFirstWorkCue(contactOnlyFollowUpsRemoved),
  };
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

function sanitizeLowConfidenceSpan(item) {
  if (!isObject(item)) return null;
  const field = asString(item.field);
  const text = asString(item.text);
  const reason = asString(item.reason);
  if (!field && !text && !reason) return null;
  const confidence = asString(item.confidence);
  return {
    field,
    text,
    reason,
    confidence: /^(?:low|medium|unknown)$/i.test(confidence) ? confidence.toLowerCase() : "unknown",
  };
}

function sanitizeNumberTrace(item) {
  if (!isObject(item)) return null;
  const raw = asString(item.raw);
  const normalized = asString(item.normalized);
  const context = asString(item.context);
  if (!raw && !normalized && !context) return null;
  const classification = asString(item.classification);
  return {
    raw,
    normalized,
    classification: /^(?:phone|price|address|tree_count|other)$/i.test(classification) ? classification.toLowerCase() : "other",
    field: asString(item.field),
    reason: asString(item.reason),
    context,
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
  normalized.low_confidence_spans = Array.isArray(value.low_confidence_spans)
    ? value.low_confidence_spans.map(sanitizeLowConfidenceSpan).filter(Boolean)
    : [];
  normalized.number_trace = Array.isArray(value.number_trace)
    ? value.number_trace.map(sanitizeNumberTrace).filter(Boolean)
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

function numberTraceContext(text, start, end) {
  return text.slice(Math.max(0, start - 36), Math.min(text.length, end + 36)).replace(/\s+/g, " ").trim();
}

function buildNumberTrace(rawInput) {
  const source = asString(rawInput);
  if (!source) return [];

  const traces = [];
  const addTrace = (trace) => {
    const sanitized = sanitizeNumberTrace(trace);
    if (!sanitized) return;
    const key = `${sanitized.raw}\u0000${sanitized.classification}\u0000${sanitized.context}`;
    if (traces.some((item) => `${item.raw}\u0000${item.classification}\u0000${item.context}` === key)) return;
    traces.push(sanitized);
  };

  for (const match of source.matchAll(PHONE_PATTERN)) {
    addTrace({
      raw: match[0],
      normalized: normalizePhone(match[0]),
      classification: "phone",
      field: "customer.phone",
      reason: "Matched phone-number pattern.",
      context: numberTraceContext(source, match.index, match.index + match[0].length),
    });
  }

  const address = extractAddressFromRaw(source);
  if (address) {
    addTrace({
      raw: address,
      normalized: normalizeServiceAddress(address),
      classification: "address",
      field: "job.service_address",
      reason: "Matched service-address pattern.",
      context: address,
    });
  }

  for (const match of source.matchAll(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:[a-z]+\s+){0,4}trees?\b/gi)) {
    const count = countTokenToNumber(match[1]);
    if (!count || treeCountRangeStatus(count, { allowReviewRange: true }) !== "accepted") continue;
    addTrace({
      raw: match[0],
      normalized: `${count} ${count === 1 ? "tree" : "trees"}`,
      classification: "tree_count",
      field: "job.tree_details.tree_count",
      reason: "Number is attached to tree-count wording.",
      context: numberTraceContext(source, match.index, match.index + match[0].length),
    });
  }

  const priceSource = textForOptionExtraction(source);
  for (const match of priceSource.matchAll(/\$*\s*([0-9][0-9,]{2,})/g)) {
    if (!isLikelyPriceMatch(priceSource, match)) continue;
    const amount = amountFromMatch(match[1]);
    addTrace({
      raw: match[0].trim(),
      normalized: amount ? money(amount) : "",
      classification: "price",
      field: "service_options.items.price",
      reason: "Number appears in option or quote-price context.",
      context: numberTraceContext(priceSource, match.index, match.index + match[0].length),
    });
  }

  for (const match of source.matchAll(/\b\d[\d,]*\b/g)) {
    const raw = match[0];
    if (raw.replace(/\D/g, "").length < 3) continue;
    const alreadyClassified = traces.some((trace) => trace.classification !== "other" && (trace.raw.includes(raw) || trace.context.includes(raw)));
    if (alreadyClassified) continue;
    addTrace({
      raw,
      normalized: raw,
      classification: "other",
      field: "",
      reason: "Number was not classified as phone, price, address, or tree count.",
      context: numberTraceContext(source, match.index, match.index + raw.length),
    });
  }

  return traces.slice(0, 30);
}

function buildBasicNormalizationFromRawInput(rawInput, alphaJson) {
  const normalized = emptyNormalization();
  const evidenceViews = buildEvidenceViews(rawInput);
  const correctedText = cleanCorrectedInterpretation(evidenceViews.customerJobSummaryEvidence, alphaJson);
  normalized.corrected_interpretation = correctedText;
  normalized.corrections_made = collectCorrections(rawInput);
  normalized.uncertainties = buildBasicUncertainties(rawInput);
  normalized.number_trace = buildNumberTrace(rawInput);
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
  normalized.tree_service_lexicon = annotateTreeServiceText(rawInput);
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
    low_confidence_spans: uniqueBy(
      [...(provided.low_confidence_spans || []), ...(basic.low_confidence_spans || [])],
      (item) => `${item.field}\u0000${item.text}\u0000${item.reason}`,
    ),
    number_trace: uniqueBy(
      [...(provided.number_trace || []), ...(basic.number_trace || [])],
      (item) => `${item.raw}\u0000${item.classification}\u0000${item.context}`,
    ),
    field_evidence: {
      ...basic.field_evidence,
      ...provided.field_evidence,
    },
    tree_service_lexicon: basic.tree_service_lexicon,
  };
}

function evidenceValues(value) {
  if (Array.isArray(value)) return value.map(asString).filter(Boolean);
  const text = asString(value);
  if (!text) return [];
  return text
    .split(/\s*;\s*|\s*\n\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasNormalizationUncertainty(normalization, fields) {
  const fieldSet = new Set(fields.map((field) => field.toLowerCase()));
  return (normalization.uncertainties || []).some((item) => fieldSet.has(asString(item.field).toLowerCase()));
}

function combinedNormalizationEvidence(normalization, keys) {
  return [
    normalization.corrected_interpretation,
    ...keys.flatMap((key) => evidenceValues(normalization.field_evidence?.[key])),
  ]
    .filter(Boolean)
    .join(". ");
}

function hasVagueTreeCountEvidence(text) {
  const value = asString(text);
  const pluralIncidentMatch = value.match(/\b(?:fallen|leaning|dead|storm[-\s]+damaged)\s+trees\b/i);
  if (pluralIncidentMatch) {
    const prefix = value.slice(Math.max(0, pluralIncidentMatch.index - 40), pluralIncidentMatch.index);
    if (!/(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:[a-z]+\s+){0,3}$/i.test(prefix)) return true;
  }
  return /\btree\s+stuff\b|\b(?:several|multiple|some|a\s+few|few|couple)\s+(?:[a-z]+\s+){0,4}trees?\b|\bone\s+tree\s+or\s+(?:several|more|multiple)\b|\ba?\s*tree\s+or\s+maybe\s+more\b/i.test(value);
}

function isPlaceholderOptionText(value) {
  const text = asString(value);
  return !text || /^service option [A-E]$/i.test(text) || /^option [A-E]$/i.test(text);
}

function optionNeedsDescription(option) {
  return isPlaceholderOptionText(option?.description);
}

function optionNeedsTitle(option) {
  return isPlaceholderOptionText(option?.title);
}

function optionNeedsPrice(option) {
  return !(option?.price?.display || option?.price?.amount);
}

function isPlaceholderWorkDescription(value) {
  const description = asString(value);
  if (!description) return true;
  const parts = description.split(/\s*;\s*/).filter(Boolean);
  return parts.length > 0 && parts.every((part) => /^service option [A-E]$/i.test(part) || /^option [A-E]$/i.test(part));
}

function jobNeedsDescription(alphaJson) {
  return isPlaceholderWorkDescription(alphaJson.job?.description);
}

function normalizedEvidenceOptions(normalization) {
  const optionEvidence = evidenceValues(normalization.field_evidence?.options);
  const priceEvidence = evidenceValues(normalization.field_evidence?.price);
  const correctedOptions = extractOptionsFromRaw(normalization.corrected_interpretation || "");
  const rawOptions = optionEvidence.map((text, index) => {
    const parsed = parseOptionBody(text);
    return {
      description: parsed?.description || text,
      price: parsed?.price || priceEvidence[index] || "",
    };
  });
  const candidates = rawOptions.length ? rawOptions : correctedOptions;
  return candidates
    .map((option, index) => {
      const normalized = normalizeOption(option, index);
      return optionNeedsTitle(normalized) && normalized.description
        ? { ...normalized, title: normalized.description }
        : normalized;
    })
    .filter((option) => option.description || option.price.display);
}

function rawOptionLabelToken(option) {
  const text = firstString(option?.raw_label, option?.label, option?.title, option?.name);
  const letterMatch = text.match(/^(?:Option|Opt)?\s*([A-E])\b/i);
  if (letterMatch) return letterMatch[1].toUpperCase();
  const numberMatch = text.match(/^(?:Option|Opt)?\s*([1-5])\b/i);
  if (!numberMatch) return "";
  return String.fromCharCode(64 + Number(numberMatch[1]));
}

function sortAndRelabelOptions(options) {
  const labeled = options.filter((option) => rawOptionLabelToken(option));
  const shouldSortByRawLabel = labeled.length > 0 && options.length <= 4;
  const ordered = shouldSortByRawLabel
    ? [...options].sort((a, b) => {
        const labelA = rawOptionLabelToken(a);
        const labelB = rawOptionLabelToken(b);
        if (labelA && labelB) return labelA.localeCompare(labelB);
        if (labelA) return -1;
        if (labelB) return 1;
        return (a.sort_order || 0) - (b.sort_order || 0);
      })
    : options.some((option) => option.preserve_order)
    ? [...options]
    : [...options].sort((a, b) => (a.price?.amount || Number.MAX_SAFE_INTEGER) - (b.price?.amount || Number.MAX_SAFE_INTEGER));
  return ordered
    .slice(0, 4)
    .map((option, index) => {
      const token = rawOptionLabelToken(option);
      return {
        ...option,
        label: token ? `Option ${token}` : `Option ${String.fromCharCode(65 + index)}`,
        sort_order: index + 1,
      };
    });
}

function optionAmount(option) {
  const amount = Number(option?.price?.amount ?? option?.price?.min_amount);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function baseJobScopePhrase(alphaJson) {
  const tree = alphaJson.job?.tree_details || {};
  const action = actionForSummary(alphaJson).toLowerCase();
  if (action === "perform") return "";
  const quantity = countWords(tree.tree_count);
  const treeType = asString(tree.tree_type).toLowerCase();
  if (quantity || treeType) {
    const noun = quantity === "one" ? "tree" : "trees";
    return normalizeTreeServiceText(`${action} ${[quantity, treeType, noun].filter(Boolean).join(" ")}`).toLowerCase();
  }
  const jobCandidate = cleanSummaryCandidate(alphaJson.job?.description || "", alphaJson).replace(/[.!?]$/g, "");
  if (!/\b(remove|removal|trim|trimming|cut|drop|take down)\b/i.test(jobCandidate)) return "";
  if (/\b(options? include|haul away|cleanup|stump grinding)\b/i.test(jobCandidate)) return "";
  return normalizeTreeServiceText(jobCandidate).toLowerCase();
}

function optionText(option) {
  return normalizeTreeServiceText(`${option?.title || ""} ${option?.description || ""}`).toLowerCase();
}

function optionAddOns(option) {
  const text = optionText(option);
  const addOns = [];
  if (/\bhaul(?:\s+away|\s+off)?\b.{0,30}\bbrush\b|\bbrush\b.{0,30}\bhaul(?:\s+away|\s+off)?\b/i.test(text)) {
    addOns.push("haul away the brush");
  } else if (/\bhaul(?:\s+away|\s+off)?|haul\s+debris|remove\s+(?:all\s+)?debris|haul\s+everything\b/i.test(text)) {
    addOns.push("haul away");
  }
  if (/\bcleanup|clean\s+up|sweep|rake(?:\s+up)?\b/i.test(text)) addOns.push("cleanup");
  if (/\bstump\s+(?:grind|grinding)|grind\s+(?:stumps?|the\s+stump)\b/i.test(text)) addOns.push("stump grinding");
  return [...new Set(addOns)];
}

function optionNeedsBaseScope(option) {
  const text = optionText(option);
  if (!optionAddOns(option).length) return false;
  return !/\b(?:trees?|oak|pine|maple|elm|ash|cedar|sycamore|hickory|locust|birch|spruce|walnut|cherry|limbs?|branches?)\b/i.test(text);
}

function optionDescriptionWasEditedByTd(option) {
  return Boolean(option?.review_flags?.description_edited_by_td);
}

function optionIsBaseOnly(option) {
  const descriptionText = normalizeTreeServiceText(option?.description || "").toLowerCase();
  const text = descriptionText || optionText(option);
  const compactText = text.replace(/\b(remove|removal|take\s+down|cut\s+down|drop)\s+\1\b/gi, "$1");
  if (optionAddOns({ title: "", description: compactText }).length) return false;
  if (/\bstumps?\b/i.test(compactText)) return false;
  if (/^(?:remove|removal|take\s+down|cut\s+down|drop)$/i.test(compactText)) return true;
  return /\b(?:remove|removal|take\s+down|cut\s+down|drop)\b.{0,50}\bonly\b|\bonly\b.{0,25}\b(?:remove|removal)\b|\bbasic\s+removal\b/i.test(compactText);
}

function combineBaseScopeAndAddOns(baseScope, addOns) {
  const text = `${baseScope} and ${addOns.join(" and ")}`;
  return normalizeTreeServiceText(text)
    .replace(/\band haul(?!\s+(?:away|off))\b/i, "and haul away")
    .toLowerCase();
}

function combineBaseScopeAndOnly(baseScope) {
  return normalizeTreeServiceText(`${baseScope} only`).toLowerCase();
}

function resolvedTreeCountKey(value) {
  const text = asString(value).toLowerCase();
  const match = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+\+?)\s+(?:[a-z]+\s+){0,3}trees?\b/i);
  if (!match) return "";
  return NUMBER_WORDS.get(match[1]) || match[1];
}

function optionTreeCountDisagreesWithBaseScope(option, baseScope) {
  const baseCount = resolvedTreeCountKey(baseScope);
  const optionCount = resolvedTreeCountKey(optionText(option));
  return Boolean(baseCount && optionCount && baseCount !== optionCount && !optionDescriptionWasEditedByTd(option));
}

function optionHasStaleTreeCountWarning(option) {
  return /\bexact tree count needs confirmation\b/i.test(optionText(option));
}

function baseScopeHasResolvedTreeCount(baseScope) {
  return /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+\+?)\s+(?:[a-z]+\s+){0,3}trees?\b/i.test(baseScope) &&
    !hasVagueTreeCountEvidence(baseScope) &&
    !/\bexact tree count needs confirmation\b/i.test(baseScope);
}

function optionScopeIsUnclear(option) {
  return Boolean(option?.scope_unclear || /\bwork\s+scope\s+unclear\b|\bscope\s+unclear\b/i.test(optionText(option)));
}

function optionHasRefreshableInferredBaseScope(option) {
  return Boolean(option?.review_flags?.inferred_base_scope && !optionDescriptionWasEditedByTd(option));
}

function hasEarlierLowerPricedOption(options, index) {
  const amount = optionAmount(options[index]);
  if (!amount) return false;
  return options.slice(0, index).some((option) => {
    const previousAmount = optionAmount(option);
    return previousAmount && previousAmount < amount;
  });
}

function withInferredOptionScope(option, description, flag) {
  return {
    ...option,
    title: description,
    description,
    scope_unclear: false,
    review_flags: {
      ...(option.review_flags || {}),
      scope_unclear: false,
      scope_warning: "",
      ...flag,
    },
  };
}

function applyOptionScopeInference(alphaJson) {
  const options = alphaJson.service_options?.items || [];
  const baseScope = baseJobScopePhrase(alphaJson);
  if (!baseScope || options.length < 2) return;

  alphaJson.service_options.items = options.map((option, index, allOptions) => {
    const addOns = optionAddOns(option);
    const baseOnly = optionIsBaseOnly(option);
    const inferredDescription = addOns.length
      ? combineBaseScopeAndAddOns(baseScope, addOns)
      : baseOnly
        ? combineBaseScopeAndOnly(baseScope)
        : baseScope;
    if (optionHasStaleTreeCountWarning(option) && baseScopeHasResolvedTreeCount(baseScope)) {
      return withInferredOptionScope(option, inferredDescription, {
        inferred_base_scope: true,
        inferred_from_job_scope: baseScope,
        replaced_stale_tree_count_warning: true,
        ...(baseOnly ? { inferred_base_only_scope: true } : {}),
      });
    }
    if (
      (optionHasRefreshableInferredBaseScope(option) || optionTreeCountDisagreesWithBaseScope(option, baseScope)) &&
      (addOns.length || baseOnly) &&
      baseScopeHasResolvedTreeCount(baseScope)
    ) {
      return withInferredOptionScope(option, inferredDescription, {
        inferred_base_scope: true,
        inferred_from_job_scope: baseScope,
        refreshed_from_tree_count_override: true,
        ...(baseOnly ? { inferred_base_only_scope: true } : {}),
      });
    }
    if (baseOnly && baseScopeHasResolvedTreeCount(baseScope) && !optionDescriptionWasEditedByTd(option)) {
      return withInferredOptionScope(option, combineBaseScopeAndOnly(baseScope), {
        inferred_base_scope: true,
        inferred_base_only_scope: true,
        inferred_from_job_scope: baseScope,
      });
    }
    if (!addOns.length || !optionNeedsBaseScope(option) || !hasEarlierLowerPricedOption(allOptions, index)) {
      return option;
    }
    return withInferredOptionScope(option, combineBaseScopeAndAddOns(baseScope, addOns), {
      inferred_base_scope: true,
      inferred_from_job_scope: baseScope,
    });
  });

  alphaJson.service_options.items = alphaJson.service_options.items.map((option, index, allOptions) => {
    if (!optionScopeIsUnclear(option)) return option;
    const amount = optionAmount(option);
    if (!amount) return option;
    const higherOption = allOptions.slice(index + 1).find((candidate) => {
      const candidateAmount = optionAmount(candidate);
      return candidateAmount && candidateAmount > amount && optionText(candidate).includes(baseScope) && optionAddOns(candidate).length > 0;
    });
    if (!higherOption) return option;
    return withInferredOptionScope(option, baseScope, {
      inferred_base_scope: true,
      inferred_from_higher_option: higherOption.label || "",
    });
  });
}

function reconcileParsedFacts(alphaJson, normalization) {
  const summaryEvidence = combinedNormalizationEvidence(normalization, ["work_scope", "tree_count", "service_address", "options", "price"]);

  if (!alphaJson.job?.tree_details?.tree_count && !hasNormalizationUncertainty(normalization, ["tree_count", "tree count", "count"])) {
    const evidenceCount = firstString(
      ...evidenceValues(normalization.field_evidence?.tree_count),
      !hasVagueTreeCountEvidence(summaryEvidence) ? extractTreeCountFromRaw(summaryEvidence) : "",
    );
    const treeCount = normalizeTreeCount(evidenceCount);
    if (treeCount && !hasVagueTreeCountEvidence(evidenceCount)) {
      alphaJson.job.tree_details.tree_count = treeCount;
    }
  }

  if (!alphaJson.job?.tree_details?.tree_type && !hasNormalizationUncertainty(normalization, ["tree_type", "tree type", "species"])) {
    const treeTypeEvidence = combinedNormalizationEvidence(normalization, ["work_scope", "tree_count", "options"]);
    const treeType = firstString(
      extractTreeTypeFromRaw(evidenceValues(normalization.field_evidence?.tree_count).join(" ")),
      extractTreeTypeFromRaw(treeTypeEvidence),
    );
    if (treeType) alphaJson.job.tree_details.tree_type = treeType;
  }

  if (!alphaJson.job?.service_address?.display && !hasNormalizationUncertainty(normalization, ["service_address", "address"])) {
    const address = firstCleanAddress(
      ...evidenceValues(normalization.field_evidence?.service_address),
      extractAddressFromRaw(summaryEvidence),
    );
    if (address) alphaJson.job.service_address.display = address;
  }

  if (jobNeedsDescription(alphaJson) && !hasNormalizationUncertainty(normalization, ["work_scope", "scope"])) {
    const workScopeEvidence = evidenceValues(normalization.field_evidence?.work_scope).find(
      (value) => !isPlaceholderWorkDescription(value),
    );
    const description = cleanCorrectedInterpretation(
      firstString(workScopeEvidence, normalization.corrected_interpretation),
      alphaJson,
    );
    if (description) alphaJson.job.description = description;
  }

  const evidenceOptions = hasNormalizationUncertainty(normalization, ["price", "options"])
    ? []
    : normalizedEvidenceOptions(normalization);
  if (evidenceOptions.length) {
    const existingOptions = alphaJson.service_options?.items || [];
    const reconciled = existingOptions.length
      ? existingOptions.map((option, index) => {
          const evidence = evidenceOptions[index] || {};
          return {
            ...option,
            title: optionNeedsTitle(option) && evidence.description ? evidence.description : option.title,
            description: optionNeedsDescription(option) && evidence.description ? evidence.description : option.description,
            price: optionNeedsPrice(option) && evidence.price?.display ? evidence.price : option.price,
          };
        })
      : evidenceOptions;
    alphaJson.service_options.items = sortAndRelabelOptions(reconciled);
  }

  normalization.field_evidence = {
    ...normalization.field_evidence,
    service_address: alphaJson.job?.service_address?.display || normalization.field_evidence?.service_address || "",
    tree_count: alphaJson.job?.tree_details?.tree_count || normalization.field_evidence?.tree_count || "",
    work_scope: alphaJson.job?.description || normalization.field_evidence?.work_scope || "",
    price: (alphaJson.service_options?.items || []).map((option) => option.price?.display).filter(Boolean),
    options: (alphaJson.service_options?.items || []).map((option) => option.description).filter(Boolean),
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

function extractEmailNameHint(rawInput) {
  const text = asString(rawInput);
  const spacedEmail = text.match(/\b([A-Z0-9._%+-]+(?:\s*\.\s*[A-Z0-9._%+-]+)*)\s*@\s*([A-Z0-9.-]+(?:\s*\.\s*[A-Z0-9.-]+)+)\b/i);
  const email = spacedEmail
    ? `${spacedEmail[1].replace(/\s*\.\s*/g, ".")}@${spacedEmail[2].replace(/\s*\.\s*/g, ".")}`
    : extractEmailFromRaw(text);
  if (!email) return [];

  const localPart = email.split("@")[0].replace(/\d+$/g, "");
  const parts = localPart
    .split(/[._-]+/)
    .map((part) => part.replace(/[^A-Za-z\u00c0-\u024f']/g, ""))
    .filter(Boolean);
  return parts.slice(0, 3).map((part) => titleCaseName(part));
}

function orderNameUsingEmailHint(candidate, emailHint = []) {
  const words = asString(candidate).split(/\s+/).filter(Boolean);
  if (words.length !== 2 || emailHint.length < 2) return candidate;
  const [first, last] = words.map((part) => part.toLowerCase());
  const [hintFirst, hintLast] = emailHint.map((part) => part.toLowerCase());
  if (first === hintLast && last === hintFirst) {
    return `${emailHint[0]} ${emailHint[1]}`;
  }
  return candidate;
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

function normalizeIntakeFields(value) {
  if (!isObject(value)) return {};
  return {
    name: asString(value.name),
    phone: asString(value.phone),
    email: asString(value.email),
    address: asString(value.address || value.service_address || value.serviceAddress),
    treeCountOverride: normalizeTreeCountOverride(value.treeCountOverride || value.tree_count_override || value.treeCount || value.tree_count),
  };
}

function cleanServiceAddressCandidate(value) {
  const text = cleanTypedServiceAddress(value);
  if (!text) return "";
  if (/\bsomewhere\b/i.test(text)) return "";
  if (/\b(?:wants?|needs?|option|opt|quote|estimate)\b/i.test(text)) return "";
  if (/\b(?:each|maybe|around|roughly|probably|dollars?)\b/i.test(text)) return "";
  if (/^\s*[1-5]\s+\b(?:remove|removal|cut|drop|trim|haul|cleanup|clean)\b/i.test(text)) return "";
  if (/\b(?:remove|removal|cut|drop|trim|haul|cleanup|clean)\b/i.test(text)) return "";

  const hasStreetLikeAddress = new RegExp(`\\b\\d+\\s+(?:[A-Za-z0-9.]+\\s+){0,6}${ADDRESS_SUFFIX}\\b`, "i").test(text);
  const hasStrictLocalCityAddress = new RegExp(`^\\s*\\d+\\s+(?:[A-Za-z0-9.]+\\s+){1,4}${LOCAL_CITY_PATTERN}\\b(?:,?\\s*(?:Indiana|IN))?\\s*$`, "i").test(text);
  const hasShortStreetCandidate =
    /^\s*\d+\s+(?:(?:N|S|E|W|North|South|East|West)\s+)?[A-Za-z0-9.]+(?:\s+[A-Za-z0-9.]+){0,2}\s*$/i.test(text) &&
    !/\b(?:tree|trees|limb|limbs|branch|branches|brush|stump)\b/i.test(text);
  if (!hasStreetLikeAddress && !hasStrictLocalCityAddress && !hasShortStreetCandidate) return "";

  const looksLikeJobText =
    text.split(/\s+/).length > 10 &&
    /\b(?:remove|removal|take\s+down|cut\s+down|trim|tree|trees|stump|haul|cleanup|brush|limb)\b/i.test(text);
  if (looksLikeJobText) return "";

  return hasExplicitState(text) ? text.replace(/\s+,/g, ",") : appendIndianaForLocalTown(text.replace(/\s+,/g, ","));
}

function hasExplicitState(value) {
  return new RegExp(`\\b${US_STATE_PATTERN}\\b(?:\\s+\\d{5}(?:-\\d{4})?)?`, "i").test(asString(value));
}

function genericCityStateAfterStreet(text) {
  const match = asString(text).match(new RegExp(`^\\s+${GENERIC_CITY_STATE_PATTERN}\\b`, "i"));
  if (!match) return null;
  const city = match[1].replace(/\s+/g, " ").trim();
  if (!city || ADDRESS_STOP_WORD_PATTERN.test(city)) return null;
  return {
    city,
    state: match[2].trim(),
    zip: match[3]?.trim() || "",
  };
}

function extractExplicitCityStateAddress(rawInput) {
  const text = cleanTypedServiceAddress(normalizeTreeServiceText(stripEmails(stripPhones(rawInput))).replace(/\s+/g, " "));
  const pattern = new RegExp(
    `\\b(\\d+\\s+(?:[A-Za-z0-9.]+\\s+){0,5}${ADDRESS_SUFFIX}\\b(?:\\s+\\d+(?:\\s*[NSEW]\\b)?)?)\\s*,?\\s+${GENERIC_CITY_STATE_PATTERN}\\b`,
    "gi",
  );
  const matches = Array.from(text.matchAll(pattern)).filter(
    (match) => !/\b(limb|limbs|branch|branches|brush|stump|haul|cleanup|remove|trim|cut|drop)\b/i.test(match[1]),
  );
  const match = matches.at(-1);
  if (!match) return "";
  const city = match[2].replace(/\s+/g, " ").trim();
  if (!city || ADDRESS_STOP_WORD_PATTERN.test(city)) return "";
  return `${match[1].trim()}, ${city}, ${match[3].trim()}${match[4] ? ` ${match[4].trim()}` : ""}`.replace(/\s+,/g, ",");
}

function cleanTypedServiceAddress(value) {
  return normalizeTreeServiceText(stripPhones(stripEmails(value)))
    .replace(/\b(\d{2,5})(\d(?:st|nd|rd|th)\b)/gi, "$1 $2")
    .replace(/\b(\d+)([NSEWnsew])(?=(?!d\b)[0-9A-Z])/g, (_, number, direction) => `${number} ${direction.toUpperCase()} `)
    .replace(/\b(\d+)([NSEW])\b/gi, (_, number, direction) => `${number} ${direction.toUpperCase()}`)
    .replace(/\b(\d+)(?!(?:st|nd|rd|th)\b)([A-Za-z])/gi, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanShortLocalServiceAddress(value) {
  const text = cleanTypedServiceAddress(value);
  if (!text) return "";
  const hasShortStreetAddress =
    /^\d+\s+(?:(?:N|S|E|W|North|South|East|West)\s+)?[A-Za-z0-9.]+(?:\s+[A-Za-z0-9.]+){0,3}$/i.test(text);
  const looksLikeJobText =
    /\b(?:remove|removal|take\s+down|cut\s+down|trim|tree|trees|oak|pine|maple|elm|ash|cedar|cedars|sycamore|hickory|locust|birch|spruce|walnut|cherry|stump|haul|cleanup|brush|limb|option|opt|quote|estimate|behind|over|beside|near|by|backyard|yard|barn|shed|garage|fence)\b/i.test(
      text,
    );
  return hasShortStreetAddress && !looksLikeJobText ? text.replace(/\s+,/g, ",") : "";
}

function extractCueShortServiceAddress(rawInput) {
  const text = cleanTypedServiceAddress(normalizeTreeServiceText(stripEmails(stripPhones(rawInput))).replace(/\s+/g, " "));
  const cueMatch = text.match(/\b(?:job at|service at|service address|address|at)\s+(.{1,80})/i);
  if (!cueMatch) return "";

  const tokens = cueMatch[1]
    .replace(/[,:;.].*$/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (!/^\d+[A-Za-z]?$/.test(tokens[0] || "")) return "";

  const addressTokens = [tokens[0]];
  const next = tokens[1] || "";
  const nextLower = next.toLowerCase().replace(/\.$/, "");
  if (["n", "s", "e", "w", "north", "south", "east", "west"].includes(nextLower)) {
    addressTokens.push(next.toUpperCase());
    if (tokens[2]) addressTokens.push(tokens[2]);
  } else if (next) {
    addressTokens.push(next);
  }

  const candidate = cleanTypedServiceAddress(addressTokens.join(" "));
  if (!/^\d+\s+(?:[NSEW]\s+)?[A-Za-z0-9.]+(?:\s+[A-Za-z0-9.]+){0,2}$/i.test(candidate)) return "";
  if (/\b(?:tree|trees|limb|limbs|branch|branches|brush|stump|haul|cleanup|clean|remove|removal|trim|cut|drop|option|opt)\b/i.test(candidate)) return "";
  return candidate.replace(/\s+,/g, ",");
}

export function normalizeServiceAddress(value) {
  return cleanServiceAddressCandidate(value) || cleanShortLocalServiceAddress(value) || cleanTypedServiceAddress(value);
}

const STATE_ABBREVIATIONS = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);

function titleCaseAddressDisplay(value) {
  return asString(value).replace(/\b[A-Za-z][A-Za-z.'-]*\b/g, (word) => {
    const lower = word.toLowerCase();
    const upper = word.toUpperCase();
    if (STATE_ABBREVIATIONS.has(upper)) return upper;
    if (["n", "s", "e", "w", "ne", "nw", "se", "sw"].includes(lower)) return upper;
    return lower
      .split("-")
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
      .join("-");
  });
}

export function normalizeEditedServiceAddress(value) {
  return titleCaseAddressDisplay(normalizeServiceAddress(value));
}

function firstCleanAddress(...values) {
  for (const value of values) {
    const address = cleanServiceAddressCandidate(value) || cleanShortLocalServiceAddress(value);
    if (address) return address;
  }
  return "";
}

function extractAddressFromRaw(rawInput) {
  const text = cleanTypedServiceAddress(
    normalizeTreeServiceText(stripEmails(stripPhones(rawInput)))
    .replace(/^.*?\b(?:job at|service at|service address|address|customer says property is|property is|lives(?:\s+at)?)\s+/i, "")
    .replace(/\s+/g, " "),
  );
  const suffixPattern = new RegExp(`\\b\\d+\\s+(?:[A-Za-z0-9.]+\\s+){0,5}${ADDRESS_SUFFIX}\\b(?:\\s+\\d+(?:\\s*[NSEW]\\b)?)?`, "gi");
  const suffixMatches = Array.from(text.matchAll(suffixPattern))
    .filter((match) => !/\b(tree|trees|limb|limbs|branch|branches|brush|stump|haul|cleanup|remove|trim|cut|drop)\b/i.test(match[0]));
  const suffixMatch = suffixMatches.at(-1);
  if (suffixMatch) {
    let address = suffixMatch[0].trim().replace(/^(?:job at|service at|property is)\s+/i, "");
    const after = text.slice(suffixMatch.index + suffixMatch[0].length);
    const near = after.match(new RegExp(`^\\s+near\\s+(${LOCAL_CITY_PATTERN})\\b(?:,?\\s+(Indiana|IN))?`, "i"));
    if (near) {
      address += ` near ${near[1]}${near[2] ? `, ${near[2]}` : ""}`;
      return hasExplicitState(address) ? address.trim().replace(/\s+,/g, ",") : appendIndianaForLocalTown(address.trim().replace(/\s+,/g, ","));
    }
    const city = after.match(new RegExp(`(?:,|\\s+in|\\s+-)?\\s+(${LOCAL_CITY_PATTERN})\\b(?:,?\\s+(Indiana|IN))?`, "i"));
    if (city) address += `, ${city[1]}${city[2] ? `, ${city[2]}` : ""}`;
    const genericCity = !city ? genericCityStateAfterStreet(after) : null;
    if (genericCity) address += `, ${genericCity.city}, ${genericCity.state}${genericCity.zip ? ` ${genericCity.zip}` : ""}`;
    return hasExplicitState(address) ? address.trim().replace(/\s+,/g, ",") : appendIndianaForLocalTown(address.trim().replace(/\s+,/g, ","));
  }

  const mainMatch = text.match(new RegExp(`\\b\\d+\\s+(?:West\\s+)?Main\\s+${LOCAL_CITY_PATTERN}\\s+(?:Indiana|IN)\\b`, "i"));
  if (mainMatch) return mainMatch[0].replace(/\s+(Madison|Hanover)\s+/i, ", $1, ");

  const localNoSuffixMatch = text.match(new RegExp(`\\b\\d+\\s+(?:[A-Za-z0-9.]+\\s+){1,4}${LOCAL_CITY_PATTERN}\\b(?:,?\\s+(?:Indiana|IN))?`, "i"));
  if (localNoSuffixMatch && !/\b(tree|trees|limb|limbs|branch|branches|brush|stump|haul|cleanup|clean|remove|removal|trim|cut|drop|option|opt)\b/i.test(localNoSuffixMatch[0])) {
    return appendIndianaForLocalTown(localNoSuffixMatch[0].trim().replace(/\s+,/g, ","));
  }

  const lotAddressMatch = text.match(
    new RegExp(`\\b(?:near|at|by|beside|behind)\\s+(\\d{2,5}\\s+(?:${TREE_SPECIES_MATCH_PATTERN})\\s+lot)\\b`, "i"),
  );
  if (lotAddressMatch) return titleCaseAddressDisplay(lotAddressMatch[1]);

  const cueShortAddress = extractCueShortServiceAddress(rawInput);
  if (cueShortAddress) return cueShortAddress;

  const typedText = cleanTypedServiceAddress(text);
  const shortLabeledAddress = typedText.match(
    /^\s*(\d+\s+(?:(?:N|S|E|W|North|South|East|West)\s+)?[A-Za-z0-9.]+(?:\s+[A-Za-z0-9.]+){0,3})(?:[.,]|$)/i,
  );
  if (shortLabeledAddress) {
    const address = cleanShortLocalServiceAddress(shortLabeledAddress[1]);
    if (address) return address;
  }

  return "";
}

function countTokenToNumber(value) {
  const token = asString(value).toLowerCase();
  if (/^\d+$/.test(token)) return Number(token);
  const mapped = NUMBER_WORDS.get(token);
  return mapped ? Number(mapped) : 0;
}

function treeCountRangeStatus(count, { allowReviewRange = false } = {}) {
  if (!Number.isFinite(count) || count <= 0) return "invalid";
  if (count <= AUTO_TREE_COUNT_MAX) return "accepted";
  if (count <= REVIEW_TREE_COUNT_MAX) return allowReviewRange ? "accepted" : "review";
  return "rejected";
}

function countTokenTreeCountStatus(value, options = {}) {
  return treeCountRangeStatus(countTokenToNumber(value), options);
}

function speciesTextPattern(species) {
  const escaped = escapeRegExp(species).replace(/\s+/g, "\\s+");
  if (/y$/i.test(species)) return `${escaped.slice(0, -1)}(?:y|ies)`;
  if (/(?:s|sh|ch|x|z)$/i.test(species)) return `${escaped}(?:es)?`;
  return `${escaped}s?`;
}

const TREE_SPECIES_MATCH_PATTERN = TREE_SPECIES
  .slice()
  .sort((a, b) => b.length - a.length)
  .map(speciesTextPattern)
  .join("|");

function speciesFromText(value) {
  const text = asString(value);
  return TREE_SPECIES
    .slice()
    .sort((a, b) => b.length - a.length)
    .find((species) => new RegExp(`\\b${speciesTextPattern(species)}\\b`, "i").test(text)) || "";
}

function speciesListDisplay(speciesList) {
  const unique = [...new Set(speciesList.filter(Boolean))];
  if (unique.length <= 1) return unique[0] || "";
  if (unique.length === 2) return unique.join(" and ");
  return `${unique.slice(0, -1).join(", ")}, and ${unique.at(-1)}`;
}

function keepTreeCountPhraseDuringAddressCleanup(match) {
  const leadingNumber = Number(asString(match).match(/\b\d+\b/)?.[0] || "0");
  return leadingNumber > 0 && leadingNumber <= AUTO_TREE_COUNT_MAX && /\b(?:tree|trees|removal|remove|take\s+down|cut\s+down|trim|drop|cheap|cleanup|options?)\b/i.test(match);
}

function stripTreeCountNonJobNumbers(value) {
  return asString(value)
    .replace(/\b\d+\s+(?:Highway|Hwy|Route|State\s+Road|State\s+Route|County\s+Road|CR)\s+\d+(?:\s+[NSEW])?\b/gi, " ")
    .replace(/\b(?:Highway|Hwy|Route|State\s+Road|State\s+Route|County\s+Road|CR)\s+\d+(?:\s+[NSEW])?\b/gi, " ")
    .replace(new RegExp(`\\b\\d+\\s+(?:[A-Za-z0-9.]+\\s+){0,5}${ADDRESS_SUFFIX}\\b(?:\\s+${LOCAL_CITY_PATTERN})?(?:,?\\s+(?:Indiana|IN))?`, "gi"), (match) =>
      keepTreeCountPhraseDuringAddressCleanup(match) ? match : " ",
    )
    .replace(new RegExp(`\\b\\d+\\s+(?:[A-Za-z0-9.]+\\s+){1,4}${LOCAL_CITY_PATTERN}\\b(?:,?\\s+(?:Indiana|IN))?`, "gi"), (match) =>
      keepTreeCountPhraseDuringAddressCleanup(match) ? match : " ",
    );
}

function stripStreetNameSpeciesEvidence(value) {
  const streetNameSpeciesPattern = new RegExp(`\\b(?:${TREE_SPECIES_MATCH_PATTERN})\\s+${ADDRESS_SUFFIX}\\b`, "gi");
  return asString(value).replace(streetNameSpeciesPattern, " ");
}

function treeTextForCount(rawInput) {
  return normalizeTreeServiceText(stripPriceLikeNumbersForTreeCounts(stripPhoneLikeNumbersForTreeCounts(rawInput)))
    .replace(/\b\d+\s+tree\s+job\b/gi, " tree job")
    .replace(/\s+/g, " ")
    .trim();
}

function treeTextBeforeOptions(rawInput) {
  const shortServiceAddress = extractCueShortServiceAddress(rawInput);
  let text = stripStreetNameSpeciesEvidence(stripTreeCountNonJobNumbers(treeTextForCount(rawInput))).split(/\b(?:Option|Opt)\b/i)[0];
  if (shortServiceAddress) {
    text = text.replace(new RegExp(`\\b${escapeRegExp(shortServiceAddress)}\\b`, "i"), " ");
  }
  return text;
}

function extractCountedSpeciesDetails(rawInput) {
  const text = treeTextBeforeOptions(rawInput);
  if (!text || hasVagueTreeCountEvidence(text)) return null;

  const countToken = "(one|two|three|four|five|six|seven|eight|nine|ten|\\d+)";
  const descriptor = "(?:(?:dead|large|big|small|leaning|fallen|storm\\s+damaged)\\s+){0,3}";
  const regex = new RegExp(`\\b${countToken}\\s+(${descriptor}(?:${TREE_SPECIES_MATCH_PATTERN})(?:\\s+trees?)?)\\b`, "gi");
  const matches = [];
  let match;

  while ((match = regex.exec(text))) {
    const count = countTokenToNumber(match[1]);
    const species = speciesFromText(match[2]);
    if (countTokenTreeCountStatus(match[1]) !== "accepted" || !species) continue;
    matches.push({
      count,
      species,
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  if (!matches.length) return null;
  const total = matches.reduce((sum, item) => sum + item.count, 0);
  if (treeCountRangeStatus(total) !== "accepted") return null;
  const phrase = text
    .slice(matches[0].start, matches.at(-1).end)
    .replace(/\s+/g, " ")
    .trim();

  return {
    count: total,
    tree_count: `${total} ${total === 1 ? "tree" : "trees"}`,
    tree_type: speciesListDisplay(matches.map((item) => item.species)),
    phrase,
  };
}

function extractSpeciesPairDetails(rawInput) {
  const text = treeTextBeforeOptions(rawInput);
  if (!text || hasVagueTreeCountEvidence(text)) return null;

  const regex = new RegExp(`\\b(${TREE_SPECIES_MATCH_PATTERN})\\s+(and|or)\\s+(${TREE_SPECIES_MATCH_PATTERN})\\b`, "i");
  const match = text.match(regex);
  if (!match) return null;

  const firstSpecies = speciesFromText(match[1]);
  const secondSpecies = speciesFromText(match[3]);
  if (!firstSpecies || !secondSpecies || firstSpecies === secondSpecies) return null;

  const isAnd = match[2].toLowerCase() === "and";
  return {
    count: isAnd ? 2 : 1,
    tree_count: isAnd ? "2 trees" : "1 tree",
    tree_type: isAnd ? speciesListDisplay([firstSpecies, secondSpecies]) : `${firstSpecies} or ${secondSpecies}`,
    phrase: match[0],
  };
}

function explicitTreeCountNumberFromText(value) {
  const text = treeTextBeforeOptions(value);
  const numberPattern = "\\d+|one|two|three|four|five|six|seven|eight|nine|ten";
  const treeMatch = text.match(new RegExp(`\\b(${numberPattern})\\s+(?:[a-z]+\\s+){0,4}trees?\\b`, "i"));
  const speciesMatch = text.match(
    new RegExp(`\\b(${numberPattern})\\s+(?:dead\\s+|large\\s+|big\\s+|small\\s+|leaning\\s+|fallen\\s+)?(?:${TREE_SPECIES_MATCH_PATTERN})s?\\b`, "i"),
  );
  const typoOneTreeMatch = text.match(/\bon\s+tree\b/i);
  const token = treeMatch?.[1] || speciesMatch?.[1] || (typoOneTreeMatch ? "one" : "");
  if (!token) return null;
  const numeric = /^\d+$/.test(token) ? Number(token) : Number(NUMBER_WORDS.get(token.toLowerCase()));
  return treeCountRangeStatus(numeric) === "accepted" ? numeric : null;
}

function treeCountCandidateNeedsReview(value) {
  const text = asString(value);
  if (/\b\d+\b.{0,20}\btree\s+job\b/i.test(text)) return false;
  const numeric = text.match(/\b\d+\b/);
  return Boolean(numeric && treeCountRangeStatus(Number(numeric[0])) === "review");
}

function stripRouteNumbersAboveTreeAutoMax(value) {
  return asString(value).replace(
    /\b(?:State\s+Road|State\s+Route|County\s+Road|Highway|Hwy|Route|Road|Rd|CR)\s+(\d+)\b/gi,
    (match, number) => Number(number) > AUTO_TREE_COUNT_MAX ? " " : match,
  );
}

function treeCountReviewEvidenceFromText(value) {
  const text = stripRouteNumbersAboveTreeAutoMax(treeTextBeforeOptions(value))
    .replace(/\b\d+\s+tree\s+job\b/gi, " tree job");
  if (!text) return "";

  const numberPattern = "\\d+";
  const countedTreeMatch = text.match(new RegExp(`\\b(${numberPattern})\\s+(?:[a-z]+\\s+){0,4}trees?\\b`, "i"));
  if (countedTreeMatch && countTokenTreeCountStatus(countedTreeMatch[1]) === "review") return countedTreeMatch[0];

  const countedSpeciesMatch = text.match(
    new RegExp(`\\b(${numberPattern})\\s+(?:dead\\s+|large\\s+|big\\s+|small\\s+|leaning\\s+|fallen\\s+)?(?:${TREE_SPECIES_MATCH_PATTERN})s?\\b`, "i"),
  );
  if (countedSpeciesMatch && countTokenTreeCountStatus(countedSpeciesMatch[1]) === "review") {
    return countedSpeciesMatch[0];
  }

  const countedSpeciesRegex = new RegExp(
    `\\b(${numberPattern})\\s+((?:(?:dead|large|big|small|leaning|fallen|storm\\s+damaged)\\s+){0,3}(?:${TREE_SPECIES_MATCH_PATTERN})(?:\\s+trees?)?)\\b`,
    "gi",
  );
  const matches = [];
  let match;
  while ((match = countedSpeciesRegex.exec(text))) {
    const count = countTokenToNumber(match[1]);
    if (treeCountRangeStatus(count) !== "accepted") continue;
    matches.push({ count, start: match.index, end: match.index + match[0].length });
  }
  const total = matches.reduce((sum, item) => sum + item.count, 0);
  if (matches.length > 1 && treeCountRangeStatus(total) === "review") {
    return text.slice(matches[0].start, matches.at(-1).end).replace(/\s+/g, " ").trim();
  }

  return "";
}

function treeCountRejectedEvidenceFromText(value) {
  const text = stripRouteNumbersAboveTreeAutoMax(treeTextBeforeOptions(value));
  if (!text) return "";

  const countedTreeMatch = text.match(/\b(\d+)\s+(?:[a-z]+\s+){0,4}trees?\b/i);
  if (countedTreeMatch && countTokenTreeCountStatus(countedTreeMatch[1]) === "rejected") return countedTreeMatch[0];

  const countedSpeciesMatch = text.match(
    new RegExp(`\\b(\\d+)\\s+(?:dead\\s+|large\\s+|big\\s+|small\\s+|leaning\\s+|fallen\\s+)?(?:${TREE_SPECIES_MATCH_PATTERN})s?\\b`, "i"),
  );
  return countedSpeciesMatch && countTokenTreeCountStatus(countedSpeciesMatch[1]) === "rejected"
    ? countedSpeciesMatch[0]
    : "";
}

function hasConflictingExplicitCountAndSpeciesPair(rawInput) {
  const explicitCount = explicitTreeCountNumberFromText(rawInput);
  const speciesPair = extractSpeciesPairDetails(rawInput);
  return Boolean(explicitCount && speciesPair && explicitCount !== speciesPair.count);
}

function normalizeTreeCount(value, options = {}) {
  const text = asString(value);
  if (!text) return "";
  if (/^\s*5\+/.test(text)) return "5+ trees";
  const numeric = text.match(/\b\d+\b/);
  if (numeric) {
    const count = Number(numeric[0]);
    return treeCountRangeStatus(count, options) === "accepted"
      ? `${numeric[0]} ${count === 1 ? "tree" : "trees"}`
      : "";
  }
  const word = text.toLowerCase().match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/);
  if (word) {
    const count = NUMBER_WORDS.get(word[1]);
    return `${count} ${count === "1" ? "tree" : "trees"}`;
  }
  return text;
}

function normalizeTreeCountOverride(value) {
  const text = asString(value);
  if (!text || /^auto$/i.test(text)) return "";
  if (/^unknown$/i.test(text)) return "Unknown";
  if (/still\s+unclear.*ok.*proceed/i.test(text)) return "Still unclear but OK to proceed";
  if (/^3\s*\+/i.test(text)) return "3+ trees";
  return normalizeTreeCount(text, { allowReviewRange: true });
}

function isTreeCountUnclearOkOverride(value) {
  return /^Still unclear but OK to proceed$/i.test(asString(value));
}

function hasMultipleTreeSpecies(text) {
  const normalizedText = asString(text).toLowerCase();
  const found = TREE_SPECIES.filter((species) => new RegExp(`\\b${escapeRegExp(species)}s?\\b`, "i").test(normalizedText));
  return found.length > 1;
}

function hasExplicitPluralTreeLanguage(text) {
  return /\btrees\b|\btree\s+stuff\b/i.test(text || "");
}

function inferSingularIncidentTree(text) {
  if (!text || hasVagueTreeCountEvidence(text) || hasExplicitPluralTreeLanguage(text) || hasMultipleTreeSpecies(text)) return "";
  const singularIncident =
    /\b(?:fallen|leaning|dead|storm[-\s]+damaged)\s+tree\s+(?:on|onto|over|against|across|touching|at|by|near|beside|behind)\b/i.test(text) ||
    /\btree\s+on\s+(?:house|roof|garage|shed|fence|neighbor\s+fence|service\s+drop|power\s+line)\b/i.test(text) ||
    /\bleaning\s+tree\s+touching\s+(?:service\s+drop|power\s+line|wire)\b/i.test(text);
  return singularIncident ? "1 tree" : "";
}

function extractTreeCountFromRaw(rawInput) {
  const normalizedRaw = stripStreetNameSpeciesEvidence(stripTreeCountNonJobNumbers(treeTextForCount(rawInput)));
  const text = normalizedRaw.split(/\b(?:Option|Opt)\b/i)[0];
  const countedSpecies = extractCountedSpeciesDetails(rawInput);
  if (countedSpecies) return countedSpecies.tree_count;
  if (treeCountReviewEvidenceFromText(rawInput) || treeCountRejectedEvidenceFromText(rawInput)) return "";
  if (hasConflictingExplicitCountAndSpeciesPair(rawInput)) return "";
  const speciesPair = extractSpeciesPairDetails(rawInput);
  if (speciesPair) return speciesPair.tree_count;
  const treeQualifiers = [
    "dead",
    "large",
    "small",
    "leaning",
    "fallen",
    "storm\\s+damaged",
    ...TREE_SPECIES.map(escapeRegExp),
  ].join("|");
  const towTreeTypo = new RegExp(`\\btow\\s+(?:(?:${treeQualifiers})\\s+){0,4}trees?\\b`, "i");
  if (towTreeTypo.test(text)) return "2 trees";
  if (hasVagueTreeCountEvidence(normalizedRaw)) return "";

  const word = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:[a-z]+\s+){0,4}trees?\b/i);
  if (word) {
    const count = NUMBER_WORDS.get(word[1].toLowerCase());
    return `${count} ${count === "1" ? "tree" : "trees"}`;
  }
  const speciesPlural = text.match(
    new RegExp(`\\b(one|two|three|four|five|six|seven|eight|nine|ten)\\s+(?:dead\\s+|large\\s+|big\\s+|small\\s+|leaning\\s+|fallen\\s+)?(?:${TREE_SPECIES.map(escapeRegExp).join("|")})s\\b`, "i"),
  );
  if (speciesPlural) {
    const count = NUMBER_WORDS.get(speciesPlural[1].toLowerCase());
    return `${count} ${count === "1" ? "tree" : "trees"}`;
  }
  const numeric = text.match(/\b(\d+)\s+(?:[a-z]+\s+){0,4}trees?\b/i);
  if (numeric) return `${numeric[1]} ${Number(numeric[1]) === 1 ? "tree" : "trees"}`;
  const singularIncidentTree = inferSingularIncidentTree(text);
  if (singularIncidentTree) return singularIncidentTree;
  const singleTreeWork = text.match(
    /\b(?:remove|removed|removal\s+of|take\s+down|cut\s+down|trim|drop|cut)\s+(?:one|a|an)?\s*(?:dead\s+|large\s+|big\s+|small\s+|leaning\s+|fallen\s+)?(?:pine|oak|maple|elm|ash|cedar|sycamore|hickory|locust|birch|spruce|walnut|cherry|tree)\b/i,
  );
  if (singleTreeWork) return "1 tree";
  const singularSpeciesTree = new RegExp(`\\b(?:${TREE_SPECIES_MATCH_PATTERN})\\s+tree\\b`, "i").test(normalizedRaw);
  const singularNamedTree = /\b(?!service\b)[a-z][a-z-]{2,}\s+tree\b/i.test(normalizedRaw);
  const singularLocatedTree = normalizedRaw.match(/\b(?:dead\s+|large\s+|big\s+|small\s+|leaning\s+|fallen\s+)?tree\s+(?:[a-z]+\s+){0,4}(?:by|near|beside|behind|over|at)\b/i);
  const hasVagueCount = /\b(?:several|multiple|some|a\s+few|few)\s+(?:[a-z]+\s+){0,4}trees?\b|\bone\s+tree\s+or\s+(?:several|more|multiple)\b|\btree\s+or\s+maybe\s+more\b/i.test(normalizedRaw);
  if ((singularSpeciesTree || singularNamedTree || singularLocatedTree) && !hasVagueCount && /\b(?:remove|removed|removal|take\s+down|cut\s+down|trim|drop|cut)\b/i.test(normalizedRaw)) return "1 tree";
  return "";
}

function extractTreeTypeFromRaw(rawInput) {
  const text = treeTextBeforeOptions(rawInput);
  const countedSpecies = extractCountedSpeciesDetails(text);
  if (countedSpecies?.tree_type) return countedSpecies.tree_type;
  const speciesPair = extractSpeciesPairDetails(text);
  if (speciesPair?.tree_type) return speciesPair.tree_type;
  for (const species of TREE_SPECIES) {
    const escaped = escapeRegExp(species);
    const speciesNearTree = new RegExp(`\\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\\d+)?\\s*(?:dead|large|small|leaning|storm\\s+damaged|fallen)?\\s*${escaped}s?\\s+trees?\\b`, "i");
    const speciesAfterWork = new RegExp(`\\b(?:remove|removal|take\\s+down|cut\\s+down|drop|trim|cut)\\b.{0,40}\\b${escaped}s?\\b`, "i");
    const speciesBeforeWork = new RegExp(`\\b(?:(?:dead|large|small|leaning|storm\\s+damaged|fallen)\\s+){0,3}${escaped}s?\\b\\s*,?\\s*\\b(?:remove|removal|take\\s+down|cut\\s+down|drop|trim|cut)\\b.{0,40}\\btrees?\\b`, "i");
    const speciesBeforeCount = new RegExp(`\\b(?:(?:dead|large|small|leaning|storm\\s+damaged|fallen)\\s+){0,3}${escaped}s?\\b.{0,60}\\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\\d+)\\s+trees?\\b.{0,30}\\b(?:remove|removal|take\\s+down|cut\\s+down|drop|trim|cut)\\b`, "i");
    if (speciesNearTree.test(text) || speciesAfterWork.test(text) || speciesBeforeWork.test(text) || speciesBeforeCount.test(text)) return species;
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
  const rawTitle = firstString(option.title, option.name, option.label, `Service Option ${String.fromCharCode(65 + index)}`);
  const amount = parseAmount(option.price?.amount ?? option.amount ?? option.price);
  const cleanedDescription = cleanOptionDisplayPhrase(firstString(option.description, option.scope, option.work, rawTitle), amount);
  const descriptionMissingAfterCleanup = Boolean(amount && !cleanedDescription);
  const description = cleanedDescription || (amount ? "work scope unclear" : "");
  const title = cleanOptionDisplayPhrase(rawTitle, amount) || description || `Service Option ${String.fromCharCode(65 + index)}`;
  const softLabeledNumeric = isSoftLabeledNumericOption(option);
  const priceIsUnclear = !softLabeledNumeric && Boolean(option.price_unclear || option.price_is_unclear || option.is_unclear || option.price?.is_unclear);
  const finalAmount = priceIsUnclear ? null : amount;
  return {
    label: `Option ${String.fromCharCode(65 + index)}`,
    raw_label: firstString(option.raw_label, option.label),
    sort_order: index + 1,
    title: title.replace(/^Option\s+[A-D]\s*[:.-]?\s*/i, "").trim() || `Service Option ${String.fromCharCode(65 + index)}`,
    description,
    price: {
      price_type: finalAmount ? "fixed" : "unknown",
      currency: "USD",
      amount: finalAmount,
      min_amount: null,
      max_amount: null,
      display: finalAmount ? money(finalAmount) : "",
      is_range: false,
      is_unclear: priceIsUnclear || !amount,
      status: softLabeledNumeric ? "explicit_numeric_with_soft_language" : firstString(option.price_status, option.price?.status),
      review_warning: Boolean(softLabeledNumeric),
    },
    ...(option.review_flags ? { review_flags: { ...option.review_flags } } : {}),
    preserve_order: Boolean(option.preserve_order),
    scope_unclear: Boolean(option.scope_unclear || descriptionMissingAfterCleanup),
    price_review_warning: Boolean(softLabeledNumeric || option.price_review_warning || option.price?.review_warning),
  };
}

function optionCandidateAmount(option) {
  return parseAmount(option?.price?.amount ?? option?.amount ?? option?.price?.display ?? option?.price?.min_amount ?? option?.price);
}

function modelOptionIsPlaceholder(option) {
  const amount = optionCandidateAmount(option);
  const text = cleanOptionDisplayPhrase(firstString(option?.description, option?.scope, option?.work, option?.title, option?.name, option?.label), amount).trim();
  return !text || /^Service Option [A-E]$/i.test(text) || /^Option [A-E]$/i.test(text);
}

function optionAmounts(options) {
  return options
    .map(optionCandidateAmount)
    .filter((amount) => Number.isFinite(amount) && amount > 0);
}

function shouldUseFallbackOptionsForPlaceholderLeak(modelOptions, fallbackOptions) {
  if (fallbackOptions.length < 2 || modelOptions.length <= fallbackOptions.length) return false;
  if (!modelOptions.some(modelOptionIsPlaceholder)) return false;

  const modelAmounts = optionAmounts(modelOptions);
  const fallbackAmounts = optionAmounts(fallbackOptions);
  if (fallbackAmounts.length < 2) return false;
  return fallbackAmounts.every((amount) => modelAmounts.includes(amount));
}

function isSoftLabeledNumericOption(option) {
  const token = rawOptionLabelToken(option);
  const amount = parseAmount(option?.price?.amount ?? option?.amount ?? option?.price);
  const status = firstString(option?.price_status, option?.price?.status);
  return Boolean(token && amount && status === "explicit_numeric_with_soft_language");
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
  let text = stripInternalOperationalNotes(asString(value))
    .replace(/\bcustomer\s+wants?\s+text\s+no\s+call\b[^.!?;]*(?:[.!?;]|$)?/gi, " ")
    .replace(/\b(?:and\s+)?(?:also|then\s+add(?:\s+to\s+that)?|add(?:\s+to\s+that)?|plus|in\s+addition(?:\s+to\s+that)?)\b/i, "")
    .replace(/^\s*(?:and|then|with)\s+/i, "")
    .replace(/^\s*(?:price|quote|quoted)\s+/i, "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
    .replace(/(?:\+?1[-./\s]?)?\(?\d{3}\)?[-./\s]?\d{3}[-./\s]?\d{4}/g, "")
    .replace(/\${2,}/g, "$")
    .replace(/\$/g, "")
    .replace(/\b(?:lives?|address|service address|job at|service at)\b\s*$/i, "")
    .replace(/\b(?:for|at|price|cost|would be|is)\s*$/i, "")
    .replace(/[,:;.\s-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const workStart = text.search(/\b(remove|removal|take\s+down|trim|cut|drop|haul|cleanup|clean|grind|stump|limb|brush|debris|stack|leave|wood)\b/i);
  if (workStart > 0) text = text.slice(workStart).trim();
  text = text.replace(/\bit\b/i, "tree");
  return normalizeTreeServiceText(text)
    .replace(/\bremove\s+only\b/i, "remove only")
    .replace(/\bremove\s+haul\b/i, "remove and haul")
    .replace(/\bremove\s+haul\s+away\b/i, "remove and haul away")
    .replace(/\bremove\s+haul\s+away\s+and\s+cleanup\b/i, "remove, haul away, and cleanup")
    .trim();
}

function cleanOptionDisplayPhrase(value, amount = null) {
  let text = cleanOptionPhrase(value);
  if (!text || /^Service Option [A-E]$/i.test(text)) return text;

  text = text
    .replace(/^\s*(?:option|opt)\s*(?:[A-E]|[1-5])\b\s*(?:is\s+|[:.)-])?\s*/i, "")
    .trim();

  const amountPatterns = [];
  if (Number.isFinite(amount) && amount > 0) {
    amountPatterns.push(amount.toLocaleString("en-US"), String(amount));
  }
  for (const patternValue of [...new Set(amountPatterns)]) {
    text = text.replace(new RegExp(`\\b${escapeRegExp(patternValue)}\\b`, "g"), " ");
  }

  text = text
    .replace(/\b[0-9]{1,3},[0-9]{3}\b/g, " ")
    .replace(/\b[0-9]{3,}\b/g, " ")
    .replace(/\b(?:for|at|price|cost|would be|is)\s*$/i, "")
    .replace(/[,:;.\s-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return normalizeTreeServiceText(text);
}

function isAddOnPhrase(value) {
  const text = asString(value);
  return TREE_SERVICE_PATTERNS.addOnService.test(text) &&
    !TREE_SERVICE_PATTERNS.baseService.test(text) &&
    !TREE_SERVICE_PATTERNS.pruning.test(text);
}

function stripNonPriceNumberPhrases(value) {
  return asString(value)
    .replace(/\bgate\s+code\s+\d+\b/gi, " ")
    .replace(/\b\d+\s+(?:Highway|Hwy|Route|State\s+Road|State\s+Route|County\s+Road|CR)\s+\d+(?:\s+[NSEW])?\b/gi, " ")
    .replace(/\b(?:Highway|Hwy|Route|State\s+Road|State\s+Route|County\s+Road|CR)\s+\d+(?:\s+[NSEW])?\b/gi, " ")
    .replace(/\bon\s+421\b/gi, " ");
}

function stripAddressLikePhrasesForOptionText(value) {
  const addressLikePattern =
    /\b\d+\s+(?:[A-Za-z0-9.]+\s+){0,5}(?:street|st|road|rd|ave|avenue|drive|dr|lane|ln|court|ct|way|highway|hwy|route|pike|trail|terrace|parkway)\b(?:\s+(?:in\s+)?(?:Madison|Hanover)\b(?:,?\s+(?:Indiana|IN))?)?/gi;
  return asString(value).replace(addressLikePattern, (match) =>
    /\b(tree|trees|limb|limbs|branch|branches|brush|stump|haul|cleanup|clean|remove|removal|trim|cut|drop|cheap|basic|full)\b/i.test(match)
      ? match
      : " ",
  );
}

function textForOptionExtraction(rawInput) {
  const evidenceViews = buildEvidenceViews(rawInput);
  let text = stripNonPriceNumberPhrases(normalizeTreeServiceText(rawTextWithoutLeadContact(evidenceViews.optionPriceEvidence)))
    .replace(/\b([^.?!]*?\b(?:cleanup|clean up|haul(?:-away| away)?|stump|grind|debris|brush)[^.?!]*?)\s+(?:is|are)\s+included\s+in\s+(Option|Opt)\s*([A-E]|[1-5])\s+for\s+\$?\s*([0-9][0-9,]{2,})\b/gi, "$2 $3 $1 $4")
    .replace(/\s+/g, " ");
  const address = extractAddressFromRaw(rawInput);
  if (address) {
    text = text.replace(new RegExp(escapeRegExp(address), "i"), " ");
  }
  return stripAddressLikePhrasesForOptionText(text)
    .replace(/\b(?:lives?|address|service address|job at|service at)\s+\d+\s+(?:[A-Za-z0-9.]+\s+){0,5}(?:street|st|road|rd|ave|avenue|drive|dr|lane|ln|court|ct|way|highway|hwy)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function amountFromMatch(value) {
  const amount = Number(asString(value).replaceAll(",", ""));
  return Number.isFinite(amount) ? amount : null;
}

function priceContextText(text, match) {
  const start = Math.max(0, match.index - 42);
  const end = Math.min(text.length, match.index + match[0].length + 42);
  return text.slice(start, end);
}

function isLikelyPriceMatch(text, match) {
  if (/\$/.test(match[0])) return true;
  if (/\d,\d{3}/.test(match[1])) return true;
  return /\b(?:option|opt|price|quote|quoted|drop|cut|remove|removal|trim|haul|hauling|cleanup|clean|stump|grind|brush|debris|package|cheap|basic|full|normal|fancy|leave|wood|stack|only|plus|add|for|to)\b/i.test(
    priceContextText(text, match),
  );
}

function hasNonFirmPriceContext(value) {
  return /\b(?:around|about|roughly|maybe|probably|not\s+sure|unknown|unclear)\s+\$?\s*[0-9][0-9,]*(?:k|000)?\b|\bprice\s+depends\b|\b(?:price|amount|cost|quote)\b.{0,16}\b(?:unclear|unknown|not\s+sure|depends)\b/i.test(value || "");
}

function amountHasNonFirmContext(text, amount) {
  if (!amount) return false;
  const matches = Array.from(asString(text).matchAll(/\$*\s*([0-9][0-9,]{2,})/g)).filter(
    (match) => amountFromMatch(match[1]) === amount && isLikelyPriceMatch(text, match),
  );
  return Boolean(matches.length) && matches.every((match) => {
    const before = asString(text).slice(Math.max(0, match.index - 24), match.index);
    const after = asString(text).slice(match.index + match[0].length, match.index + match[0].length + 24);
    return /\b(?:around|about|roughly|maybe|probably)\s*$/i.test(before) ||
      /^\s*(?:ish\b|not\s+sure|unknown|unclear|depends\b)/i.test(after) ||
      /\bprice\s+depends\b/i.test(priceContextText(text, match));
  });
}

function markNonFirmOptionPrice(option, text) {
  const amount = parseAmount(option.price?.amount ?? option.amount ?? option.price);
  if (isSoftLabeledNumericOption(option)) return option;
  return amountHasNonFirmContext(text, amount) ? { ...option, price_unclear: true } : option;
}

function extractAddOnAmountOptions(text) {
  const options = [];
  const splitAmountPattern =
    /\b\$?\s*([0-9][0-9,]{2,})\s*(?:dollars?)?\s+(?:to|for)\s+(.+?)\s+(?:and\s+)?(?:also\s+)?(?:then\s+)?(?:add(?:\s+to\s+that)?|plus)\s+\$?\s*([0-9][0-9,]{2,})\s*(?:dollars?)?\s+(?:to|for)\s+(.+?)(?=$|[.;,])/i;
  const splitAmountMatch = text.match(splitAmountPattern);
  if (splitAmountMatch) {
    const baseDescription = cleanOptionPhrase(splitAmountMatch[2]);
    const addOnDescription = cleanOptionPhrase(splitAmountMatch[4]);
    if (baseDescription && addOnDescription) {
      options.push({ description: baseDescription, price: amountFromMatch(splitAmountMatch[1]) });
      options.push({
        description: isAddOnPhrase(addOnDescription) ? `${baseDescription} and ${addOnDescription}` : addOnDescription,
        price: amountFromMatch(splitAmountMatch[3]),
      });
      return options;
    }
  }

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
  const phraseMatch = text.match(
    /\b(?:price\s*)?\$?\s*([0-9][0-9,]{2,})\s+([^/$]{1,80}?)\s*\/\s*\$?\s*([0-9][0-9,]{2,})\s+([^.;,]+?)(?=$|[.;,])/i,
  );
  if (phraseMatch) {
    const baseDescription = cleanOptionPhrase(phraseMatch[2]);
    const secondDescription = cleanOptionPhrase(phraseMatch[4]);
    if (baseDescription && secondDescription) {
      return [
        { description: baseDescription, price: amountFromMatch(phraseMatch[1]) },
        { description: secondDescription, price: amountFromMatch(phraseMatch[3]) },
      ];
    }
  }

  const match = text.match(/\b(?:A\/B\s*)?\$?\s*([0-9][0-9,]{2,})\s*\/\s*\$?\s*([0-9][0-9,]{2,})(?:\s+(?:with\s+)?([^.;,?!]+))?/i);
  if (!match) return [];
  const trailing = asString(match[3]);
  const hasAbLabel = /^A\/B/i.test(match[0].trim());
  const uncertaintyWindow = text.slice(match.index, match.index + match[0].length + 80);
  const hasExplicitScopeUncertainty =
    /\bno\s+note\b|\bunclear\b|\bnot\s+sure\b|\bonly\s+clear\s+option\b|\bscope\b/i.test(uncertaintyWindow);
  if (hasExplicitScopeUncertainty) {
    return [
      { description: "work scope unclear", price: amountFromMatch(match[1]), preserve_order: true, scope_unclear: true },
      { description: "work scope unclear", price: amountFromMatch(match[2]), preserve_order: true, scope_unclear: true },
    ];
  }
  const addOn = /vs\s+/i.test(trailing)
    ? cleanOptionPhrase(trailing.split(/vs\s+/i).at(-1))
    : cleanOptionPhrase(trailing);
  const explicitBase = /vs\s+/i.test(trailing)
    ? cleanOptionPhrase(trailing.split(/vs\s+/i)[0])
    : "";
  const hasUsableAddOn = addOn && phraseHasWork(addOn) && !/\b(?:for\s+tree|no\s+note)\b/i.test(trailing);
  const base = hasUsableAddOn ? explicitBase || "basic tree work" : hasAbLabel && !hasExplicitScopeUncertainty ? "basic tree work" : "";
  const second = hasUsableAddOn ? `${base} and ${addOn}` : hasAbLabel && !hasExplicitScopeUncertainty ? "alternate tree work" : "";
  return [
    { description: base, price: amountFromMatch(match[1]) },
    { description: second, price: amountFromMatch(match[2]) },
  ];
}

function phraseHasWork(value) {
  return TREE_SERVICE_PATTERNS.workScope.test(value);
}

function extractKeywordPriceOptions(text) {
  const priceHaulMatch = text.match(/\bprice\s+\$?\s*([0-9][0-9,]{2,})\s+haul(?:\s+off|\s+away)?\s+\$?\s*([0-9][0-9,]{2,})\b/i);
  if (priceHaulMatch) {
    return [
      { description: "basic tree work", price: amountFromMatch(priceHaulMatch[1]) },
      { description: "basic tree work and haul", price: amountFromMatch(priceHaulMatch[2]) },
    ];
  }

  const cheapFullMatch = text.match(/\bcheap\s+way\s+\$?\s*([0-9][0-9,]{2,}).*?\bfull\s+cleanup\s+\$?\s*([0-9][0-9,]{2,})\b/i);
  if (cheapFullMatch) {
    return [
      { description: "cheap way", price: amountFromMatch(cheapFullMatch[1]) },
      { description: "full cleanup", price: amountFromMatch(cheapFullMatch[2]) },
    ];
  }

  const keywordPattern = new RegExp(
    `\\b(drop\\s+plus\\s+haul(?:\\s+away)?|cheap\\s+way|full\\s+cleanup|${TREE_SERVICE_PATTERN_SOURCES.lowerOption}|${TREE_SERVICE_PATTERN_SOURCES.addOnService})\\s+\\$?\\s*([0-9][0-9,]{2,})\\b`,
    "gi",
  );
  const matches = Array.from(text.matchAll(keywordPattern));
  if (matches.length < 2) return [];
  return matches.map((match) => ({
    description: cleanOptionPhrase(match[1].toLowerCase()),
    price: amountFromMatch(match[2]),
  }));
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

function extractBaseAndStumpPriceOptions(text) {
  const priceMatches = Array.from(text.matchAll(/\$*\s*([0-9][0-9,]{2,})/g)).filter((match) => isLikelyPriceMatch(text, match));
  if (priceMatches.length !== 2) return [];

  const [basePrice, stumpPrice] = priceMatches;
  const betweenPrices = cleanOptionPhrase(text.slice(basePrice.index + basePrice[0].length, stumpPrice.index));
  if (!TREE_SERVICE_PATTERNS.addOnService.test(betweenPrices)) return [];

  const baseDescription = cleanOptionPhrase(text.slice(0, basePrice.index));
  if (!baseDescription || !phraseHasWork(baseDescription)) return [];

  return [
    {
      description: baseDescription,
      price: amountFromMatch(basePrice[1]),
      preserve_order: true,
    },
    {
      description: /\bgrind|grinding\b/i.test(betweenPrices)
        ? "stump grinding"
        : /\bstumps?\b/i.test(betweenPrices)
          ? "stump work"
          : TREE_SERVICE_PATTERNS.addOnService.test(betweenPrices)
            ? betweenPrices
            : "add-on work",
      price: amountFromMatch(stumpPrice[1]),
      preserve_order: true,
    },
  ];
}

function extractSingleStumpPriceOption(text) {
  const priceMatches = Array.from(text.matchAll(/\$*\s*([0-9][0-9,]{2,})/g)).filter((match) => isLikelyPriceMatch(text, match));
  if (priceMatches.length !== 1) return [];

  const match = text.match(/\bstumps?\s*(?:grind(?:ing)?|remov(?:e|al))?\s*\$?\s*([0-9][0-9,]{2,})\b|\bstump\s+grind(?:ing)?\s*\$?\s*([0-9][0-9,]{2,})\b/i);
  if (!match) return [];

  const context = priceContextText(text, match);
  if (/\b(?:maybe|optional|not\s+sure|included\??|price\s+depends|around|about|roughly)\b/i.test(context)) return [];

  const phrase = match[0];
  return [{
    description: /\bgrind|grinding\b/i.test(phrase) ? "stump grinding" : "stump work",
    price: amountFromMatch(match[1] || match[2]),
    preserve_order: true,
  }];
}

function weakScopePriceOption(amount, description = "work scope unclear", flags = {}) {
  return {
    description,
    price: amount,
    preserve_order: true,
    scope_unclear: true,
    price_unclear: Boolean(flags.price_unclear),
  };
}

function conciseUnclearOptionDescription(value) {
  const text = cleanOptionPhrase(value);
  if (!text) return "work scope unclear";
  if (/\b(?:or|fix\s+it|customer\s+said|customer\s+wants?|included\??|if|unless|depends)\b/i.test(text)) {
    return "work scope unclear";
  }
  const leading = text.match(
    /^\s*((?:cleanup|clean\s+up|remove|trim|cut|drop|haul(?:\s+away)?|stump(?:\s+grinding)?|leave\s+wood|stack\s+wood)(?:\s+only)?)\b/i,
  );
  return leading ? leading[1].trim() : "work scope unclear";
}

function extractLabeledPriceOnlyOptions(text) {
  const patterns = [
    /\b(?:Option|Opt)\s*([A-E]|[1-5])\b\s*[:.)-]?\s*\$?\s*([0-9][0-9,]{2,})\b/gi,
    /(?:^|[\s.;,])([A-E])\s*[:.)-]?\s*\$?\s*([0-9][0-9,]{2,})\b/g,
  ];

  for (const pattern of patterns) {
    const matches = Array.from(text.matchAll(pattern));
    if (matches.length < 2) continue;
    return matches.slice(0, 4).map((match) => weakScopePriceOption(amountFromMatch(match[2])));
  }

  return [];
}

function extractImplicitOptionsFromRaw(rawInput) {
  const text = textForOptionExtraction(rawInput);
  const quoteCleanupPair = extractQuoteCleanupPricePair(text);
  if (quoteCleanupPair.length) {
    return quoteCleanupPair.map((option) => ({
      description: option.scope,
      price: option.amount,
    }));
  }

  const specialOptions = extractAddOnAmountOptions(text);
  if (specialOptions.length) return specialOptions.slice(0, 4);
  const slashOptions = extractSlashPriceOptions(text);
  if (slashOptions.length) return slashOptions.slice(0, 4);
  const keywordOptions = extractKeywordPriceOptions(text);
  if (keywordOptions.length) return keywordOptions;
  const packageOptions = extractPackageOptions(text);
  if (packageOptions.length) return packageOptions.slice(0, 4);
  const baseAndStumpOptions = extractBaseAndStumpPriceOptions(text);
  if (baseAndStumpOptions.length) return baseAndStumpOptions;
  const singleStumpOption = extractSingleStumpPriceOption(text);
  if (singleStumpOption.length) return singleStumpOption;
  const labeledPriceOnlyOptions = extractLabeledPriceOnlyOptions(text);
  if (labeledPriceOnlyOptions.length) return labeledPriceOnlyOptions;

  const prices = Array.from(text.matchAll(/\$*\s*([0-9][0-9,]{2,})/g)).filter((match) => isLikelyPriceMatch(text, match));
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
    options.push({
      description,
      price: Number(priceMatch[1].replaceAll(",", "")),
      price_unclear: hasNonFirmPriceContext(priceContextText(text, priceMatch)),
    });
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
  const uncertaintyText = `${before} ${after}`.trim();
  if (
    amount &&
    !/\bstump\b.{0,24}\bmaybe\b|\bmaybe\b.{0,24}\bstump\b|\bstump\b.{0,24}\bincluded\??/i.test(uncertaintyText) &&
    /\b(?:maybe|optional|not\s+sure|unclear|unknown|depends|if|unless|probably|roughly|about|around)\b/i.test(uncertaintyText)
  ) {
    const description = conciseUnclearOptionDescription(phraseHasWork(before) ? before : after);
    const hasNonFirmCue = /\b(?:maybe|probably|roughly|about|around)\b/i.test(uncertaintyText) || hasNonFirmPriceContext(body);
    return weakScopePriceOption(amount, description, { price_unclear: hasNonFirmCue });
  }
  if (
    amount &&
    (!before || !phraseHasWork(before)) &&
    (!after || /\b(?:not\s+sure|unclear|unknown|fix\s+it|take\s+care|only\s+clear\s+option|trim\s+or\s+remove|remove\s+or\s+trim|fix\s+tree)\b/i.test(after))
  ) {
    return weakScopePriceOption(amount, conciseUnclearOptionDescription(before || after));
  }
  const description = phraseHasWork(before) || !after ? before : after;
  if (description || amount) return { description, price: amount };
  return null;
}

function latestFollowUpSegment(text) {
  const parts = asString(text).split(/\bFollow-up\s+\d+\s*:/i);
  return parts.length > 1 ? parts.at(-1).trim() : "";
}

function softNumericStatusForLabeledBody(body, parsed) {
  return parsed?.price && /\b(?:maybe|around|about|roughly|probably)\s+\$?\s*[0-9][0-9,]*(?:k|000)?\b/i.test(body)
    ? "explicit_numeric_with_soft_language"
    : "firm";
}

function extractSegmentStartLabeledOptions(text) {
  return asString(text)
    .split(/\/\/|\r?\n|;|\./)
    .flatMap((segment) => {
      const match = segment.match(
        /^\s*([A-E])(?=\s*(?:[:.)/-]|\b(?:maybe|around|about|roughly|price|quote|cost|for|with|w|and|plus|drop|cut|remove|trim|take|haul|stump|grind|clean|leave|stack|brush|wood|limb|tree)\b|\$|\d))\s*(?:[:.)/-])?\s*(.*?)\s*$/i,
      );
      if (!match) return [];
      const parsed = parseOptionBody(match[2]);
      if (!parsed || (!phraseHasWork(parsed.description) && !parsed.price)) return [];
      return [{
        ...parsed,
        raw_label: match[1].toUpperCase(),
        price_status: softNumericStatusForLabeledBody(match[2], parsed),
        preserve_order: true,
      }];
    });
}

function extractLabeledOptionsFromText(text) {
  const segmentOptions = extractSegmentStartLabeledOptions(text);
  if (segmentOptions.length >= 2) return segmentOptions;

  const options = [];
  const patterns = [
    /\b(?:Option|Opt)\s*([A-E]|[1-5])\b(?:\s*[:.)-]|\s*\/)?\s*(.*?)(?=\b(?:Option|Opt)\s*(?:[A-E]|[1-5])\b(?:\s*[:.)-]|\s*\/)?\s*|$)/gi,
    /(?:^|[\s.;])([A-E])\s*[:.)-]\s*(.*?)(?=(?:[\s.;][A-E]\s*[:.)-]\s*)|$)/gi,
  ];

  for (const regex of patterns) {
    options.length = 0;
    let match;
    while ((match = regex.exec(text))) {
      const parsed = parseOptionBody(match[2].trim());
      if (parsed && (phraseHasWork(parsed.description) || parsed.price)) {
        options.push({
          ...parsed,
          raw_label: match[1].toUpperCase(),
          price_status: softNumericStatusForLabeledBody(match[2], parsed),
          preserve_order: true,
        });
      }
    }
    if (options.length >= 2 || (options.length === 1 && /option|opt/i.test(text))) return options;
  }

  return [];
}

function extractLabeledOptionsFromRaw(rawInput) {
  const sidecarOptions = extractSidecarOptionPairingsFromRaw(rawInput);
  if (sidecarOptions.length >= 2) return sidecarOptions;

  const latestFollowUp = latestFollowUpSegment(rawInput);
  if (latestFollowUp) {
    const followUpOptions = extractLabeledOptionsFromText(textForOptionExtraction(latestFollowUp));
    if (followUpOptions.length >= 2) return followUpOptions;
  }
  const text = textForOptionExtraction(rawInput);
  return extractLabeledOptionsFromText(text);
}

function extractSidecarOptionPairingsFromRaw(rawInput) {
  const pairings = buildOptionPriceCandidateView(rawInput)?.pre_ai_option_price_candidate_clues?.option_price_pairings || [];
  const segmentPairings = pairings.filter((pairing) => pairing.source === "option_price_sidecar_segment" && pairing.raw_label_token && pairing.price_value);
  const directPairings = pairings.filter((pairing) => pairing.source === "option_price_sidecar" && pairing.raw_label_token && pairing.price_value);
  const implicitPairings = pairings.filter((pairing) => (
    pairing.source === "option_price_sidecar_implicit" &&
    pairing.price_value &&
    pairing.confidence === "high" &&
    pairing.pairing_confidence === "high" &&
    pairing.amount_confidence === "high" &&
    pairing.price_status === "firm_candidate" &&
    !pairing.review_warning &&
    phraseHasWork(pairing.description_raw)
  ));
  const safeDirectPairings = directPairings.length === 2 && directPairings.every((pairing) => (
    pairing.confidence === "high" &&
    pairing.pairing_confidence === "high" &&
    pairing.amount_confidence === "high" &&
    pairing.price_status === "firm_candidate" &&
    !pairing.review_warning
  ))
    ? directPairings
    : [];
  const safeImplicitPairings = implicitPairings.length >= 3 && implicitPairings.length <= 4 ? implicitPairings : [];
  const highConfidencePairings = [...segmentPairings, ...directPairings, ...implicitPairings]
    .filter((pairing) => (
      pairing.confidence === "high" &&
      pairing.pairing_confidence === "high" &&
      pairing.amount_confidence === "high" &&
      pairing.price_status === "firm_candidate" &&
      !pairing.review_warning &&
      phraseHasWork(pairing.description_raw)
    ))
    .sort((left, right) => (left.span?.start ?? 0) - (right.span?.start ?? 0));
  const safeOverLimitPairings = highConfidencePairings.length > 4
    ? highConfidencePairings.slice(0, 4)
    : [];
  let usablePairings = safeImplicitPairings;
  if (segmentPairings.length >= 2) {
    usablePairings = segmentPairings;
  } else if (safeDirectPairings.length >= 2) {
    usablePairings = safeDirectPairings;
  } else if (safeOverLimitPairings.length >= 2) {
    usablePairings = safeOverLimitPairings;
  }

  return usablePairings
    .map((pairing) => ({
      raw_label: pairing.raw_label_token,
      description: pairing.description_raw || "work scope unclear",
      price: pairing.price_value,
      price_status: pairing.price_status === "explicit_numeric_with_soft_language"
        ? "explicit_numeric_with_soft_language"
        : "firm",
      preserve_order: true,
      scope_unclear: !pairing.description_raw,
      price_review_warning: Boolean(pairing.review_warning),
    }));
}

function extractOptionsFromRaw(rawInput) {
  const labeledOptions = extractLabeledOptionsFromRaw(rawInput);
  return labeledOptions.length ? labeledOptions : extractImplicitOptionsFromRaw(rawInput);
}

function normalizeOptions(rawJson, rawInput) {
  const modelOptions = collectModelOptions(rawJson);
  const sidecarOptions = extractSidecarOptionPairingsFromRaw(rawInput);
  const fallbackOptions = extractOptionsFromRaw(rawInput);
  const useSidecarOptions = sidecarOptions.length >= 2 && modelOptions.length < sidecarOptions.length;
  const useFallbackOptions = !useSidecarOptions && shouldUseFallbackOptionsForPlaceholderLeak(modelOptions, fallbackOptions);
  const rawOptions = useSidecarOptions
    ? sidecarOptions
    : useFallbackOptions
      ? fallbackOptions
      : (modelOptions.length ? modelOptions : fallbackOptions);
  const priceContextSource = textForOptionExtraction(rawInput);
  const normalized = rawOptions.map((option, index) => normalizeOption(markNonFirmOptionPrice(option, priceContextSource), index));
  return sortAndRelabelOptions(normalized);
}

function extractNameFromRaw(rawInput) {
  const rawText = asString(rawInput).replace(/\s+/g, " ");
  const text = stripEmails(rawText);
  const emailHint = extractEmailNameHint(rawText);
  const namePattern = "([A-Za-z\\u00c0-\\u024f][A-Za-z\\u00c0-\\u024f.'-]+(?:,\\s*[A-Za-z\\u00c0-\\u024f][A-Za-z\\u00c0-\\u024f.'-]+|\\s+[A-Za-z\\u00c0-\\u024f][A-Za-z\\u00c0-\\u024f.'-]+){0,3})";
  const stopPattern = "(?=\\s*(?:--|;|\\.|,|\\n|\\d|call\\b|text\\b|phone\\b|email\\b|send\\s+quote\\s+to\\b|address\\b|service\\b|job\\b|contact\\b|later\\b|fallen\\b|scope\\b|wants?\\b|needs?\\b|says?\\b|remove\\b|take\\b|cut\\b|option\\b|$))";
  const addressAfterCommaPattern = `(?=\\d+\\s+(?:[A-Za-z0-9.]+\\s+){0,5}${ADDRESS_SUFFIX}\\b|\\d+\\s+[A-Za-z0-9.]+\\s*,\\s*${LOCAL_CITY_PATTERN}\\b)`;
  const leadingJobPhrasePattern = "(?=[^,]{0,80}\\b(?:remove|removal|take\\s+down|cut|drop|trim|tree|trees|oak|pine|maple|elm|ash|cedar|stump|haul)\\b)";
  const patterns = [
    { pattern: new RegExp(`^\\s*${leadingJobPhrasePattern}[^,]+,\\s*${namePattern}\\s*,\\s*${addressAfterCommaPattern}`, "i"), source: text },
    { pattern: new RegExp(`\\b(?:note\\s+from|text\\s+from|message\\s+from|msg\\s+from|voicemail\\s+from|vm\\s+from|call\\s+from|called\\s+by)\\s+${namePattern}\\s+(?=send\\s+quote\\s+to\\s+[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b)`, "i"), source: rawText },
    { pattern: new RegExp(`\\b(?:note\\s+from|text\\s+from|email\\s+from|email|message\\s+from|msg\\s+from|voicemail\\s+from|vm\\s+from|call\\s+from|called\\s+by|send\\s+quote\\s+to|customer\\s+is|customer|client|homeowner|lady\\s+named|lady|guy|person)\\s+${namePattern}${stopPattern}`, "i"), source: text },
    { pattern: new RegExp(`^\\s*${namePattern}\\s*[;,]?\\s+(?=(?:address|service\\s+address|at)\\b|\\d+\\s+(?:[A-Za-z0-9.]+\\s+){0,5}${ADDRESS_SUFFIX}\\b)`, "i"), source: text },
    { pattern: new RegExp(`^\\s*${namePattern}\\s+(?:said|says?|wants?|needs?|call\\/text|called\\s+from|called|call|text|phone|email|no\\s+phone|no\\s+email|${PHONE_PATTERN.source})`, "i"), source: text },
    { pattern: new RegExp(`^\\s*${namePattern}\\s+(?=\\d+\\s+(?:[A-Za-z0-9.]+\\s+){0,5}${ADDRESS_SUFFIX}\\b)`, "i"), source: text },
    { pattern: new RegExp(`[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\s+(?:or\\s+)?${namePattern}${stopPattern}`, "i"), source: rawText },
    { pattern: new RegExp(`${PHONE_PATTERN.source}\\s+(?:or\\s+)?${namePattern}${stopPattern}`, "i"), source: text },
  ];

  for (const { pattern, source } of patterns) {
    const match = source.match(pattern);
    const candidate = match?.[1];
    const cleaned = orderNameUsingEmailHint(cleanCustomerName(candidate), emailHint);
    if (cleaned && !/^(?:Text|Call|Or)$/i.test(cleaned)) return cleaned;
  }

  if (emailHint.length >= 2) return `${emailHint[0]} ${emailHint[1]}`;
  return "";
}

function serviceZero(rawJson) {
  return Array.isArray(rawJson?.services) && rawJson.services.length ? rawJson.services[0] : {};
}

export function normalizeToAlphaJsonV14(rawJson = {}, rawInput = "", intakeFields = {}) {
  const responseJson = isObject(rawJson) ? rawJson : {};
  const modelJson = isObject(responseJson.alphaJson) ? responseJson.alphaJson : responseJson;
  const intake = normalizeIntakeFields(intakeFields);
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

  const modelProvidedName = hasNormalizationUncertainty(providedNormalization, ["customer_name", "customer name"])
    ? ""
    : firstString(client.name, customer.name, modelJson.name, base.customer.name);
  const name = firstCleanCustomerName(intake.name, modelProvidedName, extractNameFromRaw(sourceRawInput));
  const phone = normalizePhone(firstString(intake.phone, client.phone, customer.phone, customer.contact?.phone, modelJson.phone, modelJson.phone_number, base.customer.phone_display, extractPhoneFromRaw(sourceRawInput)));
  const email = firstString(intake.email, client.email, customer.email, customer.contact?.email, modelJson.email, modelJson.email_address, extractEmailFromRaw(sourceRawInput));
  const address = firstCleanAddress(
    intake.address,
    client.service_address,
    customer.service_address,
    composeAddress(customer.address),
    composeAddress(job.address),
    composeAddress(job.service_address),
    modelJson.service_address,
    modelJson.address,
    extractExplicitCityStateAddress(sourceRawInput),
    extractAddressFromRaw(sourceRawInput),
    base.job.service_address.display,
  );
  const treeCountOverride = intake.treeCountOverride;
  const treeCountCandidate = treeCountOverride === "Unknown" || isTreeCountUnclearOkOverride(treeCountOverride)
    ? ""
    : firstString(
        treeCountOverride,
        service.tree_count_scope,
        firstService.tree_count,
        serviceTree.count,
        job.tree_count,
        job.tree_details?.tree_count,
        modelJson.tree_count,
        base.job.tree_details.tree_count,
        extractTreeCountFromRaw(sourceRawInput),
      );
  const routeTreeJobFragment = /\b\d+\b.{0,20}\btree\s+job\b/i.test(sourceRawInput);
  const treeCountReviewEvidence = !treeCountOverride && (
    treeCountCandidateNeedsReview(treeCountCandidate) && !routeTreeJobFragment
      ? treeCountCandidate
      : treeCountReviewEvidenceFromText(sourceRawInput)
  );
  const treeCountRejectedEvidence = !treeCountOverride ? treeCountRejectedEvidenceFromText(sourceRawInput) : "";
  const treeCount = normalizeTreeCount(treeCountCandidate);
  const extractedTreeType = extractTreeTypeFromRaw(sourceRawInput);
  const extractedTreeTypeEvidence = normalizeTreeServiceText(stripAddressEvidence(normalizeTreeServiceText(sourceRawInput)));
  const safeExtractedTreeType =
    extractedTreeType && extractTreeTypeFromRaw(extractedTreeTypeEvidence) === extractedTreeType
      ? extractedTreeType
      : "";
  const treeType = firstString(serviceTree.type, firstService.tree_type, job.tree_details?.tree_type, base.job.tree_details.tree_type, safeExtractedTreeType);
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
  const rawOptionPairingCount =
    buildOptionPriceCandidateView(sourceRawInput)?.pre_ai_option_price_candidate_clues?.option_price_pairings?.length || 0;
  base.layout_flags = {
    ...(base.layout_flags || {}),
    option_count: options.length,
    over_normal_option_limit:
      collectModelOptions(modelJson).length > 4 || rawOptionPairingCount > 4 || extractOptionsFromRaw(sourceRawInput).length > 4,
  };
  base.raw_input.customer_text = sourceRawInput;
  const basicNormalization = buildBasicNormalizationFromRawInput(sourceRawInput, base);
  base.normalization = mergeNormalization(providedNormalization, basicNormalization);
  if (treeCountReviewEvidence || treeCountRejectedEvidence) {
    base.normalization.uncertainties = [
      ...(base.normalization.uncertainties || []),
      {
        field: "tree_count",
        issue: treeCountReviewEvidence
          ? "Tree count is unusually high and needs explicit confirmation."
          : "Large number near tree species was ignored as a tree count.",
        evidence: treeCountReviewEvidence || treeCountRejectedEvidence,
      },
    ];
  }
  if (treeCountOverride) {
    base.normalization.field_evidence = {
      ...base.normalization.field_evidence,
      tree_count_override: treeCountOverride,
    };
    if (treeCountOverride === "Unknown" || isTreeCountUnclearOkOverride(treeCountOverride)) {
      base.normalization.uncertainties = [
        ...(base.normalization.uncertainties || []),
        {
          field: "tree_count",
          issue: isTreeCountUnclearOkOverride(treeCountOverride)
            ? "Tree count was still unclear but OK'd when the estimate was created."
            : "Tree count was marked unknown.",
          evidence: `Tree count override: ${treeCountOverride}`,
        },
      ];
    }
  }
  base.normalization.corrected_interpretation =
    cleanCorrectedInterpretation(base.normalization.corrected_interpretation, base) ||
    basicNormalization.corrected_interpretation;
  reconcileParsedFacts(base, base.normalization);
  if (treeCountOverride === "Unknown" || isTreeCountUnclearOkOverride(treeCountOverride)) {
    base.job.tree_details.tree_count = "";
  } else if (treeCountOverride) {
    base.job.tree_details.tree_count = treeCountOverride;
  }
  base.normalization.corrected_interpretation =
    cleanCorrectedInterpretation(base.normalization.corrected_interpretation, base) ||
    basicNormalization.corrected_interpretation;
  applyOptionScopeInference(base);
  base.job.description = buildCustomerJobSummary(base);
  base.normalization.field_evidence = {
    ...base.normalization.field_evidence,
    tree_count: base.job.tree_details.tree_count || base.normalization.field_evidence.tree_count || "",
    work_scope: base.job.description,
  };

  return base;
}
