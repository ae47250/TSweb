import { createHash } from "node:crypto";
import { TREE_SERVICE_PATTERNS } from "./treeServiceLexicon.js";

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function compact(value) {
  return asString(value).replace(/\s+/g, " ").trim();
}

export function optionAmount(option = {}) {
  const amount = Number(option?.price?.amount ?? option?.price?.min_amount);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null;
}

function optionDisplay(option = {}) {
  const amount = optionAmount(option);
  if (!amount) return compact(option?.price?.display);
  return option?.price?.display || `$${amount.toLocaleString("en-US")}`;
}

function optionScopeText(option = {}) {
  return compact([option.title, option.description].filter(Boolean).join(" "));
}

function normalizeScopeText(value) {
  return compact(value)
    .toLowerCase()
    .replace(/\$?\d[\d,]*(?:\.\d+)?\b/g, " ")
    .replace(/\boption\s+[a-e1-5]\b/g, " ")
    .replace(/\b(?:price|prices|priced|quote|quoted|estimate|est|bid|cost|total)\b/g, " ")
    .replace(/[^a-z0-9\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericScope(scope) {
  const normalized = normalizeScopeText(scope);
  return !normalized ||
    /^(?:tree service|service|tree work|work|job|scope unclear|work scope unclear|details missing|option)$/.test(normalized);
}

function hasAdminOrContactLeak(scope) {
  return /\b(?:phone|cell|email|e-?mail|addr|address|not\s+addr|not\s+phone|customer|carlos|jones|hotmail|yahoo|icloud|gmail|aol)\b|@/i.test(scope);
}

function hasServiceScope(scope) {
  return TREE_SERVICE_PATTERNS.workScope.test(scope) ||
    TREE_SERVICE_PATTERNS.addOnService.test(scope) ||
    TREE_SERVICE_PATTERNS.pruning.test(scope) ||
    TREE_SERVICE_PATTERNS.baseService.test(scope);
}

function scopeQuality(option) {
  const scope = optionScopeText(option);
  const serviceScope = hasServiceScope(scope);
  if (hasAdminOrContactLeak(scope) && !serviceScope) return "admin_or_contact";
  if (isGenericScope(scope)) return "generic";
  if (serviceScope) return "service";
  return "weak";
}

function semanticScopeKey(option) {
  const scope = normalizeScopeText(optionScopeText(option));
  if (!scope) return "missing";
  if (scopeQuality(option) !== "service") return scope;
  return scope
    .replace(/\b(?:only|just|thx|please|pls)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildEstimateSemanticProjection(alphaJson = {}, optionsOverride = null) {
  const options = Array.isArray(optionsOverride)
    ? optionsOverride
    : Array.isArray(alphaJson.service_options?.items)
      ? alphaJson.service_options.items
      : [];

  return {
    customer: {
      name: compact(alphaJson.customer?.name),
      phone: compact(alphaJson.customer?.phone_display || alphaJson.customer?.phone_primary),
      email: compact(alphaJson.customer?.email).toLowerCase(),
    },
    job: {
      service_address: compact(alphaJson.job?.service_address?.display),
      description: compact(alphaJson.job?.description),
      tree_count: compact(alphaJson.job?.tree_details?.tree_count),
      tree_type: compact(alphaJson.job?.tree_details?.tree_type),
    },
    options: options.map((option, index) => ({
      label: compact(option.label) || `Option ${String.fromCharCode(65 + index)}`,
      title: compact(option.title),
      description: compact(option.description),
      scope_key: semanticScopeKey(option),
      scope_quality: scopeQuality(option),
      amount: optionAmount(option),
      display: optionDisplay(option),
      is_unclear: Boolean(option?.price?.is_unclear || option?.scope_unclear),
    })),
  };
}

export function estimateSemanticHash(alphaJson = {}, optionsOverride = null) {
  const projection = buildEstimateSemanticProjection(alphaJson, optionsOverride);
  return createHash("sha256").update(JSON.stringify(projection)).digest("hex");
}

export function semanticOptionInvariantErrors(alphaJson = {}, optionsOverride = null) {
  const projection = buildEstimateSemanticProjection(alphaJson, optionsOverride);
  const errors = [];
  const pricedOptions = projection.options.filter((option) => option.amount && !option.is_unclear);
  const optionsByAmount = new Map();
  const optionsByScope = new Map();

  for (const option of pricedOptions) {
    if (option.scope_quality === "admin_or_contact") {
      errors.push(`${option.label} has contact/address/admin text instead of customer service scope.`);
    }
    if (pricedOptions.length > 1 && option.scope_quality === "generic") {
      errors.push(`${option.label} needs a specific service scope before PDF.`);
    }

    const amountKey = String(option.amount);
    optionsByAmount.set(amountKey, [...(optionsByAmount.get(amountKey) || []), option]);
    if (option.scope_key) {
      optionsByScope.set(option.scope_key, [...(optionsByScope.get(option.scope_key) || []), option]);
    }
  }

  for (const sameAmountOptions of optionsByAmount.values()) {
    if (sameAmountOptions.length < 2) continue;
    const scopeKeys = new Set(sameAmountOptions.map((option) => option.scope_key));
    const weakScopes = sameAmountOptions.filter((option) => option.scope_quality !== "service");
    if (scopeKeys.size < sameAmountOptions.length || weakScopes.length) {
      const display = sameAmountOptions[0].display || `$${sameAmountOptions[0].amount.toLocaleString("en-US")}`;
      errors.push(`Repeated price ${display} creates duplicate or unsupported customer options.`);
    }
  }

  for (const sameScopeOptions of optionsByScope.values()) {
    if (sameScopeOptions.length < 2) continue;
    if (sameScopeOptions.every((option) => option.scope_quality === "service")) continue;
    errors.push(`${sameScopeOptions.map((option) => option.label).join(" and ")} do not have distinct customer service scopes.`);
  }

  return [...new Set(errors)];
}
