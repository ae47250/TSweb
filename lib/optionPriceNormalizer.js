import {
  classifyTreeServiceTerm,
  TREE_SERVICE_PATTERNS,
  TREE_SERVICE_PATTERN_SOURCES,
} from "./treeServiceLexicon.js";
import { LOCAL_TOWN_PATTERN } from "./localTowns.js";

const PHONE_PATTERN = /(?<![\d$])(?:\+?1[\s()./-]{0,4})?\(?\d{3}\)?[\s()./-]{0,4}\d{3}[\s()./-]{0,4}\d{4}(?![\d%])/gi;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const ADDRESS_PATTERN =
  /\b\d{1,5}\s+(?:[A-Za-z0-9.]+\s+){0,5}(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Court|Ct|Way|Pike|Trail|Trl|Highway|Hwy|Route|Terrace|Parkway|Main)\b/gi;
const SHORT_ADDRESS_PATTERN =
  /(?<![\d,$])\b\d{1,5}\s+(?:(?:N|S|E|W|North|South|East|West)\.?\s+)?(?:[A-Za-z][A-Za-z0-9.'-]{2,}|\d+(?:st|nd|rd|th))(?:\s*,?\s+(?:[A-Za-z][A-Za-z0-9.'-]{2,}|[A-E](?!\b(?:option|opt)\b)|\d+(?:st|nd|rd|th))){0,2}/gi;
const ROUTE_PATTERN = /\b(?:Highway|Hwy|Route|State\s+Road|State\s+Route|County\s+Road|County\s+Rd|CR)\s+\d+(?:\s+[NSEW])?\b/gi;
const LOCATION_NUMBER_PATTERN =
  /\b(?:on|at|near)\s+(?:route|rt|hwy|highway)?\s*\d{1,4}\b|\boff\s+(?:route|rt|hwy|highway)\s*\d{1,4}\b|\b(?:behind|beside)\b.{0,40}\b(?:on|at|near|off)\s+\d{1,4}\b|\b\d{1,4}\s+(?:[A-Za-z]+\s+){0,4}(?:rd|road|hwy|highway|street|st|ave|avenue|lane|ln|drive|dr|court|ct|circle|cir|way|place|pl)\b/gi;
const GATE_CODE_PATTERN =
  /\b(?:gate|code)\b\s*(?:code\b)?\s*[:#-]?\s*\d{3,8}\b|\b\d{3,8}\s*(?:gate|code)\b/gi;
const PERCENT_PATTERN = /\b\d+(?:\.\d+)?\s*%/gi;
const MEASUREMENT_PATTERN = /\b\d+(?:\.\d+)?\s*(?:ft|feet|foot|inches|inch|in|yd|yards?|diameter|dbh)\b/gi;
const ZIP_PATTERN = /\b\d{5}(?:-\d{4})?\b/gi;
const DATE_PATTERN = /\b(?:\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{4}-\d{2}-\d{2})\b/gi;
const TREE_COUNT_PATTERN =
  /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d{1,4})\s+(?:small\s+|large\s+|dead\s+|storm[-\s]+damaged\s+|leaning\s+|fallen\s+){0,4}(?:trees?|maples?|oaks?|pines?|cedars?|ashes?|walnuts?|elms?|limbs?|branches?)\b/gi;
const MONEY_LIKE_PATTERN = /(?<![A-Za-z0-9@._-])(?:\${1,2}\s*)?(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?\s*k|\d{3,6})(?![A-Za-z0-9_%])/gi;
const PRICE_CONTEXT_PATTERN = new RegExp(
  `\\b(?:option|opt|prices?|priced|quote|quoted|bid|estimate|cost|total|only|plus|add|for|to|${TREE_SERVICE_PATTERN_SOURCES.workScope})\\b`,
  "i",
);
const STRONG_BARE_PRICE_CONTEXT_PATTERN = new RegExp(
  `\\b(?:option|opt|prices?|priced|quote|quoted|bid|estimate|cost|total|only|plus|add|${TREE_SERVICE_PATTERN_SOURCES.workScope})\\b`,
  "i",
);
const CONTACT_OR_ADDRESS_CONTEXT_PATTERN =
  /\b(?:phone|ph|call|text|cell|mobile|number|email|e-mail|mail|address|addr|adrs|service\s+address|service\s+addy|svc\s+addr|loc|location|road|rd|street|st|ave|avenue|drive|dr|lane|ln|route|rt|hwy|highway|county\s+road|state\s+road)\b/i;
const AMBIGUITY_PATTERN =
  /\b(?:around|about|roughly|maybe|probably|approx(?:\.|imately)?|ish|not\s+sure|unknown|unclear|no\s+note|no\s+clear|not\s+clear|scope|depends|depending|if\s+needed|not\s+final|price\s+depends)\b/i;
const EXPLICIT_NOT_CURRENT_PRICE_PATTERN =
  /\b(?:not\s+(?:a\s+)?price|ignore|old\s+price|old\s+quote|previous\s+quote|last\s+year|last\s+visit|phone\s+ends?|zip\s+code)\b/i;
const OPTION_LABEL_PATTERN = /\b(?:Option|Opt)\s*([A-E]|[1-5])\b(?:\s*[:.)-]|\s*\/)?/gi;
const BARE_OPTION_LABEL_PATTERN = /(?:^|[\s.;,\/])([A-E])(?=\s*(?:[:.)-]|\b(?:maybe|around|about|roughly|price|quote|cost|for|with|w|and|plus|drop|cut|remove|trim|haul|cleanup|clean|stump|grind)\b|\/|\$|\d))/gi;
const OPTIONS_CUE_PATTERN = /\b(?:options?|opts?|optons?)\b\s*[:\-]?\s*/gi;
const BARE_OPTION_AFTER_OPTIONS_CUE_PATTERN =
  /(?:^|[\s.;,\/])([A-E])(?=\s*(?:[:.)-]|\b(?:maybe|around|about|roughly|price|quote|cost|for|with|w|and|plus|drop|cut|remove|trim|take|haul|stump|grind|clean|leave|stack|brush|wood|limb|tree)\b|\/|\$|\d))/g;
const OPTION_SEGMENT_SEPARATOR_PATTERN = /\/\/|\r?\n|;|\./g;
const SEGMENT_START_OPTION_LABEL_PATTERN =
  /^\s*([A-E])(?=\s*(?:[:.)/-]|\b(?:maybe|around|about|roughly|price|quote|cost|for|with|w|and|plus|drop|cut|remove|trim|take|haul|stump|grind|clean|leave|stack|brush|wood|limb|tree)\b|\$|\d))/i;
const OPTION_DESCRIPTION_HARD_STOP_CUE_PATTERN =
  /\b(?:phone|ph|call|reach\s+at|number|text\/call|email|eml|quote\s+email|send\s+quote\s+to|service\s+address|service\s+addy|svc\s+addr|addr|adrs|loc|location|job\s+location|work\s+at|customer|cust|customer\s+name|homeowner|contact\s+is|name\s+line\s+says|gate\s+code|access\s+code|code|keypad|lockbox|text\s+from\s+phone|other\s+notes|internal\s+note|td\s+note|admin\s+note|note\s+to\s+self|from\s+tree\s+dude|tree\s+dude\s+raw|raw\s+note|notes?|wrong\s+labels|ignore\s+old\s+price|copy\s+paste\s+duplicate|forwarded|copied\s+from|screenshot|old\s+message|previous\s+text)\b|<<</gi;
const OPTION_DESCRIPTION_SOFT_AFTER_PRICE_CUE_PATTERN =
  /\b(?:appt|appointment|scheduled|tomorrow|next\s+week|morning|afternoon|after\s+5|paid|invoice|deposit|check|cash|card|receipt|prefers\s+text|do\s+not\s+call|call\s+first|leave\s+voicemail|send\s+to|text\s+is\s+best|gate|dog|fence|backyard|alley|driveway|behind\s+house|side\s+yard)\b/gi;
const STUMP_ADD_ON_PATTERN = new RegExp(
  `\\b(?:${TREE_SERVICE_PATTERN_SOURCES.addOnService}|${TREE_SERVICE_PATTERN_SOURCES.lowerOption}|plus|add(?:\\s+to\\s+that)?|also|or\\s+all\\s+of\\s+it|included\\??)\\b`,
  "gi",
);
const SAFETY_SCOPE_RISK_PATTERN =
  /\b(?:emergency|(?:tree|limbs?|branches?)\b.{0,40}\b(?:on|onto|against)\b.{0,24}\b(?:house|garage|fence|service\s+drop|power\s*line|utility\s+line|wire)|tree\b.{0,30}\bleaning\s+(?:on|against)\b.{0,24}\b(?:structure|house|garage|fence)|(?:fence|house)\s+damage|utility\s+line|power\s*line|service\s+drop|wire|unsafe\s+access|unclear\s+access|unclear\s+scope|scope\s+unclear|not\s+sure|maybe|customer\s+unsure|need\s+(?:a\s+)?look|need\s+(?:an\s+)?estimate)\b/gi;
const PRICE_PAIRING_SCOPE_PATTERN = TREE_SERVICE_PATTERNS.workScope;
const SHORT_ADDRESS_STOP_WORD_PATTERN = new RegExp(
  `\\b(?:option|opt|prices?|priced|quote|quoted|bid|estimate|cost|total|only|plus|add|${TREE_SERVICE_PATTERN_SOURCES.workScope}|trees?|maples?|oaks?|pines?|cedars?|ashes?|walnuts?|elms?|limbs?|branches?|stumps?)\\b`,
  "i",
);
const SHORT_ADDRESS_TOWN_PATTERN = new RegExp(`\\b${LOCAL_TOWN_PATTERN}\\b`, "i");

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function compact(value) {
  return asString(value).replace(/\s+/g, " ").trim();
}

function spanFromMatch(match) {
  const start = match.index ?? 0;
  return { start, end: start + match[0].length, text: match[0] };
}

function tokenSpanFromMatch(match, token) {
  const raw = match[0] || "";
  const offset = raw.lastIndexOf(token);
  const start = (match.index ?? 0) + (offset >= 0 ? offset : 0);
  return { start, end: start + token.length, text: token };
}

function contextAround(text, start, end, windowSize = 48) {
  return compact(text.slice(Math.max(0, start - windowSize), Math.min(text.length, end + windowSize)));
}

function overlaps(left, right) {
  return left.start < right.end && right.start < left.end;
}

function normalizeProtectedSpans(protectedSpans = []) {
  return protectedSpans
    .map((span) => ({
      start: Number.isFinite(span?.start) ? span.start : null,
      end: Number.isFinite(span?.end) ? span.end : null,
      kind: span?.kind || "protected",
      raw: asString(span?.raw || span?.text || ""),
    }))
    .filter((span) => Number.isFinite(span.start) && Number.isFinite(span.end) && span.end > span.start);
}

function protectedNonPriceClues(text, protectedSpans = []) {
  return protectedSpans
    .filter((span) => ["phone", "address", "route_number", "location_number"].includes(span.kind))
    .map((span) => {
      const raw = span.raw || text.slice(span.start, span.end);
      return {
        raw,
        kind: span.kind,
        reason: `${span.kind.replace(/_/g, " ")} came from protected contact/address evidence and should not be treated as a price.`,
        span: { start: span.start, end: span.end },
        context: contextAround(text, span.start, span.end),
        normalized_display: span.kind === "phone" ? normalizePhoneDisplay(raw) : "",
      };
    });
}

function uniqueCluesBySpan(items = []) {
  return items.filter((item, index, all) =>
    index === all.findIndex((candidate) =>
      candidate.kind === item.kind &&
      candidate.span?.start === item.span?.start &&
      candidate.span?.end === item.span?.end,
    ),
  );
}

function overlapsProtectedSpan(span, protectedSpans) {
  return protectedSpans.some((protectedSpan) => overlaps(span, protectedSpan));
}

function normalizeMoneyLike(value) {
  const text = asString(value).toLowerCase().replace(/,/g, "").trim();
  const kMatch = text.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if (kMatch) return `$${Math.round(Number(kMatch[1]) * 1000).toLocaleString("en-US")}`;
  const numeric = text.replace(/[^\d]/g, "");
  if (!numeric) return "";
  return `$${Number(numeric).toLocaleString("en-US")}`;
}

function priceValue(value) {
  const display = normalizeMoneyLike(value);
  const amount = Number(display.replace(/[^\d]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function confidenceForCandidate({ explicitNotCurrentPrice, hasExplicitMoneyMarker, hasPriceContext, hasAmbiguity }) {
  if (explicitNotCurrentPrice) return "low";
  if ((hasExplicitMoneyMarker || hasPriceContext) && !hasAmbiguity) return "high";
  if (hasExplicitMoneyMarker || hasPriceContext) return "medium";
  return "low";
}

function confidenceLabel(confidence) {
  if (confidence === "high") return "high_confidence_price";
  if (confidence === "medium") return "medium_confidence_price";
  if (confidence === "low") return "low_confidence_price";
  return "excluded_non_price_number";
}

function pairingConfidenceFor({ price, description, hasOptionLabel = false, reviewWarning = false }) {
  const amountConfidence = price?.amount_confidence || price?.confidence || "low";
  const hasScope = PRICE_PAIRING_SCOPE_PATTERN.test(description || "");
  if (!price?.price_value || amountConfidence === "low") return "low";
  if (!hasScope) return hasOptionLabel && amountConfidence === "high" ? "medium" : "low";
  if (reviewWarning || amountConfidence === "medium") return "medium";
  return "high";
}

function withStablePriceIds(moneyLikeNumbers) {
  return moneyLikeNumbers
    .slice()
    .sort((left, right) => left.span.start - right.span.start || left.span.end - right.span.end)
    .map((candidate, index) => ({
      ...candidate,
      price_id: `price_${index + 1}`,
      amount_confidence: candidate.confidence,
      pairing_confidence: "unpaired",
    }));
}

function normalizePhoneDisplay(value) {
  const digits = asString(value).replace(/\D/g, "");
  const normalized = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (normalized.length !== 10) return "";
  return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}

function collectRawClues(text, pattern, kind, reason) {
  return [...text.matchAll(pattern)].map((match) => {
    const span = spanFromMatch(match);
    return {
      raw: span.text,
      kind,
      reason,
      span: { start: span.start, end: span.end },
      context: contextAround(text, span.start, span.end),
    };
  });
}

function collectShortAddressClues(text) {
  return [...text.matchAll(SHORT_ADDRESS_PATTERN)].flatMap((match) => {
    const matchedText = compact(match[0]);
    const tokens = matchedText.split(/\s*,?\s+/).filter(Boolean);
    if (tokens.length < 2) return [];

    let streetTokens = tokens.slice(1);
    const stopIndex = streetTokens.findIndex((token) => SHORT_ADDRESS_STOP_WORD_PATTERN.test(token));
    if (stopIndex === 0) return [];
    if (stopIndex > 0) streetTokens = streetTokens.slice(0, stopIndex);
    const raw = [tokens[0], ...streetTokens].join(" ");
    const firstStreetToken = (streetTokens[0] || "").replace(/\.$/, "");

    const hasDirectionalStreet = /^(?:N|S|E|W|North|South|East|West)\.?$/i.test(firstStreetToken) && streetTokens.length >= 2;
    const hasOrdinalStreet = streetTokens.some((token) => /^\d+(?:st|nd|rd|th)$/i.test(token));
    const hasMainStreet = streetTokens.some((token) => /^main$/i.test(token));
    const hasLocalTown = SHORT_ADDRESS_TOWN_PATTERN.test(raw);
    const hasStreetNameShape = hasDirectionalStreet || hasOrdinalStreet || hasMainStreet || hasLocalTown;
    if (!hasStreetNameShape) return [];

    const span = spanFromMatch(match);
    return [{
      raw,
      kind: "address",
      reason: "House number appears before a short service-address-looking phrase.",
      span: { start: span.start, end: span.end },
      context: contextAround(text, span.start, span.end),
    }];
  });
}

function collectLikelyNonPriceNumbers(text, protectedSpans = []) {
  const clues = [
    ...collectRawClues(text, PHONE_PATTERN, "phone", "Phone-number-shaped text should not be treated as an option price."),
    ...collectRawClues(text, ADDRESS_PATTERN, "address", "House number is part of a service-address-looking phrase."),
    ...collectShortAddressClues(text),
    ...collectRawClues(text, ROUTE_PATTERN, "route_number", "Route, highway, state-road, or county-road number should not be treated as a price."),
    ...collectRawClues(text, LOCATION_NUMBER_PATTERN, "location_number", "Number is attached to location, route, road, or landmark wording."),
    ...collectRawClues(text, GATE_CODE_PATTERN, "gate_code", "Gate code should not be treated as a price."),
    ...collectRawClues(text, PERCENT_PATTERN, "percentage", "Percentage should not be treated as a price."),
    ...collectRawClues(text, MEASUREMENT_PATTERN, "measurement", "Measurement should not be treated as a price."),
    ...collectRawClues(text, ZIP_PATTERN, "zip", "ZIP code should not be treated as a price."),
    ...collectRawClues(text, DATE_PATTERN, "date", "Date should not be treated as a price."),
    ...collectRawClues(text, TREE_COUNT_PATTERN, "tree_count", "Number is attached to tree-count or tree-detail wording."),
  ];

  return clues
    .filter((clue) => !overlapsProtectedSpan(clue.span, protectedSpans))
    .map((clue) => ({
    ...clue,
    normalized_display: clue.kind === "phone" ? normalizePhoneDisplay(clue.raw) : "",
  }));
}

function collectEmailCandidates(text) {
  return [...text.matchAll(EMAIL_PATTERN)].map((match) => {
    const span = spanFromMatch(match);
    return {
      raw: span.text,
      normalized_display: span.text.toLowerCase(),
      kind: "email",
      reason: "Email candidate found; keep it separate from money and option clues.",
      span: { start: span.start, end: span.end },
      context: contextAround(text, span.start, span.end),
    };
  });
}

function nonPriceOverlapForSpan(span, likelyNonPriceNumbers) {
  return likelyNonPriceNumbers.find((clue) => overlaps(span, clue.span));
}

function collectMoneyLikeNumbers(text, likelyNonPriceNumbers, protectedSpans = []) {
  return [...text.matchAll(MONEY_LIKE_PATTERN)].flatMap((match) => {
    const span = spanFromMatch(match);
    const numberSpan = { start: span.start, end: span.end };
    if (overlapsProtectedSpan(numberSpan, protectedSpans)) return [];
    if (nonPriceOverlapForSpan(numberSpan, likelyNonPriceNumbers)) return [];

    const context = contextAround(text, span.start, span.end);
    const localContext = contextAround(text, span.start, span.end, 24);
    const hasExplicitMoneyMarker = /\$|,|\bk\b/i.test(span.text);
    const hasPriceContext = PRICE_CONTEXT_PATTERN.test(context);
    const hasStrongBarePriceContext = STRONG_BARE_PRICE_CONTEXT_PATTERN.test(localContext);
    const hasContactOrAddressContext = CONTACT_OR_ADDRESS_CONTEXT_PATTERN.test(context);
    const hasAmbiguity = AMBIGUITY_PATTERN.test(context);
    const explicitNotCurrentPrice = EXPLICIT_NOT_CURRENT_PRICE_PATTERN.test(context);
    const isBarePlainNumber = /^\d{3,6}$/.test(span.text.trim());
    const hasSlashPriceContext = /\/\s*\$?\d|\d\s*\/\s*\$?/.test(text.slice(Math.max(0, span.start - 4), Math.min(text.length, span.end + 4)));
    if (isBarePlainNumber && !hasExplicitMoneyMarker && !hasStrongBarePriceContext && !hasSlashPriceContext) return [];
    if (isBarePlainNumber && hasContactOrAddressContext && !hasStrongBarePriceContext && !hasSlashPriceContext) {
      return [];
    }
    const normalizedMoneyLike = normalizeMoneyLike(span.text);
    const value = priceValue(span.text);
    const clueReasons = [
      ...(hasExplicitMoneyMarker ? ["money marker, comma, or k-suffix present"] : []),
      ...(hasPriceContext ? ["near price, option, quote, package, or tree-work wording"] : []),
      ...(hasAmbiguity ? ["near ambiguous or non-firm price language"] : []),
      ...(explicitNotCurrentPrice ? ["near wording that says this may not be the current price"] : []),
      ...(!hasExplicitMoneyMarker && !hasPriceContext ? ["number has no obvious price or option context"] : []),
    ];
    const confidence = confidenceForCandidate({
      explicitNotCurrentPrice,
      hasExplicitMoneyMarker,
      hasPriceContext,
      hasAmbiguity,
    });

    return [{
      raw: span.text.trim(),
      price_raw: span.text.trim(),
      price_value: value,
      price_display: normalizedMoneyLike,
      normalized_money_like: normalizedMoneyLike,
      span: numberSpan,
      context,
      source: "raw_customer_note",
      confidence,
      confidence_label: confidenceLabel(confidence),
      reason: clueReasons.join("; "),
      clue_strength: explicitNotCurrentPrice
        ? "weak"
        : hasExplicitMoneyMarker || hasPriceContext
          ? "strong"
          : "weak",
      clue_reasons: clueReasons,
    }];
  });
}

function collectOptionBoundaryClues(text) {
  const segmentLabels = collectLabeledOptionSegments(text).map((segment) => ({
    raw: segment.rawLabel,
    kind: "segment_start_option_label",
    token: segment.token,
    span: { start: segment.labelSpan.start, end: segment.labelSpan.end },
    context: contextAround(text, segment.labelSpan.start, segment.labelSpan.end),
  }));

  const explicitLabels = [...text.matchAll(OPTION_LABEL_PATTERN)].map((match) => {
    const span = spanFromMatch(match);
    return {
      raw: span.text,
      kind: "explicit_option_label",
      token: match[1].toUpperCase(),
      span: { start: span.start, end: span.end },
      context: contextAround(text, span.start, span.end),
    };
  });

  const bareLabels = [...text.matchAll(BARE_OPTION_LABEL_PATTERN)].map((match) => {
    const span = tokenSpanFromMatch(match, match[1]);
    return {
      raw: span.text,
      kind: "bare_option_label",
      token: match[1].toUpperCase(),
      span: { start: span.start, end: span.end },
      context: contextAround(text, span.start, span.end),
    };
  });

  const cueScopedBareLabels = [];
  for (const cueMatch of text.matchAll(OPTIONS_CUE_PATTERN)) {
    const windowStart = cueMatch.index + cueMatch[0].length;
    const window = text.slice(windowStart, Math.min(text.length, windowStart + 600));
    for (const match of window.matchAll(BARE_OPTION_AFTER_OPTIONS_CUE_PATTERN)) {
      const span = tokenSpanFromMatch(match, match[1]);
      const absoluteSpan = {
        start: windowStart + span.start,
        end: windowStart + span.end,
        text: span.text,
      };
      cueScopedBareLabels.push({
        raw: absoluteSpan.text,
        kind: "bare_option_label_after_options_cue",
        token: match[1].toUpperCase(),
        span: { start: absoluteSpan.start, end: absoluteSpan.end },
        context: contextAround(text, absoluteSpan.start, absoluteSpan.end),
      });
    }
  }

  const slashPairs = [...text.matchAll(/\b(?:A\/B\s*)?\$?\s*\d[\d,]{2,}\s*\/\s*\$?\s*\d[\d,]{2,}\b/gi)].map((match) => {
    const span = spanFromMatch(match);
    return {
      raw: span.text,
      kind: "slash_between_money_like_numbers",
      token: "/",
      span: { start: span.start, end: span.end },
      context: contextAround(text, span.start, span.end),
    };
  });

  const quoteCleanup = [...text.matchAll(/\b(?:quote|quoted)\b.{0,40}\b(?:cleanup|clean\s+up|haul(?:\s+away)?)\b/gi)].map((match) => {
    const span = spanFromMatch(match);
    return {
      raw: span.text,
      kind: "quote_cleanup_boundary",
      token: "quote_cleanup",
      span: { start: span.start, end: span.end },
      context: contextAround(text, span.start, span.end),
    };
  });

  return [...segmentLabels, ...explicitLabels, ...bareLabels, ...cueScopedBareLabels, ...slashPairs, ...quoteCleanup]
    .filter((item, index, items) =>
      index === items.findIndex((candidate) =>
        candidate.token === item.token
          && candidate.span.start === item.span.start
          && candidate.span.end === item.span.end,
      ),
    )
    .sort((left, right) => left.span.start - right.span.start);
}

function optionSegments(text) {
  const segments = [];
  let start = 0;
  for (const match of text.matchAll(OPTION_SEGMENT_SEPARATOR_PATTERN)) {
    segments.push({ start, end: match.index, text: text.slice(start, match.index) });
    start = match.index + match[0].length;
  }
  segments.push({ start, end: text.length, text: text.slice(start) });
  return segments;
}

function collectLabeledOptionSegments(text) {
  return optionSegments(text).flatMap((segment) => {
    const match = segment.text.match(SEGMENT_START_OPTION_LABEL_PATTERN);
    if (!match) return [];
    const leadingWhitespaceLength = segment.text.match(/^\s*/)?.[0]?.length || 0;
    const labelStart = segment.start + leadingWhitespaceLength;
    const labelEnd = labelStart + match[1].length;
    return [{
      token: match[1].toUpperCase(),
      rawLabel: match[1],
      segmentStart: segment.start,
      segmentEnd: segment.end,
      text: segment.text,
      labelSpan: { start: labelStart, end: labelEnd },
    }];
  });
}

function cleanOptionDescription(value) {
  return compact(value)
    .replace(/^[\s:;.,=\-)]+/g, "")
    .replace(/[\s:;.,=\-(]+$/g, "")
    .trim();
}

function collectOptionDescriptionBoundaries(text, start, end, likelyNonPriceNumbers = [], emailCandidates = []) {
  const hardCueBoundaries = [...text.matchAll(OPTION_DESCRIPTION_HARD_STOP_CUE_PATTERN)]
    .map((match) => {
      const span = spanFromMatch(match);
      return {
        start: span.start,
        end: span.end,
        tier: "hard",
        reason: `description_hard_stop_cue:${compact(span.text).toLowerCase()}`,
      };
    });
  const softCueBoundaries = [...text.matchAll(OPTION_DESCRIPTION_SOFT_AFTER_PRICE_CUE_PATTERN)]
    .map((match) => {
      const span = spanFromMatch(match);
      return {
        start: span.start,
        end: span.end,
        tier: "soft_after_price",
        reason: `description_soft_after_price_cue:${compact(span.text).toLowerCase()}`,
      };
    });
  const evidenceBoundaries = [...likelyNonPriceNumbers, ...emailCandidates]
    .filter((item) => ["phone", "address", "route_number", "location_number", "gate_code"].includes(item.kind) || item.normalized_display)
    .map((item) => ({
      start: item.span.start,
      end: item.span.end,
      tier: "hard",
      reason: `description_hard_stop_evidence:${item.kind || "email"}`,
    }));

  return [...hardCueBoundaries, ...softCueBoundaries, ...evidenceBoundaries]
    .filter((item) => item.start >= start && item.start < end)
    .sort((left, right) => left.start - right.start || left.end - right.end);
}

function firstHardStopBoundary(boundaries) {
  return boundaries
    .filter((item) => item.tier === "hard")
    .at(0) || null;
}

function firstSoftStopBoundaryAfterPrice(boundaries, price) {
  if (!price) return null;
  return boundaries
    .filter((item) => item.tier === "soft_after_price" && item.start >= price.span.end)
    .at(0) || null;
}

function implicitDescriptionForPrice(text, price, previousPriceEnd = 0) {
  const nearbyStart = Math.max(previousPriceEnd, price.span.start - 80, 0);
  const beforePrice = text.slice(nearbyStart, price.span.start);
  const lastBoundary = Math.max(
    beforePrice.lastIndexOf("."),
    beforePrice.lastIndexOf(";"),
    beforePrice.lastIndexOf("\n"),
    beforePrice.lastIndexOf(":"),
  );
  const scopedText = beforePrice.slice(lastBoundary + 1);
  const words = cleanOptionDescription(scopedText)
    .replace(/\b(?:prices?|priced|quote|quoted|estimate|est|bid|cost|total|option|opt)\b/gi, " ")
    .replace(/\b(?:and|then|with|plus|also|for|to)\b\s*$/i, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!words) return "";
  const tokens = words.split(/\s+/);
  return tokens.slice(Math.max(0, tokens.length - 7)).join(" ");
}

function collectImplicitOptionPricePairings(text, moneyLikeNumbers, existingPairings = []) {
  const pairedPriceIds = new Set(existingPairings.map((pairing) => pairing.price_id).filter(Boolean));
  return moneyLikeNumbers.flatMap((price, index) => {
    if (pairedPriceIds.has(price.price_id)) return [];
    if ((price.amount_confidence || price.confidence) === "low") return [];
    const previousPrice = moneyLikeNumbers[index - 1];
    const description = implicitDescriptionForPrice(text, price, previousPrice?.span?.end || 0);
    if (!description && price.confidence !== "high") return [];
    const pairingConfidence = pairingConfidenceFor({ price, description });
    return [{
      price_id: price.price_id,
      label: `Sidecar ${price.price_id}`,
      raw_label: "",
      raw_label_token: "",
      description_raw: description,
      price_raw: price.raw || "",
      price_display: price.price_display || "",
      price_value: price.price_value || null,
      price_status: price.confidence === "medium" ? "explicit_numeric_with_soft_language" : "firm_candidate",
      review_warning: pairingConfidence !== "high",
      confidence: pairingConfidence,
      amount_confidence: price.amount_confidence || price.confidence || "low",
      pairing_confidence: pairingConfidence,
      source: "option_price_sidecar_implicit",
      span: {
        start: description
          ? Math.max(0, price.span.start - description.length - 1)
          : price.span.start,
        end: price.span.end,
      },
      context: price.context,
      boundary_reason: "implicit_nearby_scope",
      reason: description
        ? "Derived nearby work-scope wording immediately before this price."
        : "Price amount is visible, but nearby work-scope wording is unclear.",
    }];
  });
}

function collectOptionPricePairings(text, optionBoundaryClues, moneyLikeNumbers, likelyNonPriceNumbers = [], emailCandidates = []) {
  const segmentPairings = collectLabeledOptionSegments(text).flatMap((segment) => {
    const boundaries = collectOptionDescriptionBoundaries(
      text,
      segment.labelSpan.end,
      segment.segmentEnd,
      likelyNonPriceNumbers,
      emailCandidates,
    );
    const hardStopBoundary = firstHardStopBoundary(boundaries);
    const hardPairingEnd = hardStopBoundary ? hardStopBoundary.start : segment.segmentEnd;
    const price = moneyLikeNumbers
      .filter((item) => item.span.start >= segment.labelSpan.end && item.span.start < hardPairingEnd)
      .at(0);
    const softStopBoundary = firstSoftStopBoundaryAfterPrice(boundaries, price);
    const stopBoundary = hardStopBoundary && softStopBoundary
      ? (hardStopBoundary.start <= softStopBoundary.start ? hardStopBoundary : softStopBoundary)
      : hardStopBoundary || softStopBoundary;
    const pairingEnd = stopBoundary ? stopBoundary.start : segment.segmentEnd;
    const descriptionEnd = price ? price.span.start : pairingEnd;
    const description = cleanOptionDescription(text.slice(segment.labelSpan.end, descriptionEnd));
    if (!description && !price) return [];
    const contextEnd = price ? price.span.end : descriptionEnd;
    const hasSoftLanguage = /\b(?:maybe|around|about|roughly|probably)\b/i.test(
      text.slice(segment.labelSpan.end, segment.segmentEnd),
    );
    const pairingConfidence = pairingConfidenceFor({
      price,
      description,
      hasOptionLabel: true,
      reviewWarning: Boolean(hasSoftLanguage && price),
    });
    return [{
      price_id: price?.price_id || "",
      label: `Option ${segment.token}`,
      raw_label: segment.rawLabel,
      raw_label_token: segment.token,
      description_raw: description,
      price_raw: price?.raw || "",
      price_display: price?.price_display || "",
      price_value: price?.price_value || null,
      price_status: hasSoftLanguage && price ? "explicit_numeric_with_soft_language" : "firm_candidate",
      review_warning: Boolean(hasSoftLanguage && price),
      confidence: pairingConfidence,
      amount_confidence: price?.amount_confidence || price?.confidence || "low",
      pairing_confidence: pairingConfidence,
      source: "option_price_sidecar_segment",
      span: {
        start: segment.labelSpan.start,
        end: contextEnd,
      },
      context: contextAround(text, segment.labelSpan.start, contextEnd),
      boundary_reason: stopBoundary ? stopBoundary.reason : "segment_separator_or_end",
      reason: price
        ? "First valid money-like number inside a segment that starts with a raw option label."
        : "Segment starts with a raw option label but no price was found.",
    }];
  });

  const labels = optionBoundaryClues
    .filter((item) => /option_label/i.test(item.kind) && /^[A-E1-5]$/i.test(item.token || ""))
    .sort((left, right) => left.span.start - right.span.start);
  if (!labels.length || !moneyLikeNumbers.length) {
    return [...segmentPairings, ...collectImplicitOptionPricePairings(text, moneyLikeNumbers, segmentPairings)]
      .sort((left, right) => (left.span?.start || 0) - (right.span?.start || 0));
  }

  const fallbackPairings = labels.flatMap((label, index) => {
    const nextLabel = labels[index + 1];
    const segmentEnd = nextLabel ? nextLabel.span.start : text.length;
    const boundaries = collectOptionDescriptionBoundaries(
      text,
      label.span.end,
      segmentEnd,
      likelyNonPriceNumbers,
      emailCandidates,
    );
    const hardStopBoundary = firstHardStopBoundary(boundaries);
    const hardPairingEnd = hardStopBoundary ? hardStopBoundary.start : segmentEnd;
    const price = moneyLikeNumbers
      .filter((item) => item.span.start >= label.span.end && item.span.start < hardPairingEnd)
      .at(0);
    const softStopBoundary = firstSoftStopBoundaryAfterPrice(boundaries, price);
    const stopBoundary = hardStopBoundary && softStopBoundary
      ? (hardStopBoundary.start <= softStopBoundary.start ? hardStopBoundary : softStopBoundary)
      : hardStopBoundary || softStopBoundary;
    const pairingEnd = stopBoundary ? stopBoundary.start : segmentEnd;
    const descriptionEnd = price ? price.span.start : pairingEnd;
    const description = cleanOptionDescription(text.slice(label.span.end, descriptionEnd));
    if (!description && !price) return [];
    const reviewWarning = Boolean(/\b(?:maybe|around|about|roughly|probably)\b/i.test(text.slice(label.span.end, segmentEnd)) && price);
    const pairingConfidence = pairingConfidenceFor({
      price,
      description,
      hasOptionLabel: true,
      reviewWarning,
    });
    return [{
      price_id: price?.price_id || "",
      label: /^[1-5]$/.test(label.token) ? `Option ${label.token}` : `Option ${label.token.toUpperCase()}`,
      raw_label: label.raw,
      raw_label_token: /^[1-5]$/.test(label.token) ? label.token : label.token.toUpperCase(),
      description_raw: description,
      price_raw: price?.raw || "",
      price_display: price?.price_display || "",
      price_value: price?.price_value || null,
      price_status: /\b(?:maybe|around|about|roughly|probably)\b/i.test(text.slice(label.span.end, segmentEnd))
        ? "explicit_numeric_with_soft_language"
        : "firm_candidate",
      review_warning: reviewWarning,
      confidence: pairingConfidence,
      amount_confidence: price?.amount_confidence || price?.confidence || "low",
      pairing_confidence: pairingConfidence,
      source: "option_price_sidecar",
      span: {
        start: label.span.start,
        end: price ? price.span.end : descriptionEnd,
      },
      context: contextAround(text, label.span.start, price ? price.span.end : descriptionEnd),
      boundary_reason: stopBoundary
        ? stopBoundary.reason
        : nextLabel
          ? "next_option_label"
          : "text_end",
    }];
  });

  const seen = new Set();
  const labeledPairings = [...segmentPairings, ...fallbackPairings]
    .filter((pairing) => {
      const key = pairing.raw_label_token || pairing.label;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => (left.span?.start || 0) - (right.span?.start || 0));
  return [...labeledPairings, ...collectImplicitOptionPricePairings(text, moneyLikeNumbers, labeledPairings)]
    .sort((left, right) => (left.span?.start || 0) - (right.span?.start || 0));
}

function collectStumpAddOnClues(text) {
  return [...text.matchAll(STUMP_ADD_ON_PATTERN)].map((match) => {
    const span = spanFromMatch(match);
    const context = contextAround(text, span.start, span.end);
    return {
      raw: span.text,
      kind: /stump|grind|root\s+ball/i.test(span.text)
        ? "stump_or_grinding"
        : /haul|cleanup|clean|debris|brush|leave|stack|wood|log|chip|rounds?|dump|tipping|disposal|green\s+waste|backfill/i.test(span.text)
          ? "haul_cleanup_or_debris"
          : "add_on_boundary",
      category: classifyTreeServiceTerm(span.text),
      span: { start: span.start, end: span.end },
      context,
      ambiguity: AMBIGUITY_PATTERN.test(context) || /\bincluded\??\b/i.test(context),
    };
  });
}

function rankedConfidence(value) {
  return { high: 3, medium: 2, low: 1, unpaired: 0, "": 0 }[value || ""] || 0;
}

function lowerConfidence(left, right) {
  return rankedConfidence(left) <= rankedConfidence(right) ? left : right;
}

function bestPairingsByPriceId(pairings = []) {
  const best = new Map();
  for (const pairing of pairings) {
    const key = pairing.price_id || "";
    if (!key) continue;
    const current = best.get(key);
    const confidence = pairing.pairing_confidence || pairing.confidence || "low";
    const currentConfidence = current?.pairing_confidence || current?.confidence || "";
    if (!current || rankedConfidence(confidence) > rankedConfidence(currentConfidence)) {
      best.set(key, pairing);
    }
  }
  return best;
}

function addOnContextLooksAmbiguous(text) {
  return AMBIGUITY_PATTERN.test(text) ||
    TREE_SERVICE_PATTERNS.unitOrRateCue.test(text) ||
    /\b(?:if|unless|optional|separate\s+from|separate\s+line|included\??|not\s+sure|depends)\b/i.test(text);
}

function cleanInterpretationScope(value, fallback) {
  const cleaned = cleanOptionDescription(value)
    .replace(/\b(?:prices?|priced|quote|quoted|estimate|est|bid|cost|total|option|opt)\b/gi, " ")
    .replace(/\b(?:extra|add(?:ed)?|add\s+on|add-on|add\s+to\s+that|plus|on\s+top|additional|also|in\s+addition)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

function collectAddOnPriceInterpretations(text, moneyLikeNumbers = [], optionPricePairings = []) {
  const prices = moneyLikeNumbers
    .filter((price) => Number.isFinite(price.price_value) && price.price_value > 0)
    .sort((left, right) => left.span.start - right.span.start || left.span.end - right.span.end);
  if (prices.length < 2) return [];

  const pairingsById = bestPairingsByPriceId(optionPricePairings);
  const simpleTwoPriceShape = prices.length === 2;
  const interpretations = [];

  for (let index = 1; index < prices.length; index += 1) {
    const base = prices[index - 1];
    const addOn = prices[index];
    const basePairing = pairingsById.get(base.price_id) || null;
    const addOnPairing = pairingsById.get(addOn.price_id) || null;
    const between = text.slice(base.span.end, addOn.span.start);
    const baseScope = cleanInterpretationScope(basePairing?.description_raw || base.context, "base tree work");
    const addOnScope = cleanInterpretationScope(addOnPairing?.description_raw || between || addOn.context, "add-on work");
    const evidenceText = `${base.context} ${between} ${addOn.context} ${baseScope} ${addOnScope}`;
    const hasBaseService = TREE_SERVICE_PATTERNS.baseService.test(evidenceText) ||
      TREE_SERVICE_PATTERNS.lowerOption.test(evidenceText);
    const hasAddOnService = TREE_SERVICE_PATTERNS.addOnService.test(`${between} ${addOn.context} ${addOnScope}`);
    const explicitAdditiveCue = TREE_SERVICE_PATTERNS.explicitAdditiveCue.test(`${between} ${addOn.context} ${addOnScope}`);
    const explicitAdditiveIntent = explicitAdditiveCue || /\+/.test(`${between} ${addOn.context} ${addOnScope}`);
    const ambiguous = addOnContextLooksAmbiguous(evidenceText);
    const amountConfidence = lowerConfidence(base.amount_confidence || base.confidence || "low", addOn.amount_confidence || addOn.confidence || "low");
    const pairingConfidence = lowerConfidence(
      basePairing?.pairing_confidence || basePairing?.confidence || "low",
      addOnPairing?.pairing_confidence || addOnPairing?.confidence || "low",
    );
    const addOnIsLowerThanBase = addOn.price_value < base.price_value;
    const addOnIsHigherThanBase = addOn.price_value > base.price_value;
    const interpretation = explicitAdditiveIntent && hasAddOnService
      ? "additive_amount"
      : addOnIsHigherThanBase && hasAddOnService
        ? "bundled_total"
        : "needs_review";
    const canAutoInterpret = interpretation === "additive_amount" || interpretation === "bundled_total";
    const confidence = canAutoInterpret && amountConfidence === "high" &&
      rankedConfidence(pairingConfidence) >= rankedConfidence("medium") &&
      hasBaseService &&
      hasAddOnService &&
      !ambiguous &&
      simpleTwoPriceShape
      ? (pairingConfidence === "high" ? "high" : "medium")
      : canAutoInterpret && amountConfidence === "high" && hasAddOnService && !ambiguous
        ? "medium"
        : "low";
    const combinedPriceValue = interpretation === "additive_amount"
      ? base.price_value + addOn.price_value
      : addOn.price_value;

    interpretations.push({
      interpretation_id: `add_on_${base.price_id || index}_${addOn.price_id || index + 1}`,
      interpretation,
      base_price_id: base.price_id,
      base_price_value: base.price_value,
      base_price_display: base.price_display,
      base_description: baseScope,
      add_on_price_id: addOn.price_id,
      add_on_price_value: addOn.price_value,
      add_on_price_display: addOn.price_display,
      add_on_description: addOnScope,
      combined_price_value: combinedPriceValue,
      combined_price_display: normalizeMoneyLike(String(combinedPriceValue)),
      amount_confidence: amountConfidence,
      pairing_confidence: pairingConfidence,
      addon_interpretation_confidence: confidence,
      explicit_additive_cue: explicitAdditiveIntent,
      simple_two_price_shape: simpleTwoPriceShape,
      needs_review: confidence !== "high",
      review_reason: confidence === "high"
        ? ""
        : ambiguous
          ? "Add-on wording has conditional, unclear, per-unit, or included-language context."
          : !explicitAdditiveIntent && addOnIsLowerThanBase
            ? "Lower add-on price needs explicit wording such as +, extra, add-on, or plus before automatic arithmetic."
            : !simpleTwoPriceShape
              ? "More than two price candidates were present, so automatic add-on arithmetic is not safe."
              : "Base/add-on scope or pairing confidence is not strong enough for automatic arithmetic.",
      span: {
        start: base.span.start,
        end: addOn.span.end,
      },
      context: compact(evidenceText),
      source: "option_price_sidecar_add_on_interpretation",
    });
  }

  return interpretations;
}

function pricePairingMap(optionPricePairings = []) {
  return bestPairingsByPriceId(optionPricePairings);
}

function priceHasTotalCue(text, price, pairing = null) {
  const evidence = compact([
    price?.context,
    pairing?.description_raw,
    text.slice(Math.max(0, (price?.span?.start || 0) - 18), Math.min(text.length, (price?.span?.end || 0) + 18)),
  ].filter(Boolean).join(" "));
  return /\b(?:total|estimate|all\s+in|all-in|together|package)\b/i.test(evidence);
}

function pricePairingLooksAdministrative(price, pairing = null) {
  const evidence = compact([price?.context, pairing?.description_raw].filter(Boolean).join(" "));
  const pairingConfidence = pairing?.pairing_confidence || pairing?.confidence || "low";
  return rankedConfidence(pairingConfidence) <= rankedConfidence("low") &&
    /\b(?:phone|cell|email|e\s*mail|addr|address|not\s+addr|not\s+phone|customer)\b|@/i.test(evidence);
}

function componentCombinations(items, start = 0, selected = [], output = []) {
  if (selected.length >= 2) output.push(selected);
  if (selected.length >= 4) return output;
  for (let index = start; index < items.length; index += 1) {
    componentCombinations(items, index + 1, [...selected, items[index]], output);
  }
  return output;
}

function collectMonetaryRelationships(text, moneyLikeNumbers = [], optionPricePairings = []) {
  const prices = moneyLikeNumbers
    .filter((price) => Number.isFinite(price.price_value) && price.price_value > 0)
    .sort((left, right) => left.span.start - right.span.start || left.span.end - right.span.end);
  if (prices.length < 3) return [];

  const pairingsById = pricePairingMap(optionPricePairings);
  const relationships = [];

  for (const total of prices) {
    const totalPairing = pairingsById.get(total.price_id) || null;
    const hasTotalCue = priceHasTotalCue(text, total, totalPairing);
    const adminTotal = pricePairingLooksAdministrative(total, totalPairing);
    if (!hasTotalCue && !adminTotal) continue;

    const components = prices.filter((price) => price.price_id !== total.price_id);
    for (const combo of componentCombinations(components)) {
      const sum = combo.reduce((totalAmount, price) => totalAmount + price.price_value, 0);
      if (sum !== total.price_value) continue;

      const componentPairings = combo.map((price) => pairingsById.get(price.price_id) || null);
      const componentsHaveScope = componentPairings.every((pairing) =>
        rankedConfidence(pairing?.pairing_confidence || pairing?.confidence || "low") >= rankedConfidence("medium"),
      );
      const confidence = hasTotalCue && componentsHaveScope
        ? "high"
        : adminTotal && componentsHaveScope
          ? "medium"
          : "low";
      if (confidence === "low") continue;

      relationships.push({
        relationship_id: `total_${total.price_id}_of_${combo.map((price) => price.price_id).join("_")}`,
        type: "total_of",
        total_price_id: total.price_id,
        total_amount: total.price_value,
        total_display: total.price_display,
        component_price_ids: combo.map((price) => price.price_id),
        component_amounts: combo.map((price) => price.price_value),
        component_displays: combo.map((price) => price.price_display),
        confidence,
        reason: hasTotalCue
          ? "Total/estimate wording plus exact arithmetic ties this amount to component prices."
          : "Administrative or address/contact-looking total candidate equals scoped component prices.",
        source: "option_price_sidecar_total_component_relationship",
      });
      break;
    }
  }

  return relationships;
}

function collectMonetaryRoles(moneyLikeNumbers = [], optionPricePairings = [], monetaryRelationships = []) {
  const pairingsById = pricePairingMap(optionPricePairings);
  const totalPriceIds = new Set(monetaryRelationships.map((relationship) => relationship.total_price_id).filter(Boolean));
  const componentPriceIds = new Set(monetaryRelationships.flatMap((relationship) => relationship.component_price_ids || []));

  return moneyLikeNumbers.map((price) => {
    const pairing = pairingsById.get(price.price_id) || null;
    const amountConfidence = price.amount_confidence || price.confidence || "low";
    const pairingConfidence = pairing?.pairing_confidence || pairing?.confidence || "low";
    let role = "unresolved";
    if (totalPriceIds.has(price.price_id)) role = "total";
    else if (componentPriceIds.has(price.price_id)) role = "component";
    else if (rankedConfidence(amountConfidence) >= rankedConfidence("high") && rankedConfidence(pairingConfidence) >= rankedConfidence("medium")) role = "option";

    return {
      price_id: price.price_id,
      amount: price.price_value,
      display: price.price_display,
      role,
      amount_confidence: amountConfidence,
      pairing_confidence: pairingConfidence,
      source: "option_price_sidecar_monetary_role",
    };
  });
}

function collectAmbiguityWarnings({ text, moneyLikeNumbers, optionBoundaryClues, stumpAddOnClues, addOnPriceInterpretations = [] }) {
  const warnings = [];

  for (const candidate of moneyLikeNumbers) {
    if (candidate.clue_reasons.some((reason) => /ambiguous|non-firm/i.test(reason))) {
      warnings.push({
        warning: "Money-like number appears near ambiguous or non-firm price language.",
        span: candidate.span,
        context: candidate.context,
      });
    }
    if (candidate.clue_reasons.some((reason) => /may not be the current price/i.test(reason))) {
      warnings.push({
        warning: "Money-like number may be historical or explicitly not current.",
        span: candidate.span,
        context: candidate.context,
      });
    }
    if (candidate.clue_strength === "weak") {
      warnings.push({
        warning: "Money-like number lacks clear option or price context.",
        span: candidate.span,
        context: candidate.context,
      });
    }
  }

  for (const clue of stumpAddOnClues.filter((item) => item.ambiguity)) {
    warnings.push({
      warning: "Stump, haul-away, cleanup, or add-on wording looks conditional or unclear.",
      span: clue.span,
      context: clue.context,
    });
  }

  for (const interpretation of addOnPriceInterpretations.filter((item) => item.needs_review)) {
    warnings.push({
      warning: "Possible add-on price needs confirmation before automatic bundled-option arithmetic.",
      span: interpretation.span,
      context: interpretation.context,
    });
  }

  if (moneyLikeNumbers.length > 1 && optionBoundaryClues.length === 0) {
    warnings.push({
      warning: "Multiple money-like numbers found without clear option boundary labels.",
      span: null,
      context: compact(text),
    });
  }

  if (!moneyLikeNumbers.length) {
    warnings.push({
      warning: "No money-like numbers found for the AI to inspect.",
      span: null,
      context: compact(text),
    });
  }

  return warnings;
}

function collectSafetyScopeWarnings(text) {
  return [...text.matchAll(SAFETY_SCOPE_RISK_PATTERN)].map((match) => {
    const span = spanFromMatch(match);
    return {
      warning: "Raw note contains safety, access, damage, or scope language that should be reviewed by Tree Dude.",
      raw: span.text,
      kind: "safety_scope_risk",
      span: { start: span.start, end: span.end },
      context: contextAround(text, span.start, span.end),
    };
  });
}

function lowConfidenceSpans({ moneyLikeNumbers, priceScopeAmbiguityWarnings, safetyScopeWarnings, addOnPriceInterpretations = [] }) {
  return [
    ...moneyLikeNumbers
      .filter((candidate) => candidate.confidence !== "high")
      .map((candidate) => ({
        field: "price",
        reason: candidate.reason || "Price confidence is not high.",
        span: candidate.span,
        context: candidate.context,
      })),
    ...priceScopeAmbiguityWarnings.map((warning) => ({
      field: "price_or_option_scope",
      reason: warning.warning,
      span: warning.span,
      context: warning.context,
    })),
    ...safetyScopeWarnings.map((warning) => ({
      field: "safety_access_scope",
      reason: warning.warning,
      span: warning.span,
      context: warning.context,
    })),
    ...addOnPriceInterpretations
      .filter((interpretation) => interpretation.addon_interpretation_confidence !== "high")
      .map((interpretation) => ({
        field: "add_on_price_interpretation",
        reason: interpretation.review_reason || "Add-on price interpretation confidence is not high.",
        span: interpretation.span,
        context: interpretation.context,
      })),
  ].filter((item) => item.span);
}

function bulletLines(label, items, renderItem) {
  if (!items.length) return [`* ${label}: none`];
  return [`* ${label}:`, ...items.map((item) => `  - ${renderItem(item)}`)];
}

function cleanedReadingAidFromOptions(options = {}) {
  const cleanedText = compact(options.cleanedText || options.cleanedNote || options.secondaryText || "");
  const rawText = compact(options.rawText || "");
  if (!cleanedText || cleanedText === rawText) return null;
  return {
    cleaned_text: cleanedText,
    source: "literal_text_cleanup",
    usage: "secondary_reading_aid_only",
    warning: "Do not create price candidates from this cleaned text. Raw TD1 note spans are the source of truth.",
  };
}

function renderCandidateView(rawCustomerNote, clues) {
  const lines = [
    "Raw customer note:",
    rawCustomerNote,
    "",
    ...(clues.cleaned_reading_aid
      ? [
          "Literal cleaned text from conservative cleanup (secondary reading aid only; raw TD1 note wins):",
          clues.cleaned_reading_aid.cleaned_text,
          "",
        ]
      : []),
    "Pre-AI option-price candidate clues:",
    "",
    ...bulletLines("Money-like numbers", clues.money_like_numbers, (item) =>
      `${item.price_id || "price"}: ${item.raw} -> ${item.normalized_money_like || "un-normalized"} (${item.amount_confidence || item.confidence}; ${item.clue_strength}; ${item.clue_reasons.join("; ")}) [${item.span.start}-${item.span.end}]`,
    ),
    ...bulletLines("Likely non-price numbers", clues.likely_non_price_numbers, (item) =>
      `${item.raw}${item.normalized_display ? ` -> ${item.normalized_display}` : ""} (${item.kind}; ${item.reason}) [${item.span.start}-${item.span.end}]`,
    ),
    ...bulletLines("Option boundary clues", clues.option_boundary_clues, (item) =>
      `${item.raw} (${item.kind}) [${item.span.start}-${item.span.end}]`,
    ),
    ...bulletLines("Option-price pairings", clues.option_price_pairings || [], (item) =>
      `${item.price_id || "price"} ${item.label}: ${item.description_raw || "no description"}${item.price_display ? ` -> ${item.price_display}` : ""} (${item.pairing_confidence || item.confidence}) [${item.span.start}-${item.span.end}]`,
    ),
    ...bulletLines("Stump/add-on clues", clues.stump_add_on_clues, (item) =>
      `${item.raw} (${item.kind}${item.ambiguity ? "; ambiguous" : ""}) [${item.span.start}-${item.span.end}]`,
    ),
    ...bulletLines("Add-on price interpretations", clues.add_on_price_interpretations || [], (item) =>
      `${item.interpretation_id}: ${item.base_price_display} + ${item.add_on_price_display} -> ${item.combined_price_display} (${item.interpretation}; ${item.addon_interpretation_confidence}) [${item.span.start}-${item.span.end}]`,
    ),
    ...bulletLines("Price/scope ambiguity warnings", clues.price_scope_ambiguity_warnings, (item) =>
      `${item.warning}${item.span ? ` [${item.span.start}-${item.span.end}]` : ""}`,
    ),
    ...bulletLines("Safety/access/scope warnings", clues.safety_scope_warnings, (item) =>
      `${item.raw} (${item.warning}) [${item.span.start}-${item.span.end}]`,
    ),
  ];

  return `${lines.join("\n")}\n`;
}

export function buildOptionPriceCandidateView(rawInput = "", protectedSpans = [], options = {}) {
  const rawCustomerNote = asString(rawInput);
  const cleanedReadingAid = cleanedReadingAidFromOptions({ ...options, rawText: rawCustomerNote });
  const normalizedProtectedSpans = normalizeProtectedSpans(protectedSpans);
  const likelyNonPriceNumbers = uniqueCluesBySpan([
    ...protectedNonPriceClues(rawCustomerNote, normalizedProtectedSpans),
    ...collectLikelyNonPriceNumbers(rawCustomerNote, normalizedProtectedSpans),
  ]);
  const moneyLikeNumbers = withStablePriceIds(collectMoneyLikeNumbers(rawCustomerNote, likelyNonPriceNumbers, normalizedProtectedSpans));
  const optionBoundaryClues = collectOptionBoundaryClues(rawCustomerNote);
  const emailCandidates = collectEmailCandidates(rawCustomerNote);
  const optionPricePairings = collectOptionPricePairings(
    rawCustomerNote,
    optionBoundaryClues,
    moneyLikeNumbers,
    likelyNonPriceNumbers,
    emailCandidates,
  );
  const stumpAddOnClues = collectStumpAddOnClues(rawCustomerNote);
  const addOnPriceInterpretations = collectAddOnPriceInterpretations(
    rawCustomerNote,
    moneyLikeNumbers,
    optionPricePairings,
  );
  const monetaryRelationships = collectMonetaryRelationships(
    rawCustomerNote,
    moneyLikeNumbers,
    optionPricePairings,
  );
  const monetaryRoles = collectMonetaryRoles(
    moneyLikeNumbers,
    optionPricePairings,
    monetaryRelationships,
  );
  const priceScopeAmbiguityWarnings = collectAmbiguityWarnings({
    text: rawCustomerNote,
    moneyLikeNumbers,
    optionBoundaryClues,
    stumpAddOnClues,
    addOnPriceInterpretations,
  });
  const safetyScopeWarnings = collectSafetyScopeWarnings(rawCustomerNote);
  const clues = {
    money_like_numbers: moneyLikeNumbers,
    price_candidates_detected: moneyLikeNumbers,
    likely_non_price_numbers: likelyNonPriceNumbers,
    excluded_numbers: likelyNonPriceNumbers,
    protected_spans: normalizedProtectedSpans,
    cleaned_reading_aid: cleanedReadingAid,
    source_of_truth: "raw_customer_note",
    email_candidates: emailCandidates,
    option_boundary_clues: optionBoundaryClues,
    option_price_pairings: optionPricePairings,
    stump_add_on_clues: stumpAddOnClues,
    add_on_price_interpretations: addOnPriceInterpretations,
    monetary_relationships: monetaryRelationships,
    monetary_roles: monetaryRoles,
    price_scope_ambiguity_warnings: priceScopeAmbiguityWarnings,
    safety_scope_warnings: safetyScopeWarnings,
    low_confidence_spans: lowConfidenceSpans({
      moneyLikeNumbers,
      priceScopeAmbiguityWarnings,
      safetyScopeWarnings,
      addOnPriceInterpretations,
    }),
  };

  return {
    raw_customer_note: rawCustomerNote,
    pre_ai_option_price_candidate_clues: clues,
    rendered_view: renderCandidateView(rawCustomerNote, clues),
  };
}
