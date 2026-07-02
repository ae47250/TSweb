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
