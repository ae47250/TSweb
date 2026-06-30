function looksLikeBadAddress(address) {
  if (!address) return false;
  const text = String(address);
  return (
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(text) ||
    /\b(somewhere|maybe|wants?|storm mess|phone|call|later|email)\b/i.test(text)
  );
}

function addressLooksLikeJobText(address) {
  return Boolean(address) && String(address).split(/\s+/).length > 10 && /\b(remove|trim|cleanup|tree|limb|brush|haul|quote|estimate)\b/i.test(address);
}

function mayNeedCityOrState(address) {
  return Boolean(address) && /\b\d+\b/.test(address) && !/\b(Madison|Hanover|Indiana|IN)\b/i.test(address);
}

function hasClearWorkScope(description, options) {
  const optionText = options.map((option) => option.description || "").join(" ");
  return /\b(tree|trees|limb|limbs|branch|branches|stump|brush|oak|pine|maple|elm|ash|cedar|sycamore|hickory|locust|birch|storm\s+limbs?|debris|cleanup|trim|trimming|remove|removal|drop)\b/i.test(`${description || ""} ${optionText}`);
}

function looksLikeMessyName(name) {
  if (!name) return false;
  return (
    /\b(customer|lady|guy|texted|maybe|phone|estimate|yesterday|cousin|office|call)\b/i.test(name) ||
    name.split(/\s+/).length > 4
  );
}

function optionLooksDirty(option) {
  return /\$|maybe|somewhere|lives?\b|email|phone/i.test(option?.description || "");
}

function hasSafetyOrAccessNote(text) {
  return /\b(power\s*lines?|service\s+drop|wire|wires|electric|blocked\s+access|no\s+access|aggressive\s+dog|dog|fence\s+damage|neighbor\s+fence|leaning\s+toward|touching|across\s+(?:drive|driveway|road|gate)|emergency|same-?day)\b/i.test(text || "");
}

function textWithoutPhones(text) {
  return String(text || "").replace(/(?:\+?1[-./\s]?)?\(?\d{3}\)?[-./\s]?\d{3}[-./\s]?\d{4}/g, " ");
}

function latestFollowUpText(text) {
  const parts = String(text || "").split(/\bFollow-up\s+\d+\s*:/i);
  return parts.length > 1 ? parts.at(-1) : "";
}

function followUpHasClearWorkScope(text) {
  return /\b(remove|removal|trim|trimming|cut|drop|haul|cleanup|stump|grind|tree|trees|limb|brush)\b/i.test(latestFollowUpText(text));
}

function followUpHasFirmPrice(text) {
  return /\$?\s*[0-9][0-9,]{2,}\b/i.test(textWithoutPhones(latestFollowUpText(text)));
}

function hasAmbiguousWorkScope(text) {
  if (followUpHasClearWorkScope(text)) return false;
  return /\btake care of\b/i.test(text || "") && /\b(tree|trees|oak|pine|maple|elm|ash|cedar|sycamore|hickory|locust|birch|limb|branch)\b/i.test(text || "");
}

function hasNonFirmPriceLanguage(text) {
  if (followUpHasFirmPrice(text)) return false;
  const withoutPhones = textWithoutPhones(text);
  return /\b(?:around|about|roughly|maybe)\s+\$?\s*[0-9][0-9,]*(?:k|000)?\b|\bprice\s+depends\b/i.test(withoutPhones);
}

function hasAmbiguousStumpInclusion(text) {
  const followUp = latestFollowUpText(text);
  if (/\bstump\b/i.test(followUp) && /\b(grind|grinding|included|excluded|separate|option|add-?on)\b/i.test(followUp)) return false;
  return /\bstump\b.{0,24}\bmaybe\b|\bmaybe\b.{0,24}\bstump\b|\bstump\b.{0,24}\bincluded\??/i.test(text || "");
}

function hasConditionalCleanupOrHaul(text, options) {
  if (options.length > 1) return false;
  const followUp = latestFollowUpText(text);
  if (/\b(cleanup|clean up|haul|haul away)\b/i.test(followUp) && followUpHasFirmPrice(text)) return false;
  return /\bclean(?:\s+it)?\s+up\s+if\s+(?:they|he|she|customer)\s+wants?\b|\bhaul(?:\s+away)?\s+if\s+(?:they|he|she|customer)\s+wants?\b/i.test(text || "");
}

export function validateAlphaJson(input) {
  const json = structuredClone(input || {});
  const blocking = [];
  const warnings = [];
  const followUps = [];

  const rawText = json?.raw_input?.customer_text || "";
  const address = json?.job?.service_address?.display?.trim();
  const description = json?.job?.description?.trim();
  const customerName = json?.customer?.name?.trim();
  const phone = json?.customer?.phone_display?.trim() || json?.customer?.phone_primary?.trim();
  const email = json?.customer?.email?.trim();
  const treeCount = json?.job?.tree_details?.tree_count?.trim();
  const options = Array.isArray(json?.service_options?.items) ? json.service_options.items : [];

  if (!address || /unknown|tbd|placeholder/i.test(address)) {
    blocking.push("Missing service address.");
    followUps.push("What is the exact service address for this job?");
  } else if (looksLikeBadAddress(address)) {
    blocking.push("Service address looks unclear.");
    followUps.push("What is the exact service address for this job?");
  }
  if (!phone && !email) {
    blocking.push("Missing customer phone or email.");
    followUps.push("What phone number or email should Alpha Tree Service use for this customer?");
  }
  if (!treeCount && !hasClearWorkScope(description, options)) {
    blocking.push("Missing tree count or clear scope.");
    followUps.push("How many trees, limbs, stumps, or brush areas are included?");
  }
  if (!description) {
    blocking.push("Missing job description.");
    followUps.push("What work is being quoted?");
  }
  if (options.length < 1) {
    blocking.push("Missing priced service option.");
    followUps.push("What priced option should appear on the estimate?");
  }
  if (hasAmbiguousWorkScope(rawText)) {
    blocking.push("Unclear work scope: remove, trim, or another service.");
    followUps.push("Should this job be removal, trimming, or another specific service?");
  }
  if (hasNonFirmPriceLanguage(rawText)) {
    blocking.push("Price is not firm enough for a customer-facing estimate.");
    followUps.push("What firm price should appear on the estimate?");
  }
  if (hasAmbiguousStumpInclusion(rawText)) {
    blocking.push("Stump inclusion is unclear.");
    followUps.push("Is stump grinding included, excluded, or a separate priced option?");
  }
  if (hasConditionalCleanupOrHaul(rawText, options)) {
    blocking.push("Cleanup or haul-away scope is unclear.");
    followUps.push("Should cleanup or haul-away be included, excluded, or listed as a separate priced option?");
  }
  if (options.length > 4 || json?.layout_flags?.over_normal_option_limit) {
    warnings.push("More than four options were provided; review final estimate formatting before sending.");
  }
  if (hasSafetyOrAccessNote(`${rawText} ${description}`)) {
    warnings.push("Safety or access note needs Tree Dude review.");
  }
  if (customerName && looksLikeMessyName(customerName)) {
    warnings.push("Customer name may need review.");
  }
  if (mayNeedCityOrState(address)) {
    warnings.push("Service address may need city or state.");
  }
  if (addressLooksLikeJobText(address)) {
    warnings.push("Service address may include extra job notes.");
  }
  if (options.some(optionLooksDirty)) {
    warnings.push("One or more option descriptions may need cleanup.");
  }

  const sortedOptions = options
    .map((option) => ({
      ...option,
      price: option.price || {},
      numericPrice: option.price?.amount ?? option.price?.min_amount ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => Number(a.numericPrice) - Number(b.numericPrice))
    .slice(0, 4)
    .map((option, index) => {
      const { numericPrice, ...rest } = option;
      return {
        ...rest,
        label: `Option ${String.fromCharCode(65 + index)}`,
        sort_order: index + 1,
      };
    });

  sortedOptions.forEach((option, index) => {
    if (!option.title || !option.description) {
      blocking.push(`${option.label || `Option ${index + 1}`} is missing title or description.`);
    }
    if (!option.price?.display || option.price?.is_unclear) {
      blocking.push(`${option.label || `Option ${index + 1}`} is missing a clear price.`);
      followUps.push(`What price should appear for ${option.label || `Option ${index + 1}`}?`);
    }
  });

  json.service_options = { ...(json.service_options || {}), items: sortedOptions };
  json.layout_flags = {
    ...(json.layout_flags || {}),
    option_count: sortedOptions.length,
    over_normal_option_limit: Boolean(json?.layout_flags?.over_normal_option_limit || options.length > 4),
    long_notes: (json?.notes?.display_notes || "").length > 500,
    likely_two_page_pdf: (json?.job?.description || "").length + (json?.notes?.display_notes || "").length > 1200,
  };
  json.validation = {
    ...(json.validation || {}),
    blocking_errors: [...new Set(blocking)],
    warnings: [...new Set([...(json.validation?.warnings || []), ...warnings])],
    tree_dude_follow_ups: [...new Set(followUps)],
    missing_required_fields: [...new Set(blocking)],
    can_generate_pdf: blocking.length === 0,
    issue_status: blocking.length ? "blocking error + tree dude follow-up" : warnings.length ? "warning" : "none",
    blocking_errors_require_follow_up: true,
  };

  return {
    alphaJson: json,
    can_generate_pdf: blocking.length === 0,
    blocking_errors: json.validation.blocking_errors,
    warnings: json.validation.warnings,
    follow_ups: json.validation.tree_dude_follow_ups,
  };
}
