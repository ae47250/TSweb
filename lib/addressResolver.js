import { normalizeServiceAddress } from "./normalizeAlphaJson.js";
import { appendIndianaForLocalTown, LOCAL_TOWN_PATTERN } from "./localTowns.js";

const ADDRESS_SUFFIX =
  "(?:Street|St|Road|Rd|Ave|Avenue|Drive|Dr|Lane|Ln|Court|Ct|Way|Blvd|Boulevard|Highway|Hwy|Route|State Route|County Road|CR|Pike|Circle|Cir|Place|Pl|Terrace|Ter|Trail|Trl|Parkway|Pkwy|Bend|Main)";
const US_STATE_PATTERN =
  "(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New\\s+Hampshire|New\\s+Jersey|New\\s+Mexico|New\\s+York|North\\s+Carolina|North\\s+Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode\\s+Island|South\\s+Carolina|South\\s+Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West\\s+Virginia|Wisconsin|Wyoming)";
const GENERIC_CITY_STATE_PATTERN = `([A-Za-z][A-Za-z.'-]*(?:\\s+[A-Za-z][A-Za-z.'-]*){0,3})(?:\\s*,\\s*|\\s+)(${US_STATE_PATTERN})(?:\\s+(\\d{5}(?:-\\d{4})?))?`;
const ADDRESS_STOP_WORD_PATTERN =
  /\b(?:option|opt|price|quote|phone|email|remove|removal|trim|cut|drop|take\s+down|tree|trees|stump|haul|cleanup|clean|near|by|beside|behind|over|along|toward|leaning)\b/i;

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function contactAddressFromDraft(draft) {
  return asString(draft?.contact?.service_address || draft?.service_address);
}

function rawAddressCandidate(rawInput) {
  const text = asString(rawInput).replace(/\s+/g, " ");
  const match = text.match(
    /\b(?:service\s+address|service\s+at|job\s+at|address|property\s+is)\s+(.{4,100}?)(?=\b(?:remove|trim|cut|drop|take\s+down|option|opt|price|quote|phone|email)\b|$|[.;])/i,
  );
  return match?.[1] || "";
}

function rejectReason(value) {
  const text = asString(value);
  if (!text) return "missing";
  if (/(?:\+?1[-./\s]?)?\(?\d{3}\)?[-./\s]?\d{3}[-./\s]?\d{4}/.test(text)) return "contains phone number";
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) return "contains email";
  if (/\b(?:option|opt|price|quote|quoted|remove|removal|trim|cut|drop|stump|haul|cleanup|tree|trees)\b/i.test(text)) {
    return "looks like job text";
  }
  return "";
}

function cleanCandidate(value) {
  const rejected = rejectReason(value);
  if (rejected) return { value: "", rejected };
  const normalized = normalizeServiceAddress(value);
  const cleaned = formatLocalTownAddress(hasExplicitState(normalized) ? normalized : appendIndianaForLocalTown(normalized));
  if (!cleaned) return { value: "", rejected: "missing" };
  return { value: cleaned, rejected: "" };
}

function hasExplicitState(value) {
  return new RegExp(`\\b${US_STATE_PATTERN}\\b(?:\\s+\\d{5}(?:-\\d{4})?)?`, "i").test(asString(value));
}

function formatLocalTownAddress(value) {
  const text = asString(value).replace(/\s+/g, " ");
  const pattern = new RegExp(`^(.+?\\b${ADDRESS_SUFFIX}\\b(?:\\s+\\d+\\s*[NSEW])?)(?:\\s+|\\s*[-–—]+\\s*)(${LOCAL_TOWN_PATTERN})\\s*,?\\s*(Indiana|IN)$`, "i");
  const match = text.match(pattern);
  if (match) return `${match[1].trim()}, ${match[2].replace(/\s+/g, " ").trim()}, ${match[3].trim()}`;

  const genericPattern = new RegExp(`^(.+?\\b${ADDRESS_SUFFIX}\\b(?:\\s+\\d+\\s*[NSEW])?)(?:\\s+|\\s*[-–—]+\\s*)${GENERIC_CITY_STATE_PATTERN}$`, "i");
  const genericMatch = text.match(genericPattern);
  if (!genericMatch) return text;
  const city = genericMatch[2].replace(/\s+/g, " ").trim();
  if (!city || ADDRESS_STOP_WORD_PATTERN.test(city)) return text;
  return `${genericMatch[1].trim()}, ${city}, ${genericMatch[3].trim()}${genericMatch[4] ? ` ${genericMatch[4].trim()}` : ""}`;
}

/**
 * Customer delivery requires a street, locality, and state. A street-only
 * value remains useful as an extraction candidate, but it cannot clear an
 * address review blocker or be written through as a reviewer override.
 */
export function isCompleteServiceAddress(value) {
  const text = asString(value).replace(/\s+/g, " ").trim();
  if (!text || rejectReason(text)) return false;

  const stateMatch = text.match(new RegExp(`(?:^|[\\s,])(${US_STATE_PATTERN})(?:\\s+\\d{5}(?:-\\d{4})?)?$`, "i"));
  if (!stateMatch) return false;

  const beforeState = text.slice(0, stateMatch.index).replace(/[\s,]+$/, "").trim();
  if (!/^\d+[A-Za-z]?(?:[-/]\d+)?\s+/.test(beforeState)) return false;

  const commaParts = beforeState.split(",").map((part) => part.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    const street = commaParts.slice(0, -1).join(" ");
    const locality = commaParts.at(-1) || "";
    return /^\d+[A-Za-z]?(?:[-/]\d+)?\s+\S+/.test(street) &&
      /^[A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,3}$/.test(locality);
  }

  const tokens = beforeState.split(/\s+/).filter(Boolean);
  if (tokens.length < 3) return false;
  const locality = tokens.at(-1) || "";
  const street = tokens.slice(0, -1).join(" ");
  return /^[A-Za-z][A-Za-z.'-]*$/.test(locality) &&
    /^\d+[A-Za-z]?(?:[-/]\d+)?\s+\S+/.test(street);
}

export function resolveServiceAddress({ intake = {}, draft = {}, rawInput = "" } = {}) {
  const sources = [
    ["intake", asString(intake.address || intake.service_address || intake.serviceAddress)],
    ["openai_draft", contactAddressFromDraft(draft)],
    ["raw_regex", rawAddressCandidate(rawInput || draft?.raw_input?.customer_text)],
  ];
  const warnings = [];

  for (const [source, candidate] of sources) {
    const result = cleanCandidate(candidate);
    if (result.value && isCompleteServiceAddress(result.value)) {
      return {
        value: result.value,
        status: "resolved",
        source,
        evidence: candidate,
        warnings,
        blockingIssues: [],
      };
    }
    if (result.value && !isCompleteServiceAddress(result.value)) {
      warnings.push(`Rejected ${source} address candidate: incomplete or ambiguous service address.`);
      continue;
    }
    if (candidate && result.rejected !== "missing") {
      warnings.push(`Rejected ${source} address candidate: ${result.rejected}.`);
    }
  }

  return {
    value: "",
    status: warnings.length ? "rejected" : "missing",
    source: "none",
    evidence: "",
    warnings,
    blockingIssues: ["Missing service address."],
  };
}
