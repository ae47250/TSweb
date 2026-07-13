import { LOCAL_INDIANA_TOWNS, LOCAL_TOWN_PATTERN } from "./localTowns.js";

const EMAIL_VALUE_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const EMAIL_VALUE_GLOBAL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_VALUE_PATTERN = /(?<![\d$])(?:\+?1[-.\s/]?)?\(?\d{3}\)?[-.\s/]?\d{3}[-.\s/]?\d{4}(?![\d%])/i;
const PHONE_VALUE_GLOBAL_PATTERN = /(?<![\d$])(?:\+?1[-.\s/]?)?\(?\d{3}\)?[-.\s/]?\d{3}[-.\s/]?\d{4}(?![\d%])/gi;
const EMAIL_LABEL_PATTERN = /\b(Customer\s+email|Send\s+quote\s+to|E-mail|Email(?:\s+address)?|Contact\s+email|Reply\s+to|Write\s+to)\b\s*[:#-]?\s*/gi;
const EMAIL_CUE_PATTERN = /\b(?:e-mail|email(?:\s+address)?|write\s+to|message|reply\s+to|dm)\b\s*[:#-]?\s*/gi;
const WRITTEN_OUT_EMAIL_PATTERN =
  /\b([A-Z0-9][A-Z0-9._-]*(?:\s+[A-Z0-9][A-Z0-9._-]*){0,2})\s+(?:at|\[at\]|\(at\))\s+([A-Z0-9][A-Z0-9-]*(?:\s+[A-Z0-9][A-Z0-9-]*)?)\s+(?:dot|\[dot\]|\(dot\))\s+([A-Z]{2,6})\b/gi;
const PHONE_LABEL_PATTERN = /\b(Customer\s+phone|Call\/text|Phone|Call|Text|Cell)\b\s*[:#-]?\s*/gi;
const ADDRESS_SUFFIX =
  "(?:Street|St|Road|Rd|Ave|Avenue|Drive|Dr|Lane|Ln|Court|Ct|Way|Blvd|Boulevard|Highway|Hwy|Route|State Route|County Road|CR|Pike|Circle|Cir|Place|Pl|Terrace|Ter|Trail|Trl|Parkway|Pkwy|Bend|Main)";
const ADDRESS_BASE_PATTERN = new RegExp(
  `\\b\\d{1,5}\\s+(?:[A-Za-z0-9.'-]+\\s+){0,5}${ADDRESS_SUFFIX}\\b(?:\\s+\\d+\\s*[NSEW]\\b)?`,
  "gi",
);
const LOCAL_TOWN_AFTER_ADDRESS_PATTERN = new RegExp(
  `^\\s*,?\\s*(${LOCAL_TOWN_PATTERN})\\b(?:\\s*,?\\s*(Indiana|IN))?(?:\\s+(\\d{5}(?:-\\d{4})?))?`,
  "i",
);
const INDIANA_CITY_AFTER_ADDRESS_PATTERN =
  /^\s*,?\s*([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,2})\s*,?\s+(Indiana|IN)\b(?:\s+(\d{5}(?:-\d{4})?))?/i;
const NUMBERED_ROUTE_SUFFIX_PATTERN = /\b(?:County\s+(?:Road|Rd)|State\s+(?:Road|Route)|Highway|Hwy|Route|CR|Road|Rd)$/i;
const ROUTE_NUMBER_AFTER_ADDRESS_PATTERN = /^\s+(\d+(?:\s*[NSEW])?)\b/i;
const EMAIL_PROVIDER_ALLOWLIST = new Set(["gmail", "hotmail", "yahoo", "outlook", "icloud"]);
const EMAIL_TLD_ALLOWLIST = new Set(["com", "net", "org", "edu", "gov"]);
const EMAIL_PROVIDER_TYPO_MAP = [
  { typo: "gmial", value: "gmail", confidence: "high" },
  { typo: "gmai", value: "gmail", confidence: "medium" },
  { typo: "gmal", value: "gmail", confidence: "medium" },
  { typo: "gnail", value: "gmail", confidence: "medium" },
  { typo: "gmaill", value: "gmail", confidence: "medium" },
  { typo: "hotmial", value: "hotmail", confidence: "high" },
  { typo: "hotmal", value: "hotmail", confidence: "medium" },
  { typo: "hormail", value: "hotmail", confidence: "medium" },
  { typo: "yaho", value: "yahoo", confidence: "high" },
  { typo: "yahooo", value: "yahoo", confidence: "medium" },
  { typo: "yhaoo", value: "yahoo", confidence: "medium" },
  { typo: "outlok", value: "outlook", confidence: "high" },
  { typo: "outllok", value: "outlook", confidence: "medium" },
  { typo: "icolud", value: "icloud", confidence: "medium" },
];
const EMAIL_TLD_TYPO_MAP = [
  { typo: "cmo", value: "com", confidence: "high" },
  { typo: "con", value: "com", confidence: "high" },
  { typo: "ocm", value: "com", confidence: "high" },
  { typo: "cim", value: "com", confidence: "medium" },
  { typo: "ent", value: "net", confidence: "medium" },
  { typo: "ogr", value: "org", confidence: "medium" },
  { typo: "eud", value: "edu", confidence: "medium" },
  { typo: "gvo", value: "gov", confidence: "medium" },
];
const STRONG_EMAIL_CONTEXT_PATTERN = /\b(?:customer\s+email|send\s+quote\s+to|e-mail|email(?:\s+address)?|mail|address|write\s+to|message|reply\s+to|dm|contact\s+email|email\s+me|best\s+email)\b/i;
const EMAIL_FOLLOWING_CONTEXT_PATTERN =
  /^\s*(?:$|[\r\n,;:)\].-]|thanks\b|cheers\b|signature\b|phone\b|call\b|text\b|(?:\+?1[-.\s/]?)?\(?\d{3}\)?[-.\s/]?\d{3}[-.\s/]?\d{4}\b)/i;
const WRITTEN_OUT_LOCAL_STOPWORDS = new Set([
  "address",
  "at",
  "call",
  "cell",
  "customer",
  "dm",
  "dot",
  "email",
  "home",
  "mail",
  "message",
  "phone",
  "reply",
  "service",
  "text",
  "to",
  "write",
  "yard",
]);

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function trimOuterPunctuation(value) {
  return asString(value)
    .trim()
    .replace(/^[\s"'()[\]{}<>]+/g, "")
    .replace(/[\s"'()[\]{}<>,;:!?.]+$/g, "")
    .trim();
}

function contextAround(text, start, end, windowSize = 35) {
  const source = asString(text);
  const from = Math.max(0, start - windowSize);
  const to = Math.min(source.length, end + windowSize);
  return source.slice(from, to).replace(/\s+/g, " ").trim();
}

function overlaps(spanA, spanB) {
  return spanA.start < spanB.end && spanB.start < spanA.end;
}

function candidateKey(candidate) {
  return [
    candidate.field,
    candidate.source,
    candidate.label,
    candidate.raw,
    candidate.span ? `${candidate.span.start}-${candidate.span.end}` : "no-span",
  ].join("|");
}

function canonicalEmailLabel(label) {
  const lowered = asString(label).toLowerCase();
  if (lowered === "customer email") return "Customer email";
  if (lowered === "send quote to") return "Send quote to";
  if (lowered === "e-mail") return "E-mail";
  if (lowered === "email" || lowered === "email address") return "Email";
  if (lowered === "contact email") return "Contact email";
  if (lowered === "reply to") return "Reply to";
  if (lowered === "write to") return "Write to";
  return "";
}

function canonicalPhoneLabel(label) {
  const lowered = asString(label).toLowerCase();
  if (lowered === "customer phone") return "Customer phone";
  if (lowered === "call/text") return "Call/text";
  if (lowered === "phone") return "Phone";
  if (lowered === "call") return "Call";
  if (lowered === "text") return "Text";
  if (lowered === "cell") return "Cell";
  return "";
}

function compactWhitespace(value) {
  return asString(value).replace(/\s+/g, " ").trim();
}

function canonicalLocalTown(value) {
  const compact = compactWhitespace(value);
  return LOCAL_INDIANA_TOWNS.find((town) => town.toLowerCase() === compact.toLowerCase()) || compact;
}

function buildAddressCandidate({ raw, value, source, span, confidence, completeness, town = "", stateSource = "" }) {
  return {
    field: "job.service_address",
    value,
    raw: compactWhitespace(raw),
    source,
    label: "Service address",
    span,
    confidence,
    completeness,
    town,
    state_source: stateSource,
    accepted: false,
    rejected_reason: "",
    valid: Boolean(value),
  };
}

function scanAddressCandidates(text, { source = "raw_unlabeled", includeSpans = true } = {}) {
  const input = asString(text);
  const candidates = [];
  ADDRESS_BASE_PATTERN.lastIndex = 0;

  for (const match of input.matchAll(ADDRESS_BASE_PATTERN)) {
    const start = match.index ?? 0;
    let baseEnd = start + match[0].length;
    let street = compactWhitespace(match[0]);
    let after = input.slice(baseEnd, Math.min(input.length, baseEnd + 80));

    if (NUMBERED_ROUTE_SUFFIX_PATTERN.test(street)) {
      const routeNumberMatch = after.match(ROUTE_NUMBER_AFTER_ADDRESS_PATTERN);
      if (routeNumberMatch) {
        const afterRouteNumber = after.slice(routeNumberMatch[0].length);
        if (LOCAL_TOWN_AFTER_ADDRESS_PATTERN.test(afterRouteNumber) || INDIANA_CITY_AFTER_ADDRESS_PATTERN.test(afterRouteNumber)) {
          street = `${street} ${routeNumberMatch[1]}`;
          baseEnd += routeNumberMatch[0].length;
          after = afterRouteNumber;
        }
      }
    }

    const localTownMatch = after.match(LOCAL_TOWN_AFTER_ADDRESS_PATTERN);

    if (localTownMatch) {
      const end = baseEnd + localTownMatch[0].length;
      const town = canonicalLocalTown(localTownMatch[1]);
      const zip = localTownMatch[3] ? ` ${localTownMatch[3]}` : "";
      candidates.push(buildAddressCandidate({
        raw: input.slice(start, end),
        value: `${street}, ${town}, Indiana${zip}`,
        source,
        span: includeSpans ? { start, end } : null,
        confidence: "high",
        completeness: "complete",
        town,
        stateSource: localTownMatch[2] ? "explicit" : "local_town_default",
      }));
      continue;
    }

    const indianaCityMatch = after.match(INDIANA_CITY_AFTER_ADDRESS_PATTERN);
    if (indianaCityMatch) {
      const end = baseEnd + indianaCityMatch[0].length;
      const town = compactWhitespace(indianaCityMatch[1]);
      const zip = indianaCityMatch[3] ? ` ${indianaCityMatch[3]}` : "";
      candidates.push(buildAddressCandidate({
        raw: input.slice(start, end),
        value: `${street}, ${town}, Indiana${zip}`,
        source,
        span: includeSpans ? { start, end } : null,
        confidence: "high",
        completeness: "complete",
        town,
        stateSource: "explicit",
      }));
      continue;
    }

    candidates.push(buildAddressCandidate({
      raw: input.slice(start, baseEnd),
      value: street,
      source,
      span: includeSpans ? { start, end: baseEnd } : null,
      confidence: "medium",
      completeness: "town_missing",
      stateSource: "missing",
    }));
  }

  ADDRESS_BASE_PATTERN.lastIndex = 0;
  return candidates;
}

function chooseAcceptedAddressCandidate(candidates) {
  const confidenceRank = { high: 0, medium: 1, low: 2 };
  return [...candidates]
    .filter((candidate) => candidate.valid)
    .sort((left, right) => {
      const confidenceDifference = (confidenceRank[left.confidence] ?? 3) - (confidenceRank[right.confidence] ?? 3);
      if (confidenceDifference) return confidenceDifference;
      const sourceDifference = (left.source === "intake" ? 0 : 1) - (right.source === "intake" ? 0 : 1);
      if (sourceDifference) return sourceDifference;
      return (left.span?.start ?? Number.POSITIVE_INFINITY) - (right.span?.start ?? Number.POSITIVE_INFINITY);
    })[0] || null;
}

function addressWarnings(candidates) {
  const distinct = new Set(candidates.filter((candidate) => candidate.valid).map((candidate) => candidate.value.toLowerCase()));
  return distinct.size > 1 ? ["Multiple address candidates found; using highest-confidence candidate."] : [];
}

function confidenceRank(value) {
  if (value === "high") return 2;
  if (value === "medium") return 1;
  return 0;
}

function highestConfidence(...values) {
  return values.reduce((best, value) => (confidenceRank(value) > confidenceRank(best) ? value : best), "low");
}

function levenshteinDistance(left, right) {
  const a = asString(left).toLowerCase();
  const b = asString(right).toLowerCase();
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + substitutionCost,
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length];
}

function resolveTypoMapEntry(value, entries) {
  const normalized = asString(value).toLowerCase().trim();
  if (!normalized) return null;

  const exact = entries.find((entry) => entry.typo === normalized);
  if (exact) return exact;

  let best = null;
  for (const entry of entries) {
    const distance = levenshteinDistance(normalized, entry.typo);
    if (distance > 2) continue;
    if (!best || distance < best.distance || (distance === best.distance && entry.value < best.entry.value)) {
      best = { entry, distance };
    }
  }

  if (!best) return null;

  const tied = entries.filter((entry) => levenshteinDistance(normalized, entry.typo) === best.distance);
  if (tied.some((entry) => entry.value !== best.entry.value)) return null;

  return best.entry;
}

function resolveAllowedDomainPart(value, allowlist, typoMap) {
  const normalized = asString(value).toLowerCase().trim();
  if (!normalized) return null;
  if (allowlist.has(normalized)) {
    return { value: normalized, corrected: false, confidence: null };
  }

  const match = resolveTypoMapEntry(normalized, typoMap);
  if (!match || !allowlist.has(match.value)) return null;

  return {
    value: match.value,
    corrected: true,
    confidence: match.confidence,
  };
}

function normalizeEmailCandidate(value) {
  const text = trimOuterPunctuation(value).replace(/^mailto:/i, "");
  if (!text) return null;
  if (/\s/.test(text)) return null;
  if ((text.match(/@/g) || []).length !== 1) return null;

  const [localPart, domainPart] = text.split("@");
  const local = asString(localPart).trim();
  const domain = asString(domainPart).trim().toLowerCase();
  if (!local || !domain || !domain.includes(".")) return null;

  const domainSegments = domain.split(".");
  const tldPart = domainSegments.pop();
  const providerPart = domainSegments.join(".");
  if (!providerPart || !tldPart) return null;

  const provider = resolveAllowedDomainPart(providerPart, EMAIL_PROVIDER_ALLOWLIST, EMAIL_PROVIDER_TYPO_MAP);
  const tld = resolveAllowedDomainPart(tldPart, EMAIL_TLD_ALLOWLIST, EMAIL_TLD_TYPO_MAP);
  const hasCorrection = Boolean(provider?.corrected || tld?.corrected);
  if (!hasCorrection) {
    const exact = text.toLowerCase();
    return EMAIL_VALUE_PATTERN.test(exact) ? { value: exact, corrected: false, confidence: null } : null;
  }
  if (!provider || !tld) return null;

  const corrected = `${local}@${provider.value}.${tld.value}`.toLowerCase();
  if (!EMAIL_VALUE_PATTERN.test(corrected)) return null;

  return {
    value: corrected,
    corrected: true,
    confidence: highestConfidence(provider.confidence, tld.confidence),
  };
}

export function normalizeEmail(value) {
  const text = trimOuterPunctuation(value).replace(/^mailto:/i, "");
  if (!text) return "";
  if (/\s/.test(text)) return "";
  if ((text.match(/@/g) || []).length !== 1) return "";
  if (!EMAIL_VALUE_PATTERN.test(text)) return "";
  return text.toLowerCase();
}

export function normalizePhoneCandidate(value) {
  const digits = asString(value).replace(/\D/g, "");
  const normalized = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (normalized.length !== 10) return null;
  return {
    value: normalized,
    display: `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`,
  };
}

function hasStrongEmailContext(text, start, end) {
  return STRONG_EMAIL_CONTEXT_PATTERN.test(contextAround(text, start, end, 45)) || EMAIL_FOLLOWING_CONTEXT_PATTERN.test(asString(text).slice(end, end + 45));
}

function writtenOutEmailCandidateRaw(localPart, providerPart, tldPart) {
  const localTokens = asString(localPart).trim().split(/\s+/).filter(Boolean);
  const provider = asString(providerPart).trim().split(/\s+/).join("");
  const tld = asString(tldPart).trim();

  if (!localTokens.length || localTokens.length > 3 || !provider || !tld) return "";
  if (localTokens.some((token) => WRITTEN_OUT_LOCAL_STOPWORDS.has(token.toLowerCase()))) return "";

  return `${localTokens.join(".")}@${provider}.${tld}`;
}

function buildEmailCandidate({ raw, candidateRaw = raw, source, label, span, confidence, strongContext = false, accepted = false, rejected_reason = "" }) {
  const resolved = normalizeEmailCandidate(candidateRaw);
  const valid = Boolean(resolved);
  return {
    field: "customer.email",
    value: valid ? resolved.value : "",
    raw: asString(raw).trim(),
    source,
    label,
    span,
    confidence: valid ? (strongContext ? "high" : resolved.confidence || confidence) : "low",
    accepted: valid && accepted,
    rejected_reason: valid ? rejected_reason : rejected_reason || "Email candidate did not match a valid email address.",
    valid,
  };
}

function buildPhoneCandidate({ raw, source, label, span, confidence, accepted = false, rejected_reason = "" }) {
  const normalized = normalizePhoneCandidate(raw);
  const valid = Boolean(normalized);
  return {
    field: "customer.phone",
    value: valid ? normalized.value : "",
    display: valid ? normalized.display : "",
    raw: asString(raw).trim(),
    source,
    label,
    span,
    confidence: valid ? confidence : "low",
    accepted: valid && accepted,
    rejected_reason: valid ? rejected_reason : rejected_reason || "Phone candidate did not contain a valid 10-digit US number.",
    valid,
  };
}

function chooseAcceptedCandidate(candidates) {
  const valid = candidates.filter((candidate) => candidate.valid);
  if (!valid.length) return null;
  // Candidate priority:
  // 1. intake: trusted structured TD1 fields already present before free-text parsing
  // 2. raw_labeled: contact values found near explicit labels in raw note
  // 3. raw_unlabeled: contact-looking values found without labels
  //
  // Do not reverse this order unless intake fields become model-extracted or otherwise untrusted.
  return [...valid].sort((left, right) => {
    const leftRank = left.source === "intake" ? 0 : left.source === "raw_labeled" ? 1 : 2;
    const rightRank = right.source === "intake" ? 0 : right.source === "raw_labeled" ? 1 : 2;
    if (leftRank !== rightRank) return leftRank - rightRank;
    const leftStart = left.span?.start ?? Number.POSITIVE_INFINITY;
    const rightStart = right.span?.start ?? Number.POSITIVE_INFINITY;
    if (leftStart !== rightStart) return leftStart - rightStart;
    return candidateKey(left).localeCompare(candidateKey(right));
  })[0];
}

function finalizeCandidates(candidates, accepted) {
  return candidates.map((candidate) => ({
    field: candidate.field,
    value: candidate.value,
    ...(candidate.display ? { display: candidate.display } : {}),
    raw: candidate.raw,
    source: candidate.source,
    label: candidate.label,
    span: candidate.span,
    confidence: candidate.confidence,
    ...(candidate.completeness ? { completeness: candidate.completeness } : {}),
    ...(candidate.town ? { town: candidate.town } : {}),
    ...(candidate.state_source ? { state_source: candidate.state_source } : {}),
    accepted: Boolean(accepted && candidateKey(candidate) === candidateKey(accepted)),
    rejected_reason: candidate.valid
      ? accepted && candidateKey(candidate) !== candidateKey(accepted)
        ? "Higher-priority candidate was selected."
        : ""
      : candidate.rejected_reason,
  }));
}

function addLowConfidenceSpan(spans, nextSpan) {
  if (!nextSpan || !nextSpan.text) return;
  const key = `${nextSpan.field}|${nextSpan.text}|${nextSpan.reason}`;
  if (!spans.some((span) => `${span.field}|${span.text}|${span.reason}` === key)) {
    spans.push(nextSpan);
  }
}

function findWrittenOutEmailMatch(text) {
  WRITTEN_OUT_EMAIL_PATTERN.lastIndex = 0;
  const match = WRITTEN_OUT_EMAIL_PATTERN.exec(text);
  WRITTEN_OUT_EMAIL_PATTERN.lastIndex = 0;
  return match;
}

function buildWrittenOutEmailCandidate({ match, source, label, span, confidence, strongContext }) {
  const candidateRaw = writtenOutEmailCandidateRaw(match[1], match[2], match[3]);
  return buildEmailCandidate({
    raw: match[0],
    candidateRaw,
    source,
    label,
    span,
    confidence,
    strongContext,
  });
}

function scanLabelledEmailCandidates(text, occupiedSpans, lowConfidenceSpans) {
  const candidates = [];

  for (const match of text.matchAll(EMAIL_LABEL_PATTERN)) {
    const label = canonicalEmailLabel(match[1]);
    const searchStart = match.index + match[0].length;
    const window = text.slice(searchStart, Math.min(text.length, searchStart + 120));
    const localMatch = window.match(EMAIL_VALUE_PATTERN);

    if (localMatch) {
      const localIndex = window.search(EMAIL_VALUE_PATTERN);
      const start = searchStart + localIndex;
      const end = start + localMatch[0].length;
      candidates.push(
        buildEmailCandidate({
          raw: text.slice(start, end),
          source: "raw_labeled",
          label,
          span: { start, end },
          confidence: "high",
          strongContext: true,
        }),
      );
      occupiedSpans.push({ start, end });
      continue;
    }

    const writtenOutMatch = findWrittenOutEmailMatch(window);
    if (writtenOutMatch) {
      const start = searchStart + writtenOutMatch.index;
      const end = start + writtenOutMatch[0].length;
      const candidate = buildWrittenOutEmailCandidate({
        match: writtenOutMatch,
        source: "raw_labeled",
        label,
        span: { start, end },
        confidence: "high",
        strongContext: true,
      });
      if (candidate.valid) {
        candidates.push(candidate);
        occupiedSpans.push({ start, end });
        continue;
      }
    }

    addLowConfidenceSpan(lowConfidenceSpans, {
      field: "customer.email",
      text: trimOuterPunctuation(window.slice(0, 80)),
      reason: "Email label was present, but no valid email address was found nearby.",
      confidence: "low",
    });
  }

  return candidates;
}

function scanUnlabeledEmailCandidates(text, occupiedSpans) {
  const candidates = [];

  for (const match of text.matchAll(EMAIL_VALUE_GLOBAL_PATTERN)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (occupiedSpans.some((span) => overlaps(span, { start, end }))) continue;
    const strongContext = hasStrongEmailContext(text, start, end);
    candidates.push(
      buildEmailCandidate({
        raw: match[0],
        source: "raw_unlabeled",
        label: "",
        span: { start, end },
        confidence: "medium",
        strongContext,
      }),
    );
    occupiedSpans.push({ start, end });
  }

  return candidates;
}

function scanWrittenOutEmailCandidates(text, occupiedSpans, lowConfidenceSpans) {
  const candidates = [];

  for (const match of text.matchAll(WRITTEN_OUT_EMAIL_PATTERN)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (occupiedSpans.some((span) => overlaps(span, { start, end }))) continue;

    const strongContext = hasStrongEmailContext(text, start, end);
    const candidate = buildWrittenOutEmailCandidate({
      match,
      source: "raw_written",
      label: "",
      span: { start, end },
      confidence: strongContext ? "high" : "medium",
      strongContext,
    });

    if (candidate.valid) {
      candidates.push(candidate);
      occupiedSpans.push({ start, end });
      continue;
    }

    addLowConfidenceSpan(lowConfidenceSpans, {
      field: "customer.email",
      text: trimOuterPunctuation(match[0]),
      reason: "Written-out email-like text was present, but it did not resolve to a valid email address.",
      confidence: "low",
    });
  }

  return candidates;
}

function scanEmailCueLowConfidence(text, occupiedSpans, lowConfidenceSpans) {
  for (const match of text.matchAll(EMAIL_CUE_PATTERN)) {
    const searchStart = (match.index ?? 0) + match[0].length;
    const windowEnd = Math.min(text.length, searchStart + 90);
    const window = text.slice(searchStart, windowEnd);
    const span = { start: match.index ?? 0, end: windowEnd };

    if (occupiedSpans.some((occupied) => overlaps(occupied, span))) continue;
    if (EMAIL_VALUE_PATTERN.test(window) || findWrittenOutEmailMatch(window)) continue;
    if (!/\bat\s+(?:home|the\s+house|the\s+address|the\s+gate|the\s+yard|my\s+house|our\s+house)\b/i.test(window)) continue;

    addLowConfidenceSpan(lowConfidenceSpans, {
      field: "customer.email",
      text: trimOuterPunctuation(text.slice(match.index ?? 0, windowEnd)),
      reason: "Email cue used 'at' wording, but no written-out email address was found nearby.",
      confidence: "low",
    });
  }
}

function scanLabelledPhoneCandidates(text, occupiedSpans, lowConfidenceSpans, numberTrace) {
  const candidates = [];

  for (const match of text.matchAll(PHONE_LABEL_PATTERN)) {
    const label = canonicalPhoneLabel(match[1]);
    const searchStart = match.index + match[0].length;
    const window = text.slice(searchStart, Math.min(text.length, searchStart + 120));
    const localMatch = window.match(PHONE_VALUE_PATTERN);

    if (localMatch) {
      const localIndex = window.search(PHONE_VALUE_PATTERN);
      const start = searchStart + localIndex;
      const end = start + localMatch[0].length;
      const candidate = buildPhoneCandidate({
        raw: text.slice(start, end),
        source: "raw_labeled",
        label,
        span: { start, end },
        confidence: "high",
      });
      candidates.push(candidate);
      occupiedSpans.push({ start, end });
      if (candidate.valid) {
        numberTrace.push({
          raw: candidate.raw,
          normalized: candidate.display,
          classification: "phone",
          field: candidate.field,
          reason: "Matched phone-number pattern.",
          context: contextAround(text, start, end),
        });
      }
      continue;
    }

    addLowConfidenceSpan(lowConfidenceSpans, {
      field: "customer.phone",
      text: trimOuterPunctuation(window.slice(0, 80)),
      reason: "Phone label was present, but no valid 10-digit US phone number was found nearby.",
      confidence: "low",
    });
  }

  return candidates;
}

function scanUnlabeledPhoneCandidates(text, occupiedSpans, numberTrace) {
  const candidates = [];

  for (const match of text.matchAll(PHONE_VALUE_GLOBAL_PATTERN)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (occupiedSpans.some((span) => overlaps(span, { start, end }))) continue;
    const candidate = buildPhoneCandidate({
      raw: match[0],
      source: "raw_unlabeled",
      label: "",
      span: { start, end },
      confidence: "medium",
    });
    candidates.push(candidate);
    occupiedSpans.push({ start, end });
    if (candidate.valid) {
      numberTrace.push({
        raw: candidate.raw,
        normalized: candidate.display,
        classification: "phone",
        field: candidate.field,
        reason: "Matched phone-number pattern.",
        context: contextAround(text, start, end),
      });
    }
  }

  return candidates;
}

function toIntakeEmailCandidate(intake) {
  if (!asString(intake.email)) return null;
  return buildEmailCandidate({
    raw: intake.email,
    source: "intake",
    label: "Customer email",
    span: null,
    confidence: "high",
    strongContext: true,
  });
}

function toIntakePhoneCandidate(intake) {
  if (!asString(intake.phone)) return null;
  return buildPhoneCandidate({
    raw: intake.phone,
    source: "intake",
    label: "Customer phone",
    span: null,
    confidence: "high",
  });
}

function intakeAddressCandidates(intake) {
  const value = asString(intake.address || intake.service_address || intake.serviceAddress);
  return value ? scanAddressCandidates(value, { source: "intake", includeSpans: false }) : [];
}

function fieldWarnings(field, candidates) {
  if (candidates.filter((candidate) => candidate.valid).length > 1) {
    return [`Multiple ${field} candidates found; using highest-priority candidate.`];
  }
  return [];
}

export function normalizeContactFields({ rawText = "", intake = {} } = {}) {
  const text = asString(rawText);
  const emailOccupiedSpans = [];
  const phoneOccupiedSpans = [];
  const emailLowConfidenceSpans = [];
  const phoneLowConfidenceSpans = [];
  const numberTrace = [];

  const intakeEmail = toIntakeEmailCandidate(intake);
  const intakePhone = toIntakePhoneCandidate(intake);

  const emailCandidates = [
    intakeEmail,
    ...scanLabelledEmailCandidates(text, emailOccupiedSpans, emailLowConfidenceSpans),
    ...scanWrittenOutEmailCandidates(text, emailOccupiedSpans, emailLowConfidenceSpans),
    ...scanUnlabeledEmailCandidates(text, emailOccupiedSpans),
  ].filter(Boolean);
  scanEmailCueLowConfidence(text, emailOccupiedSpans, emailLowConfidenceSpans);

  const phoneCandidates = [
    intakePhone,
    ...scanLabelledPhoneCandidates(text, phoneOccupiedSpans, phoneLowConfidenceSpans, numberTrace),
    ...scanUnlabeledPhoneCandidates(text, phoneOccupiedSpans, numberTrace),
  ].filter(Boolean);
  const addressCandidates = [
    ...intakeAddressCandidates(intake),
    ...scanAddressCandidates(text),
  ];

  const acceptedEmail = chooseAcceptedCandidate(emailCandidates);
  const acceptedPhone = chooseAcceptedCandidate(phoneCandidates);
  const acceptedAddress = chooseAcceptedAddressCandidate(addressCandidates);

  if (acceptedEmail && emailCandidates.filter((candidate) => candidate.valid).length > 1) {
    for (const candidate of emailCandidates) {
      if (candidate.valid && candidateKey(candidate) !== candidateKey(acceptedEmail)) {
        addLowConfidenceSpan(emailLowConfidenceSpans, {
          field: "customer.email",
          text: candidate.raw,
          reason: "Multiple valid email candidates found; using highest-priority candidate.",
          confidence: "low",
        });
      }
    }
  }

  if (acceptedPhone && phoneCandidates.filter((candidate) => candidate.valid).length > 1) {
    for (const candidate of phoneCandidates) {
      if (candidate.valid && candidateKey(candidate) !== candidateKey(acceptedPhone)) {
        addLowConfidenceSpan(phoneLowConfidenceSpans, {
          field: "customer.phone",
          text: candidate.raw,
          reason: "Multiple valid phone candidates found; using highest-priority candidate.",
          confidence: "low",
        });
      }
    }
  }

  return {
    email: {
      value: acceptedEmail?.value || "",
      candidates: finalizeCandidates(emailCandidates, acceptedEmail),
      warnings: fieldWarnings("email", emailCandidates),
    },
    phone: {
      value: acceptedPhone?.value || "",
      display: acceptedPhone?.display || "",
      candidates: finalizeCandidates(phoneCandidates, acceptedPhone),
      warnings: fieldWarnings("phone", phoneCandidates),
    },
    address: {
      value: acceptedAddress?.value || "",
      completeness: acceptedAddress?.completeness || "missing",
      town: acceptedAddress?.town || "",
      state_source: acceptedAddress?.state_source || "",
      candidates: finalizeCandidates(addressCandidates, acceptedAddress),
      warnings: addressWarnings(addressCandidates),
    },
    low_confidence_spans: [...emailLowConfidenceSpans, ...phoneLowConfidenceSpans],
    number_trace: numberTrace,
  };
}
