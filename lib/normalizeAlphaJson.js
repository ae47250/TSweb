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
    .replace(/\b(?:note\s+from|text\s+from|send\s+quote\s+to|customer\s+is|customer|client|homeowner|lady\s+named|lady|guy|person|office\s+said\s+call|call\/text|call|texted|text|said|or|text\s+mess)\b[:\s-]*/gi, " ")
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
  return asString(value)
    .replace(/\btwp\b/gi, "two")
    .replace(/\btreess\b/gi, "trees")
    .replace(/\btreee\b/gi, "tree")
    .replace(/\bremovel\b/gi, "removal")
    .replace(/\bhual\b/gi, "haul")
    .replace(/\bhall\s+(off|away)\b/gi, "haul $1")
    .replace(/\bdebree\b/gi, "debris")
    .replace(/\bstomp\s+grind(?:ed|ing)?\b/gi, "stump grinding")
    .replace(/\bstomp\b/gi, "stump")
    .replace(/\btriming\b/gi, "trimming")
    .replace(/\bbrnaches\b/gi, "branches")
    .replace(/\bqoute\b/gi, "quote")
    .replace(/\s+/g, " ")
    .trim();
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

function rawTextWithoutLeadContact(rawInput) {
  return stripEmails(asString(rawInput))
    .replace(/^[A-Za-z\u00c0-\u024f\s.'-]{2,40}\s+/, "")
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
  let text = normalizeTreeServiceText(rawTextWithoutLeadContact(rawInput)).replace(/\s+/g, " ");
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
    new RegExp(`^\\s*${namePattern}\\s+(?:said|call\\/text|call|text|phone|email|${PHONE_PATTERN.source})`, "i"),
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
  const sourceRawInput = firstString(rawInput, rawJson?.raw_input?.customer_text, rawJson?.customer_text);
  const base = createDraftAlphaJson(sourceRawInput);
  const client = rawJson?.client || {};
  const customer = rawJson?.customer || {};
  const job = rawJson?.job || {};
  const service = rawJson?.service || {};
  const firstService = serviceZero(rawJson);
  const serviceTree = firstService?.tree || {};

  const name = cleanCustomerName(firstString(client.name, customer.name, rawJson.name, base.customer.name, extractNameFromRaw(sourceRawInput)));
  const phone = normalizePhone(firstString(client.phone, customer.phone, customer.contact?.phone, rawJson.phone, rawJson.phone_number, base.customer.phone_display, extractPhoneFromRaw(sourceRawInput)));
  const email = firstString(client.email, customer.email, customer.contact?.email, rawJson.email, rawJson.email_address, extractEmailFromRaw(sourceRawInput));
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
    over_normal_option_limit: collectModelOptions(rawJson).length > 4 || extractOptionsFromRaw(sourceRawInput).length > 4,
  };
  base.raw_input.customer_text = sourceRawInput;

  return base;
}
