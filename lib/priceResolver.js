function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function money(amount) {
  return amount ? `$${Number(amount).toLocaleString("en-US")}` : "";
}

function textWithoutPhones(value) {
  return asString(value).replace(/(?:\+?1[-./\s]?)?\(?\d{3}\)?[-./\s]?\d{3}[-./\s]?\d{4}/g, " ");
}

function looksLikePhone(value) {
  return /(?:\+?1[-./\s]?)?\(?\d{3}\)?[-./\s]?\d{3}[-./\s]?\d{4}/.test(asString(value));
}

function parseFirmAmount(value) {
  if (looksLikePhone(value)) return null;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  const text = asString(value);
  const match = text.match(/\$?\s*([0-9][0-9,]*)\b/);
  if (!match) return null;
  const amount = Number(match[1].replaceAll(",", ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function spanFor(matchStart, matchText, token, useLast = false) {
  const offset = useLast ? matchText.lastIndexOf(token) : matchText.indexOf(token);
  const start = matchStart + offset;
  return {
    start,
    end: start + token.length,
    text: token,
  };
}

export function extractQuoteCleanupPricePair(rawText = "") {
  const text = asString(rawText);
  const match = text.match(
    /\b(quote|quoted)\s*(?:is|for|at|:)?\s*(\$?\s*[0-9][0-9,]{2,})\s+(cleanup|clean\s+up)\s*(?:is|for|at|:)?\s*(\$?\s*[0-9][0-9,]{2,})\b/i,
  );
  if (!match) return [];

  const firstAmount = parseFirmAmount(match[2]);
  const secondAmount = parseFirmAmount(match[4]);
  if (!firstAmount || !secondAmount) return [];

  const matchStart = match.index ?? 0;
  const rawSpan = {
    start: matchStart,
    end: matchStart + match[0].length,
    text: match[0],
  };

  return [
    {
      role: "base_quote",
      scope: "base/removal-only quote",
      amount: firstAmount,
      display: money(firstAmount),
      evidence: match[2],
      evidenceSpan: spanFor(matchStart, match[0], match[2]),
      rawSpan,
    },
    {
      role: "cleanup_option",
      scope: "cleanup/upgraded option",
      amount: secondAmount,
      display: money(secondAmount),
      evidence: match[4],
      evidenceSpan: spanFor(matchStart, match[0], match[4], true),
      rawSpan,
    },
  ];
}

function looksLikeNonPriceNumber(text) {
  return /\b(?:phone|call|text|route|highway|hwy|gate|code|address|street|st|road|rd|lane|ln|drive|dr)\b/i.test(text);
}

function rawPriceLooksLikeNonPrice(value) {
  const text = asString(value);
  return Boolean(text) && !/\$/.test(text) && /\b(?:phone|call|text|route|highway|hwy|gate|code|address|street|st|road|rd|lane|ln|drive|dr)\b/i.test(text);
}

export function resolvePrice({ rawPrice = "", rawText = "", optionText = "" } = {}) {
  const evidence = asString(rawPrice) || asString(optionText);
  const combined = textWithoutPhones([rawPrice, optionText, rawText].map(asString).filter(Boolean).join(" "));
  const warnings = [];

  if (!combined.trim()) {
    return {
      amount: null,
      display: "",
      priceStatus: "missing",
      evidence: "",
      warnings,
      blockingIssues: ["Missing option price."],
    };
  }

  if (/\b(?:around|about|roughly|maybe)\s+\$?\s*[0-9][0-9,]*(?:k|000)?\b|\bprice\s+depends\b/i.test(combined)) {
    return {
      amount: null,
      display: asString(rawPrice),
      priceStatus: "non_firm",
      evidence,
      warnings,
      blockingIssues: ["Price is not firm enough for a customer-facing estimate."],
    };
  }

  if (/\$?\s*[0-9][0-9,]*\s*(?:-|to)\s*\$?\s*[0-9][0-9,]*/i.test(combined)) {
    return {
      amount: null,
      display: asString(rawPrice),
      priceStatus: "range",
      evidence,
      warnings,
      blockingIssues: ["Price range needs review before customer-facing estimate."],
    };
  }

  if (rawPriceLooksLikeNonPrice(rawPrice)) {
    warnings.push("Numeric text looked like a non-price value.");
    return {
      amount: null,
      display: "",
      priceStatus: "unclear",
      evidence,
      warnings,
      blockingIssues: ["Option price is unclear."],
    };
  }

  if (looksLikeNonPriceNumber(combined) && !/\$|price|quote|quoted|option|remove|removal|trim|haul|cleanup|stump|grind/i.test(combined)) {
    warnings.push("Numeric text looked like a non-price value.");
    return {
      amount: null,
      display: "",
      priceStatus: "unclear",
      evidence,
      warnings,
      blockingIssues: ["Option price is unclear."],
    };
  }

  const amount = parseFirmAmount(rawPrice) ?? parseFirmAmount(optionText);
  if (!amount) {
    return {
      amount: null,
      display: "",
      priceStatus: "missing",
      evidence,
      warnings,
      blockingIssues: ["Missing option price."],
    };
  }

  return {
    amount,
    display: money(amount),
    priceStatus: "firm",
    evidence,
    warnings,
    blockingIssues: [],
  };
}
