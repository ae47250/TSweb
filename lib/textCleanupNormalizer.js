const UNCERTAINTY_PATTERN =
  /\b(?:maybe|probably|i think|not sure|or|around|about|roughly|not included)\b|same price\?|separate\?|with stump\?/i;

const SPELLING_RULES = [
  { pattern: /\badress\b/g, replacement: "address", reason: "Corrected high-confidence address typo." },
  { pattern: /\baddrss\b/g, replacement: "address", reason: "Corrected high-confidence address typo." },
  { pattern: /\bremvoe\b/g, replacement: "remove", reason: "Corrected high-confidence remove typo." },
  { pattern: /\bremve\b/g, replacement: "remove", reason: "Corrected high-confidence remove typo." },
  { pattern: /\btriming\b/g, replacement: "trimming", reason: "Corrected high-confidence trimming typo." },
  { pattern: /\bstmping\b/g, replacement: "stumping", reason: "Corrected high-confidence stump typo." },
  { pattern: /\bstmp\b/g, replacement: "stump", reason: "Corrected high-confidence stump typo." },
  { pattern: /\bbrsh\b/g, replacement: "brush", reason: "Corrected high-confidence brush typo." },
  { pattern: /\bgaraje\b/g, replacement: "garage", reason: "Corrected high-confidence garage typo." },
];

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function preserveCase(before, after) {
  if (!before) return after;
  if (before === before.toUpperCase()) return after.toUpperCase();
  if (before[0] === before[0].toUpperCase()) return `${after[0].toUpperCase()}${after.slice(1)}`;
  return after;
}

function addChange(changes, { type, before, after, reason, spanStart, spanEnd }) {
  if (before === after) return;
  changes.push({
    type,
    before,
    after,
    reason,
    confidence: "high",
    ...(Number.isInteger(spanStart) ? { spanStart } : {}),
    ...(Number.isInteger(spanEnd) ? { spanEnd } : {}),
  });
}

function replaceWithTrace(text, pattern, type, reason, replacement) {
  const changes = [];
  const cleaned = text.replace(pattern, (...args) => {
    const before = args[0];
    const offset = args[args.length - 2];
    const after = typeof replacement === "function" ? replacement(...args) : replacement;
    addChange(changes, {
      type,
      before,
      after,
      reason,
      spanStart: offset,
      spanEnd: offset + before.length,
    });
    return after;
  });
  return { text: cleaned, changes };
}

function applyReplacement(state, pattern, type, reason, replacement) {
  const result = replaceWithTrace(state.text, pattern, type, reason, replacement);
  state.text = result.text;
  state.changes.push(...result.changes);
}

function applyWhitespaceCleanup(state) {
  applyReplacement(state, /\r\n?/g, "whitespace", "Normalized line endings.", "\n");
  applyReplacement(state, /^[ \t\n]+|[ \t\n]+$/g, "whitespace", "Trimmed leading or trailing whitespace.", "");
  applyReplacement(state, /^[ \t]+|[ \t]+$/gm, "whitespace", "Trimmed whitespace at line edges.", "");
  applyReplacement(state, /[ \t]{2,}/g, "whitespace", "Collapsed repeated spaces.", " ");
  applyReplacement(state, /\n{3,}/g, "whitespace", "Reduced excessive blank lines while preserving paragraph breaks.", "\n\n");
}

function applyPunctuationCleanup(state) {
  applyReplacement(
    state,
    /([,;:!])\1+/g,
    "punctuation",
    "Collapsed repeated punctuation.",
    (match, mark) => mark,
  );

  applyReplacement(
    state,
    /([A-Za-z0-9)\]])([,;:])(?=\S)/g,
    "punctuation",
    "Added obvious spacing after punctuation.",
    (match, before, mark, offset, source) => {
      const next = source[offset + match.length] || "";
      if ((mark === ":" || mark === ",") && /\d/.test(before) && /\d/.test(next)) return match;
      return `${before}${mark} `;
    },
  );
}

function applySpellingCleanup(state) {
  for (const rule of SPELLING_RULES) {
    applyReplacement(state, rule.pattern, "spelling", rule.reason, (match) => preserveCase(match, rule.replacement));
  }

  applyReplacement(
    state,
    /\b((?:stumps?|roots?)\s+)grnd\b/gi,
    "spelling",
    "Corrected grnd to grind only in clear tree-service context.",
    (match, prefix) => `${prefix}${preserveCase("grnd", "grind")}`,
  );
  applyReplacement(
    state,
    /\bgrnd(\s+(?:stumps?|roots?))\b/gi,
    "spelling",
    "Corrected grnd to grind only in clear tree-service context.",
    (match, suffix) => `${preserveCase("grnd", "grind")}${suffix}`,
  );
}

function applyTreeServiceCleanup(state) {
  applyReplacement(
    state,
    /\bstump\s+grind\b/gi,
    "tree_service_term",
    "Expanded stump grind to the common readable phrase stump grinding.",
    (match) => preserveCase(match, "stump grinding"),
  );
}

function applyPriceCleanup(state) {
  applyReplacement(
    state,
    /\bdollar\s+sign\s+(\d[\d,]*(?:\.\d{2})?)\b/gi,
    "dictation_cleanup",
    "Converted dictated dollar-sign wording to readable symbol form.",
    (match, amount) => `$${amount}`,
  );
  applyReplacement(
    state,
    /\$\s+(\d[\d,]*(?:\.\d{2})?)\b/g,
    "price_format",
    "Removed extra space after dollar sign.",
    (match, amount) => `$${amount}`,
  );
  applyReplacement(
    state,
    /\b(\d[\d,]*(?:\.\d{2})?)[ \t]*\$/g,
    "price_format",
    "Moved trailing dollar sign before the number.",
    (match, amount) => `$${amount}`,
  );
  applyReplacement(
    state,
    /\b(\d{1,2}),\s+(\d{3})\b/g,
    "price_format",
    "Removed stray space inside comma-formatted number.",
    (match, thousands, rest, offset, source) => {
      const before = source.slice(Math.max(0, offset - 24), offset);
      const after = source.slice(offset + match.length, offset + match.length + 16);
      const hasPriceContext = /\b(?:price|quote|quoted|bid|cost|total)\s*$/i.test(before) || /\$\s*$/i.test(before);
      const hasNonPriceContext =
        /\b(?:option|opt|route|rt|hwy|highway|road|rd)\s*$/i.test(before) ||
        /^\s*(?:feet|ft|trees?|stumps?|options?|opts?)\b/i.test(after);
      if (!hasPriceContext || hasNonPriceContext) return match;
      return `${thousands},${rest}`;
    },
  );
}

function applyContactCleanup(state) {
  applyReplacement(
    state,
    /\b([A-Z0-9._%+-]+)\s*@\s*([A-Z0-9.-]+)\s*\.\s*([A-Z]{2,})\b/gi,
    "contact_format",
    "Normalized obvious spaced email formatting.",
    (match, local, domain, tld) => {
      if (/^(?:at|in|on|by|to)$/i.test(tld)) return match;
      return `${local}@${domain}.${tld}`.toLowerCase();
    },
  );
  applyReplacement(
    state,
    /\b([A-Z0-9._%+-]+)\s+at\s+([A-Z0-9.-]+)\s+dot\s+([A-Z]{2,})\b/gi,
    "dictation_cleanup",
    "Normalized clearly dictated email formatting.",
    (match, local, domain, tld) => {
      if (/^(?:at|in|on|by|to)$/i.test(tld)) return match;
      return `${local}@${domain}.${tld}`.toLowerCase();
    },
  );
  applyReplacement(
    state,
    /\((\d{3})\)\s*(\d{3})[-.\s]?(\d{4})\b/g,
    "contact_format",
    "Normalized obvious phone readability.",
    (match, area, prefix, line) => `${area}-${prefix}-${line}`,
  );
  applyReplacement(
    state,
    /(?<![$\d])(?:\+?1[-.\s]+)?(\d{3})[-.\s]+(\d{3})[-.\s]+(\d{4})(?![\d%])/g,
    "contact_format",
    "Normalized obvious phone readability.",
    (match, area, prefix, line, offset, source) => {
      const before = source.slice(Math.max(0, offset - 24), offset);
      if (!/\b(?:phone|call|text|cell|mobile|call\/text)\b[\s:#-]*$/i.test(before)) return match;
      return `${area}-${prefix}-${line}`;
    },
  );
}

function addWarnings(rawInput, warnings) {
  if (UNCERTAINTY_PATTERN.test(rawInput)) warnings.add("ambiguous_text_left_unchanged");
  if (/\d/.test(rawInput)) warnings.add("numbers_present_preserved");
}

function compactSpaces(value) {
  return asString(value).replace(/\s+/g, " ").trim();
}

function titleCaseWords(value) {
  return compactSpaces(value)
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function addRewriteTrace(trace, { field, type, before, after, reason, source = "raw_input" }) {
  if (!before || !after || before === after) return;
  trace.push({ field, type, before, after, reason, source });
}

function repairEmailText(text, trace, source = "raw_input") {
  return asString(text).replace(
    /\b([A-Z0-9_%+-]+(?:\s*\.\s*[A-Z0-9_%+-]+)*)\s*@\s*([A-Z0-9-]+(?:\s*\.\s*[A-Z0-9-]+)+)\b/gi,
    (match, local, domain) => {
      const repaired = `${local.replace(/\s*\.\s*/g, ".")}@${domain.replace(/\s*\.\s*/g, ".")}`.toLowerCase();
      addRewriteTrace(trace, {
        field: "email",
        type: "contact_repair",
        before: match,
        after: repaired,
        reason: "Repaired spaced email punctuation.",
        source,
      });
      return repaired;
    },
  );
}

function repairPhoneText(text, trace, source = "raw_input") {
  return asString(text).replace(
    /(?<![$\d])(?:\+?1[\s./-]+)?\(?(\d{3})\)?[\s./-]+(\d{3})[\s./-]+(\d{4})(?![\d%])/g,
    (match, area, prefix, line) => {
      const repaired = `${area}-${prefix}-${line}`;
      addRewriteTrace(trace, {
        field: "phone",
        type: "contact_repair",
        before: match,
        after: repaired,
        reason: "Repaired phone number punctuation.",
        source,
      });
      return repaired;
    },
  );
}

function repairGluedStreetStarts(text, trace, source = "raw_input") {
  return asString(text).replace(
    /\b(\d{2,5})(?=(?:[A-Z][a-z]+|Highway|Hwy|Route|State|County)\b)/g,
    (match, number) => {
      addRewriteTrace(trace, {
        field: "service_address",
        type: "address_repair",
        before: match,
        after: `${number} `,
        reason: "Inserted missing space between house number and street name.",
        source,
      });
      return `${number} `;
    },
  );
}

function normalizeMoney(value) {
  const digits = asString(value).replace(/[^\d]/g, "");
  if (!digits) return "";
  return `$${Number(digits).toLocaleString("en-US")}`;
}

function cleanupExtractedValue(value) {
  return compactSpaces(value)
    .replace(/^[\s:;.,=\-]+/g, "")
    .replace(/[\s;.,]+$/g, "")
    .trim();
}

function stripNameNoise(value) {
  let text = cleanupExtractedValue(value)
    .replace(/\b(?:ph|fone|phone|call|reach|text|number|eml|email|email-ish|quote|send|addr|adrs|loc|service|addy|work|job)\b.*$/i, "")
    .replace(/[<>()]/g, " ");
  let previous = "";
  while (previous !== text) {
    previous = text;
    text = text.replace(/^(?:cust(?:omer)?|homeowner|contact|name|line|says?|maybe|ish|label|labels?|no\s+labels?|eml-ish|adrs)\s+/i, "");
  }
  const words = compactSpaces(text).split(/\s+/).filter(Boolean);
  return words.length >= 2 ? titleCaseWords(words.slice(0, 3).join(" ")) : "";
}

function firstMatchValue(text, patterns) {
  for (const pattern of patterns) {
    const match = asString(text).match(pattern);
    const value = match?.[1] || match?.[0] || "";
    if (value) return cleanupExtractedValue(value);
  }
  return "";
}

function extractCustomerName(text) {
  const patterns = [
    /\b(?:name\s+line\s+says|customer\s+name\s+maybe|customer|cust|homeowner|contact)\s*(?:is|=|:)?\s*([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})/i,
    /\bno\s+labels?\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,2})/i,
    /\blabel\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,2})/i,
    /\bish\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,2})/i,
    /\bvoice\s+note\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,2})\s+says?\b/i,
    /^\s*([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,2})\s*(?:\/|,|;|\bphone\b|\bcall\b)/i,
  ];
  return stripNameNoise(firstMatchValue(text, patterns));
}

function extractEmail(text) {
  return firstMatchValue(text, [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i]).toLowerCase();
}

function extractPhone(text) {
  return firstMatchValue(text, [/\b\d{3}-\d{3}-\d{4}\b/]);
}

function extractServiceAddress(text) {
  const cuePattern =
    /\b(?:service\s+address|svc\s+addr|service\s+addy|adrs|addr|loc|work\s+at|job\s+location)\b\s*(?:there\s+at|is|=|:|-)?\s*(?:not\s+price\s*)?(.{3,120}?)(?=\s+(?:remove|take|trim|stump|option|customer|homeowner|phone|ph|fone|call|reach|text|number|email|eml|quote|send|maybe|not\s+sure|probably|roughly|about|around|unclear)\b|[.;]|$)/i;
  const cued = asString(text).match(cuePattern)?.[1] || "";
  const fallback = asString(text).match(
    /\b(\d{2,5}\s+(?:[A-Za-z0-9.]+\s+){0,5}(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Court|Ct|Way|Pike|Trail|Trl|Highway|Hwy|Route|Terrace|Parkway)\b(?:\s+[A-Za-z][A-Za-z.'-]+){0,3}\s+(?:Indiana|IN))\b/i,
  )?.[1] || "";
  const rawAddress = cued || fallback;
  return cleanupExtractedValue(rawAddress)
    .replace(/^\$[\d,]+\s+/g, "")
    .replace(/^(?:there\s+at|at)\s+/i, "");
}

function extractOptions(text, trace) {
  const options = [];
  const source = asString(text);
  const optionPattern = /\boption\s*([A-E])\s*[:.)-]?\s*(.*?)(?=\boption\s*[A-E]\b|$)/gi;
  let match;
  while ((match = optionPattern.exec(source))) {
    const label = match[1].toUpperCase();
    const body = cleanupExtractedValue(match[2]);
    const bodyBeforeAddress = body.replace(/\b(?:service\s+address|svc\s+addr|service\s+addy|adrs|addr|loc|work\s+at|job\s+location)\b.*$/i, "");
    const priceMatch = [...bodyBeforeAddress.matchAll(/\$\s*\d[\d,]*(?:\.\d{2})?|\b\d{3,6}\b/g)].pop();
    const price = priceMatch ? normalizeMoney(priceMatch[0]) : "";
    const description = cleanupExtractedValue(
      bodyBeforeAddress
        .replace(/\$\s*\d[\d,]*(?:\.\d{2})?/g, " ")
        .replace(/\b\d{3,6}\b/g, " "),
    );
    if (!description && !price) continue;
    const option = { label: `Option ${label}`, description, price, evidence: cleanupExtractedValue(match[0]) };
    if (options.some((existing) => existing.label === option.label && existing.description === option.description && existing.price === option.price)) {
      continue;
    }
    options.push(option);
    addRewriteTrace(trace, {
      field: `option_${label.toLowerCase()}`,
      type: "option_segmentation",
      before: cleanupExtractedValue(match[0]),
      after: `${description}${price ? ` - ${price}` : ""}`,
      reason: "Split option clause into its own coherent note line.",
    });
  }
  return options;
}

function extractWorkRequested(text) {
  const beforeOptions = asString(text).split(/\boption\s*A\b/i)[0] || text;
  const match = beforeOptions.match(/\b((?:remove|trim|take\s+down|drop|cut|stump\s+grind(?:ing)?|grind)\b.{0,120})/i);
  if (!match) return "";
  return cleanupExtractedValue(match[1])
    .replace(/\b(?:customer|cust|homeowner|contact|name|phone|ph|fone|email|eml|addr|adrs|loc|service\s+address)\b.*$/i, "")
    .replace(/\s+\$?\d[\d,]*(?:\.\d{2})?\s*$/g, "");
}

function collectOtherNotes(text) {
  const notes = [];
  const patterns = [
    /\b(?:maybe|not\s+sure|probably|roughly|about|around|unclear)[^.;\n]*/gi,
    /\b(?:ignore\s+old\s+price|old\s+price|wrong\s+labels?)[^.;\n]*/gi,
    /\b(?:gate(?:\s+code|\s+by|\s+near|\s+at)?|dog|text\s+is\s+best|service\s+drop|power\s*line|repeated\s+note)[^.;\n]*/gi,
  ];
  for (const pattern of patterns) {
    for (const match of asString(text).matchAll(pattern)) {
      const note = cleanupExtractedValue(match[0]);
      if (note && !notes.includes(note)) notes.push(note);
    }
  }
  return notes;
}

function acceptedContactCandidate(fieldResult = {}) {
  const candidates = Array.isArray(fieldResult.candidates) ? fieldResult.candidates : [];
  return candidates.find((candidate) => candidate.accepted) || null;
}

function contactPhoneDisplay(contactNormalizationResult = {}) {
  const candidate = acceptedContactCandidate(contactNormalizationResult.phone);
  return asString(contactNormalizationResult.phone?.display || candidate?.display);
}

function contactEmailValue(contactNormalizationResult = {}) {
  const candidate = acceptedContactCandidate(contactNormalizationResult.email);
  return asString(contactNormalizationResult.email?.value || candidate?.value).toLowerCase();
}

function contactAddressEvidence(contactNormalizationResult = {}) {
  const candidate = acceptedContactCandidate(contactNormalizationResult.address);
  return {
    value: asString(contactNormalizationResult.address?.value || candidate?.value),
    completeness: asString(contactNormalizationResult.address?.completeness || candidate?.completeness),
    town: asString(contactNormalizationResult.address?.town || candidate?.town),
    state_source: asString(contactNormalizationResult.address?.state_source || candidate?.state_source),
  };
}

function lowConfidenceFieldText(contactNormalizationResult = {}, field) {
  const spans = Array.isArray(contactNormalizationResult.low_confidence_spans)
    ? contactNormalizationResult.low_confidence_spans
    : [];
  const span = spans.find((item) => item.field === field && item.text);
  if (!span) return "";
  return cleanupExtractedValue(span.text)
    .split(/\.\s*(?:one|two|three|four|five|option|opt|opts|optons?)\b/i)[0]
    .replace(/\s+\b(?:option|opt|opts|optons?)\b.*$/i, "")
    .slice(0, 140)
    .trim();
}

function optionPriceClues(optionPriceCandidateView = {}) {
  return optionPriceCandidateView?.pre_ai_option_price_candidate_clues || {};
}

function sidecarOptionsFromPairings(clues = {}) {
  const pairings = Array.isArray(clues.option_price_pairings) ? clues.option_price_pairings : [];
  return pairings
    .filter((pairing) => pairing.description_raw || pairing.price_display)
    .map((pairing) => ({
      label: pairing.label || "",
      raw_label: pairing.raw_label || "",
      raw_label_token: pairing.raw_label_token || "",
      description: normalizeCoherentPhrase(pairing.description_raw || ""),
      price: pairing.price_display || "",
      price_status: pairing.price_status || "",
      review_warning: Boolean(pairing.review_warning),
      evidence: cleanupExtractedValue(pairing.context || pairing.description_raw || ""),
      source: "option_price_sidecar",
      confidence: pairing.confidence || "",
      price_id: pairing.price_id || "",
      amount_confidence: pairing.amount_confidence || "",
      pairing_confidence: pairing.pairing_confidence || "",
      span: pairing.span || null,
    }))
    .filter((option) => option.label && (option.description || option.price));
}

function normalizeCoherentPhrase(value) {
  const text = cleanupExtractedValue(value)
    .replace(/\bremuved\b/gi, "removed")
    .replace(/\bhawl\b/gi, "haul")
    .replace(/\bcleen\b/gi, "clean")
    .replace(/\bstmp\b/gi, "stump")
    .replace(/\bgaraje\b/gi, "garage")
    .replace(/\s+/g, " ");
  return text;
}

function capitalizeSentence(value) {
  const text = cleanupExtractedValue(value);
  if (!text) return "";
  return `${text[0].toUpperCase()}${text.slice(1)}`;
}

function treePhraseWithCount(value) {
  const phrase = cleanupExtractedValue(value);
  if (!phrase) return "";
  if (/^(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)/i.test(phrase)) return phrase;
  if (/\b(?:tree|trees|oak|maple|pine|cedar|ash|walnut|elm|hickory|sycamore|poplar)\b/i.test(phrase)) {
    return `one ${phrase}`;
  }
  return phrase;
}

function normalizeWorkRequested(value) {
  const text = normalizeCoherentPhrase(value).replace(/^need\s+/i, "");
  const removed = text.match(/^(.+?)\s+removed$/i);
  if (removed) return `Remove ${treePhraseWithCount(removed[1])}`;
  const removal = text.match(/^(.+?)\s+removal$/i);
  if (removal) return `Remove ${treePhraseWithCount(removal[1])}`;
  return capitalizeSentence(text);
}

function workRequestedBeforeOptions(rawInput, options, fallback) {
  const firstOptionStart = options
    .map((option) => option.span?.start)
    .filter((value) => Number.isInteger(value))
    .sort((left, right) => left - right)[0];
  const source = Number.isInteger(firstOptionStart)
    ? asString(rawInput).slice(0, firstOptionStart)
    : asString(rawInput);
  const beforeContact = source.split(
    /\b(?:cust(?:omer)?|homeowner|contact|name|phone|ph|fone|call|reach|text|number|email|eml|quote|send|addr|adrs|loc|service\s+address)\b/i,
  )[0];
  const needMatch = beforeContact.match(/\b(?:need|needs?|wants?|want)\s+(.+?)(?=\s+\b(?:at|addr|adrs|loc|service|work|job)\b|[,.;]|$)/i);
  const workCueMatch = beforeContact.match(/\b((?:remove|removed|remuved|trim|take\s+down|drop|cut|stump\s+grind(?:ing)?|grind)\b.{0,100})/i);
  const rawWork = needMatch?.[1] || workCueMatch?.[1] || fallback || "";
  return normalizeWorkRequested(rawWork);
}

function customerWithAlias(rawInput, primaryCustomer) {
  const primary = cleanupExtractedValue(primaryCustomer);
  if (!primary) return "";
  const text = asString(rawInput);
  const nameToken = "(?:[A-Z][A-Za-z.'-]+|[A-Z]\\.?)";
  const aliasMatch = text.match(new RegExp(`\\b(?:cust(?:omer)?\\s+name\\s+)?maybe\\s+(${nameToken}(?:\\s+${nameToken}){1,2})\\s+or\\s+(${nameToken}(?:\\s+${nameToken}){0,2})`, "i"));
  if (!aliasMatch) return primary;
  const first = titleCaseWords(aliasMatch[1]);
  const second = titleCaseWords(aliasMatch[2]);
  if (!second || second === first || primary !== first) return primary;
  return `${primary}, also referred to as ${second}.`;
}

function filterOtherNotes(notes, { phone = "", email = "", serviceAddress = "", incompleteEmail = "" } = {}) {
  return notes
    .map((note) => cleanupExtractedValue(note))
    .filter(Boolean)
    .filter((note) => !phone || !note.includes(phone))
    .filter((note) => !email || !note.toLowerCase().includes(email.toLowerCase()))
    .filter((note) => !serviceAddress || !note.toLowerCase().includes(serviceAddress.toLowerCase()))
    .filter((note) => !incompleteEmail || !incompleteEmail.toLowerCase().includes(note.toLowerCase()))
    .filter((note) => !/\b(?:cust(?:omer)?|phone|email|eml|addr|adrs)\b/i.test(note))
    .filter((note, index, items) => items.indexOf(note) === index);
}

function buildCoherentNoteLine(label, value) {
  return `${label}: ${value || ""}`;
}

export function coherentNoteNormalizer(rawInput = "", literalCleanedText = "") {
  const raw = asString(rawInput);
  const literal = asString(literalCleanedText) || raw;
  const rewriteTrace = [];
  let working = repairEmailText(raw, rewriteTrace);
  working = repairPhoneText(working, rewriteTrace);
  working = repairGluedStreetStarts(working, rewriteTrace);

  const literalEvidenceText = repairGluedStreetStarts(
    repairPhoneText(repairEmailText(literal, rewriteTrace, "literal_cleaned_text"), rewriteTrace, "literal_cleaned_text"),
    rewriteTrace,
    "literal_cleaned_text",
  );
  const evidenceSource = `${working}\n${literalEvidenceText}`;
  const customer = extractCustomerName(evidenceSource);
  const phone = extractPhone(evidenceSource);
  const email = extractEmail(evidenceSource);
  const serviceAddress = extractServiceAddress(evidenceSource);
  const workRequested = extractWorkRequested(evidenceSource);
  const options = extractOptions(evidenceSource, rewriteTrace);
  const otherNotes = collectOtherNotes(evidenceSource);

  const evidence = {
    customer: { value: customer, source: customer ? "detected_from_note" : "missing" },
    phone: { value: phone, source: phone ? "detected_from_note" : "missing" },
    email: { value: email, source: email ? "detected_from_note" : "missing" },
    service_address: { value: serviceAddress, source: serviceAddress ? "detected_from_note" : "missing" },
    work_requested: { value: workRequested, source: workRequested ? "detected_from_note" : "missing" },
    options,
    other_notes: otherNotes,
  };

  const lines = [
    buildCoherentNoteLine("Customer", customer),
    buildCoherentNoteLine("Phone", phone),
    buildCoherentNoteLine("Email", email),
    buildCoherentNoteLine("Service address", serviceAddress),
    buildCoherentNoteLine("Work requested", workRequested),
    ...options.map((option) => `${option.label}: ${option.description}${option.price ? ` — ${option.price}` : ""}`),
    buildCoherentNoteLine("Other notes", otherNotes.join("; ")),
  ];

  return {
    coherentNote: lines.join("\n"),
    evidence,
    rewriteTrace,
  };
}

export function buildEvidenceBackedCoherentNote({
  rawInput = "",
  literalCleanedText = "",
  contactNormalizationResult = null,
  optionPriceCandidateView = null,
} = {}) {
  const raw = asString(rawInput);
  const literal = asString(literalCleanedText) || raw;
  const fallback = coherentNoteNormalizer(raw, literal);
  const rewriteTrace = [...(fallback.rewriteTrace || [])];
  const clues = optionPriceClues(optionPriceCandidateView);

  const fallbackEvidence = fallback.evidence || {};
  const sidecarPhone = contactPhoneDisplay(contactNormalizationResult);
  const sidecarEmail = contactEmailValue(contactNormalizationResult);
  const sidecarAddressEvidence = contactAddressEvidence(contactNormalizationResult);
  const sidecarAddress = sidecarAddressEvidence.value;
  const incompleteEmail = !sidecarEmail
    ? lowConfidenceFieldText(contactNormalizationResult, "customer.email")
    : "";
  const sidecarOptions = sidecarOptionsFromPairings(clues);

  const customer = customerWithAlias(raw, fallbackEvidence.customer?.value || "");
  const phone = sidecarPhone || fallbackEvidence.phone?.value || "";
  const email = sidecarEmail || fallbackEvidence.email?.value || "";
  const emailLine = email || (incompleteEmail ? `missing or incomplete; note says "${incompleteEmail}"` : "");
  const serviceAddress = sidecarAddress || fallbackEvidence.service_address?.value || "";
  const options = sidecarOptions.length ? sidecarOptions : fallbackEvidence.options || [];
  const workRequested = workRequestedBeforeOptions(raw, options, fallbackEvidence.work_requested?.value || "");
  const otherNotes = filterOtherNotes(collectOtherNotes(`${raw}\n${literal}`), {
    phone,
    email,
    serviceAddress,
    incompleteEmail,
  });

  if (sidecarPhone && sidecarPhone !== fallbackEvidence.phone?.value) {
    addRewriteTrace(rewriteTrace, {
      field: "phone",
      type: "sidecar_contact_evidence",
      before: fallbackEvidence.phone?.value || "missing",
      after: sidecarPhone,
      reason: "Used accepted phone candidate from contact normalizer metadata.",
      source: "contact_normalizer",
    });
  }
  if (sidecarEmail && sidecarEmail !== fallbackEvidence.email?.value) {
    addRewriteTrace(rewriteTrace, {
      field: "email",
      type: "sidecar_contact_evidence",
      before: fallbackEvidence.email?.value || "missing",
      after: sidecarEmail,
      reason: "Used accepted email candidate from contact normalizer metadata.",
      source: "contact_normalizer",
    });
  }
  if (!sidecarEmail && incompleteEmail) {
    addRewriteTrace(rewriteTrace, {
      field: "email",
      type: "sidecar_contact_warning",
      before: incompleteEmail,
      after: emailLine,
      reason: "Preserved incomplete email cue as uncertainty instead of inventing an address.",
      source: "contact_normalizer",
    });
  }
  if (sidecarAddress && sidecarAddress !== fallbackEvidence.service_address?.value) {
    addRewriteTrace(rewriteTrace, {
      field: "service_address",
      type: "sidecar_contact_evidence",
      before: fallbackEvidence.service_address?.value || "missing",
      after: sidecarAddress,
      reason: "Used accepted service-address candidate from contact normalizer metadata.",
      source: "contact_normalizer",
    });
  }
  if (sidecarOptions.length) {
    for (const option of sidecarOptions) {
      addRewriteTrace(rewriteTrace, {
        field: option.label.toLowerCase().replace(/\s+/g, "_"),
        type: "sidecar_option_price_pairing",
        before: option.evidence || option.description || option.price,
        after: `${option.description}${option.price ? ` - ${option.price}` : ""}`,
        reason: "Built option line from option-price pairing sidecar evidence.",
        source: "option_price_normalizer",
      });
    }
  }

  const evidence = {
    customer: {
      value: customer,
      source: customer ? "raw_input_name_evidence" : "missing",
      fallback_value: fallbackEvidence.customer?.value || "",
    },
    phone: {
      value: phone,
      source: sidecarPhone ? "contact_normalizer" : fallbackEvidence.phone?.source || "missing",
    },
    email: {
      value: email,
      display: emailLine,
      source: sidecarEmail
        ? "contact_normalizer"
        : incompleteEmail
          ? "contact_normalizer_low_confidence"
          : fallbackEvidence.email?.source || "missing",
    },
    service_address: {
      value: serviceAddress,
      source: sidecarAddress && serviceAddress === sidecarAddress
        ? "contact_normalizer"
        : fallbackEvidence.service_address?.source || "missing",
      completeness: sidecarAddressEvidence.completeness || "",
      town: sidecarAddressEvidence.town || "",
      state_source: sidecarAddressEvidence.state_source || "",
    },
    work_requested: {
      value: workRequested,
      source: workRequested ? "raw_input_before_options" : "missing",
    },
    options,
    other_notes: otherNotes,
    sidecar_summary: {
      accepted_phone: sidecarPhone,
      accepted_email: sidecarEmail,
      accepted_address: sidecarAddress,
      address_completeness: sidecarAddressEvidence.completeness,
      address_state_source: sidecarAddressEvidence.state_source,
      incomplete_email_evidence: incompleteEmail,
      excluded_number_count: Array.isArray(clues.excluded_numbers) ? clues.excluded_numbers.length : 0,
      option_price_pairing_count: sidecarOptions.length,
      price_warning_count: Array.isArray(clues.price_scope_ambiguity_warnings)
        ? clues.price_scope_ambiguity_warnings.length
        : 0,
    },
  };

  const lines = [
    buildCoherentNoteLine("Customer", customer),
    buildCoherentNoteLine("Phone", phone),
    buildCoherentNoteLine("Email", emailLine),
    buildCoherentNoteLine("Service address", serviceAddress),
    buildCoherentNoteLine("Work requested", workRequested),
    ...options.map((option) => `${option.label}: ${option.description}${option.price ? ` — ${option.price}` : ""}`),
    buildCoherentNoteLine("Other notes", otherNotes.join("; ")),
  ];

  return {
    coherentNote: lines.join("\n"),
    evidence,
    rewriteTrace,
  };
}

export function buildEvidenceBackedTextCleanupResult({
  textCleanupResult = {},
  contactNormalizationResult = null,
  optionPriceCandidateView = null,
} = {}) {
  const textCleanup = textCleanupResult || {};
  if (textCleanup.coherentNoteSource === "raw_input_plus_evidence_sidecars") return textCleanup;
  if (!contactNormalizationResult && !optionPriceCandidateView) return textCleanup;

  const coherent = buildEvidenceBackedCoherentNote({
    rawInput: textCleanup.rawInput,
    literalCleanedText: textCleanup.cleanedText,
    contactNormalizationResult,
    optionPriceCandidateView,
  });

  return {
    ...textCleanup,
    coherentNote: coherent.coherentNote,
    evidence: coherent.evidence,
    rewriteTrace: coherent.rewriteTrace,
    coherentNoteSource: "raw_input_plus_evidence_sidecars",
  };
}

export function textCleanupNormalizer(rawInput = "") {
  const raw = asString(rawInput);
  const state = {
    text: raw,
    changes: [],
  };
  const warnings = new Set();

  applyWhitespaceCleanup(state);
  applyContactCleanup(state);
  applyPriceCleanup(state);
  applyPunctuationCleanup(state);
  applySpellingCleanup(state);
  applyTreeServiceCleanup(state);
  addWarnings(raw, warnings);
  const coherent = coherentNoteNormalizer(raw, state.text);

  return {
    rawInput: raw,
    cleanedText: state.text,
    coherentNote: coherent.coherentNote,
    evidence: coherent.evidence,
    rewriteTrace: coherent.rewriteTrace,
    changes: state.changes,
    warnings: [...warnings],
  };
}

export function buildTextCleanupParserInput(cleanupResult = {}) {
  return buildPreNormalizerParserInput({ textCleanupResult: cleanupResult });
}

function compactOptionPriceForParser(optionPriceCandidateView = {}) {
  const clues = optionPriceCandidateView?.pre_ai_option_price_candidate_clues || {};
  const money = Array.isArray(clues.money_like_numbers) ? clues.money_like_numbers : [];
  const boundaries = Array.isArray(clues.option_boundary_clues) ? clues.option_boundary_clues : [];
  const pairings = Array.isArray(clues.option_price_pairings) ? clues.option_price_pairings : [];
  const excluded = Array.isArray(clues.excluded_numbers) ? clues.excluded_numbers : [];
  const warnings = Array.isArray(clues.price_scope_ambiguity_warnings) ? clues.price_scope_ambiguity_warnings : [];
  return {
    money_like_numbers: money.map((item) => ({
      price_id: item.price_id,
      raw: item.raw,
      normalized: item.price_display || item.normalized_money_like || "",
      confidence: item.confidence,
      amount_confidence: item.amount_confidence,
      reason: item.reason,
    })),
    option_boundary_clues: boundaries.map((item) => ({
      raw: item.raw,
      kind: item.kind,
      token: item.token,
    })),
    option_price_pairings: pairings.map((item) => ({
      price_id: item.price_id,
      label: item.label,
      raw_label: item.raw_label,
      raw_label_token: item.raw_label_token,
      description: item.description_raw,
      price: item.price_display,
      price_status: item.price_status,
      review_warning: Boolean(item.review_warning),
      confidence: item.confidence,
      amount_confidence: item.amount_confidence,
      pairing_confidence: item.pairing_confidence,
    })),
    excluded_number_count: excluded.length,
    warning_count: warnings.length,
    low_confidence_count: Array.isArray(clues.low_confidence_spans) ? clues.low_confidence_spans.length : 0,
  };
}

function compactContactCandidate(candidate = {}) {
  return {
    value: candidate.display || candidate.value || "",
    raw: candidate.raw || "",
    source: candidate.source || "",
    label: candidate.label || "",
    span: candidate.span || null,
    confidence: candidate.confidence || "",
    completeness: candidate.completeness || "",
    town: candidate.town || "",
    state_source: candidate.state_source || "",
    accepted: Boolean(candidate.accepted),
    rejected_reason: candidate.rejected_reason || "",
  };
}

function compactContactForParser(contactNormalizationResult = {}) {
  const email = contactNormalizationResult?.email || {};
  const phone = contactNormalizationResult?.phone || {};
  const address = contactNormalizationResult?.address || {};
  const emailCandidates = Array.isArray(email.candidates) ? email.candidates : [];
  const phoneCandidates = Array.isArray(phone.candidates) ? phone.candidates : [];
  const addressCandidates = Array.isArray(address.candidates) ? address.candidates : [];
  return {
    accepted_email: email.value || "",
    accepted_phone: phone.display || "",
    accepted_address: address.value || "",
    address_completeness: address.completeness || "",
    address_town: address.town || "",
    address_state_source: address.state_source || "",
    email_candidates: emailCandidates.map(compactContactCandidate),
    phone_candidates: phoneCandidates.map(compactContactCandidate),
    address_candidates: addressCandidates.map(compactContactCandidate),
    email_warnings: Array.isArray(email.warnings) ? email.warnings : [],
    phone_warnings: Array.isArray(phone.warnings) ? phone.warnings : [],
    address_warnings: Array.isArray(address.warnings) ? address.warnings : [],
    low_confidence_spans: Array.isArray(contactNormalizationResult.low_confidence_spans)
      ? contactNormalizationResult.low_confidence_spans
      : [],
    number_trace: Array.isArray(contactNormalizationResult.number_trace)
      ? contactNormalizationResult.number_trace
      : [],
  };
}

export function buildPreNormalizerParserInput({
  textCleanupResult = {},
  contactNormalizationResult = null,
  optionPriceCandidateView = null,
} = {}) {
  const textCleanup = buildEvidenceBackedTextCleanupResult({
    textCleanupResult,
    contactNormalizationResult,
    optionPriceCandidateView,
  }) || {};
  const raw = asString(textCleanup.rawInput);
  const cleaned = asString(textCleanup.cleanedText) || raw;

  if (!raw) return raw;
  if (cleaned === raw && !contactNormalizationResult && !optionPriceCandidateView) return raw;

  const sections = [
    "Original raw TD1 notes (source of truth; preserve this exactly in raw_input.customer_text):",
    raw,
    "",
    "Literal cleaned text from conservative cleanup (reading aid only; do not treat it as new facts):",
    cleaned,
    "If cleaned text conflicts with raw TD1 notes, raw TD1 notes win.",
  ];

  if (textCleanup.coherentNote) {
    sections.push(
      "",
      "Coherent note from deterministic pre-AI rewrite (business-prose aid only; do not use it as authoritative contact, address, name-order, option-label, or price data when structured evidence exists):",
      textCleanup.coherentNote,
    );
  }

  if (textCleanup.evidence) {
    sections.push(
      "",
      "Pre-AI evidence JSON from raw and literal-cleaned text:",
      JSON.stringify(textCleanup.evidence, null, 2),
    );
  }

  if (Array.isArray(textCleanup.rewriteTrace) && textCleanup.rewriteTrace.length) {
    sections.push(
      "",
      "Pre-AI rewrite_trace for coherent note:",
      JSON.stringify(textCleanup.rewriteTrace, null, 2),
    );
  }

  if (contactNormalizationResult) {
    sections.push(
      "",
      "Pre-AI contact normalizer metadata (candidate evidence only; do not treat it as final truth):",
      JSON.stringify(compactContactForParser(contactNormalizationResult), null, 2),
    );
  }

  if (optionPriceCandidateView) {
    sections.push(
      "",
      "Pre-AI option/price normalizer clues (candidate clues only; do not create final options or assign final prices):",
      JSON.stringify(compactOptionPriceForParser(optionPriceCandidateView), null, 2),
    );
  }

  return sections.join("\n");
}
