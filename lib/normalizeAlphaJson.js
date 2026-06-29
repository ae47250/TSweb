import { createDraftAlphaJson } from "./alphaJson.js";

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

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
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

function stripPhones(value) {
  return asString(value).replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\d{3}[-.\s]?\d{7}\b/g, " ");
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

function parseAmount(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = asString(value);
  const match = text.match(/\$?\s*([0-9][0-9,]*)/);
  if (!match) return null;
  const amount = Number(match[1].replaceAll(",", ""));
  return Number.isFinite(amount) ? amount : null;
}

function extractPhoneFromRaw(rawInput) {
  const match = asString(rawInput).match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  return match ? normalizePhone(match[0]) : "";
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

function extractAddressFromRaw(rawInput) {
  const text = stripPhones(rawInput)
    .replace(/^.*?\b(?:job at|service at|customer says property is|property is)\s+/i, "")
    .replace(/\s+/g, " ");
  const suffixPattern = new RegExp(`\\b\\d+\\s+(?:[A-Za-z0-9.]+\\s+){0,5}${ADDRESS_SUFFIX}\\b(?:\\s+\\d+(?:\\s*[NSEW]\\b)?)?`, "gi");
  const suffixMatches = Array.from(text.matchAll(suffixPattern));
  const suffixMatch = suffixMatches.at(-1);
  if (suffixMatch) {
    let address = suffixMatch[0].trim().replace(/^(?:job at|service at|property is)\s+/i, "");
    const after = text.slice(suffixMatch.index + suffixMatch[0].length);
    const near = after.match(/^\s+near\s+(Madison|Hanover)\b(?:,?\s+(Indiana|IN))?/i);
    if (near) {
      address += ` near ${near[1]}${near[2] ? `, ${near[2]}` : ""}`;
      return address.trim().replace(/\s+,/g, ",");
    }
    const city = after.match(/,?\s+(Madison|Hanover)\b(?:,?\s+(Indiana|IN))?/i);
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
  const text = stripPhones(rawInput).split(/\bOption\b/i)[0];
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

function rawTextWithoutLeadContact(rawInput) {
  return asString(rawInput)
    .replace(/^[A-Za-z\u00c0-\u024f\s.'-]{2,40}\s+/, "")
    .replace(/(?:phone\s*)?(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/i, "")
    .trim();
}

function normalizeOption(option, index) {
  const title = firstString(option.title, option.name, option.label, `Service Option ${String.fromCharCode(65 + index)}`);
  const description = firstString(option.description, option.scope, option.work, title);
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

function extractOptionsFromRaw(rawInput) {
  const text = asString(rawInput).replace(/\s+/g, " ");
  const regex = /\bOption\s*([A-E]|[1-5])\s*[:.)-]?\s*(.*?)(?=\bOption\s*(?:[A-E]|[1-5])\s*[:.)-]?\s*|$)/gi;
  const options = [];
  let match;
  while ((match = regex.exec(text))) {
    const body = match[2].trim();
    if (!body) continue;
    const priceMatches = Array.from(body.matchAll(/\$?\s*([0-9][0-9,]*)/g));
    const priceMatch = priceMatches.at(-1);
    const amount = priceMatch ? Number(priceMatch[1].replaceAll(",", "")) : null;
    const description = priceMatch ? body.slice(0, priceMatch.index).trim().replace(/[.,;: -]+$/g, "") : body;
    if (/remove|removal|haul|cut|trim|cleanup|leave|debris|stump|grind|grinding|sweep|stack|wood|limb|work|emergency/i.test(description)) {
      options.push({ description, price: amount });
    }
  }
  return options;
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
  const beforePhone = asString(rawInput).split(/(?:phone\s*)?(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/i)[0];
  return titleCaseName(beforePhone.replace(/[,\s]+$/g, ""));
}

function serviceZero(rawJson) {
  return Array.isArray(rawJson?.services) && rawJson.services.length ? rawJson.services[0] : {};
}

export function normalizeToAlphaJsonV14(rawJson = {}, rawInput = "") {
  const sourceRawInput = firstString(rawInput, rawJson?.raw_input?.customer_text, rawJson?.customer_text);
  const base = createDraftAlphaJson(sourceRawInput);
  const client = rawJson?.client || {};
  const customer = rawJson?.customer || {};
  const job = rawJson?.job || {};
  const service = rawJson?.service || {};
  const firstService = serviceZero(rawJson);
  const serviceTree = firstService?.tree || {};

  const name = titleCaseName(firstString(client.name, customer.name, rawJson.name, base.customer.name, extractNameFromRaw(sourceRawInput)));
  const phone = normalizePhone(firstString(client.phone, customer.phone, customer.contact?.phone, rawJson.phone, rawJson.phone_number, base.customer.phone_display, extractPhoneFromRaw(sourceRawInput)));
  const address = firstString(
    client.service_address,
    customer.service_address,
    composeAddress(customer.address),
    composeAddress(job.address),
    composeAddress(job.service_address),
    rawJson.service_address,
    rawJson.address,
    extractAddressFromRaw(sourceRawInput),
    base.job.service_address.display,
  );
  const treeCount = normalizeTreeCount(
    firstString(
      service.tree_count_scope,
      firstService.tree_count,
      serviceTree.count,
      job.tree_count,
      rawJson.tree_count,
      base.job.tree_details.tree_count,
      extractTreeCountFromRaw(sourceRawInput),
    ),
  );
  const treeType = firstString(serviceTree.type, firstService.tree_type, job.tree_details?.tree_type, base.job.tree_details.tree_type);
  const treeSize = firstString(serviceTree.size, firstService.tree_size, job.tree_details?.tree_size, base.job.tree_details.tree_size);
  const location = firstString(serviceTree.location, firstService.location, job.condition_details, base.job.condition_details);
  const options = normalizeOptions(rawJson, sourceRawInput);
  const optionDescriptions = options.map((option) => option.description).filter(Boolean).join("; ");
  const description = firstString(
    job.description,
    service.description,
    firstService.description,
    rawJson.scope,
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
    description,
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
    over_normal_option_limit: collectModelOptions(rawJson).length > 4 || extractOptionsFromRaw(sourceRawInput).length > 4,
  };
  base.raw_input.customer_text = sourceRawInput;

  return base;
}
