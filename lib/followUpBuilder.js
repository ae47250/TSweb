const FOLLOW_UP_DEFINITIONS = [
  {
    id: "missing_service_address",
    field: "job.service_address.display",
    ui_target: "serviceAddress",
    patterns: [/missing service address/i],
    message: "Missing service address.",
    question: "What is the exact service address for this job?",
  },
  {
    id: "unclear_service_address",
    field: "job.service_address.display",
    ui_target: "serviceAddress",
    patterns: [/service address looks unclear/i],
    message: "Service address looks unclear.",
    question: "What is the exact service address for this job?",
  },
  {
    id: "missing_contact_method",
    field: "customer.phone_primary",
    ui_target: "contact",
    patterns: [/missing customer phone or email/i],
    message: "Missing customer phone or email.",
    question: "What phone number or email should Alpha Tree Service use for this customer?",
  },
  {
    id: "vague_tree_count",
    field: "job.tree_details.tree_count",
    ui_target: "treeCount",
    patterns: [/tree count is unclear|tree count is marked unknown/i],
    message: "Tree count is unclear.",
    question: "How many trees should be included in this estimate?",
  },
  {
    id: "missing_tree_count_or_scope",
    field: "job.tree_details.tree_count",
    ui_target: "jobNotes",
    patterns: [/missing tree count or clear scope/i],
    message: "Missing tree count or clear scope.",
    question: "How many trees, limbs, stumps, or brush areas are included?",
  },
  {
    id: "missing_job_description",
    field: "job.description",
    ui_target: "jobNotes",
    patterns: [/missing job description/i],
    message: "Missing job description.",
    question: "What work is being quoted?",
  },
  {
    id: "missing_priced_option",
    field: "service_options.items",
    ui_target: "jobNotes",
    patterns: [/missing priced service option|priced option descriptions are missing/i],
    message: "Missing priced service option.",
    question: "What priced option should appear on the estimate?",
  },
  {
    id: "missing_option_price",
    field: "service_options.items.price",
    ui_target: "jobNotes",
    patterns: [/missing a clear price|missing option price/i],
    message: "Option is missing a clear price.",
    question: "What price should appear for this option?",
  },
  {
    id: "unclear_work_scope",
    field: "job.description",
    ui_target: "jobNotes",
    patterns: [/unclear work scope|remove, trim, or another service|confirm what this price covers|stump price covers/i],
    message: "Work scope is unclear.",
    question: "Should this job be removal, trimming, or another specific service?",
  },
  {
    id: "unclear_scope_property_responsibility",
    field: "job.description",
    ui_target: "jobNotes",
    patterns: [/property responsibility or work scope is unclear/i],
    message: "Property responsibility or work scope is unclear.",
    question: "Clarify the work scope and who is responsible before sending this estimate.",
  },
  {
    id: "non_firm_price",
    field: "service_options.items.price",
    ui_target: "jobNotes",
    patterns: [/price is not firm enough/i],
    message: "Price is not firm enough for a customer-facing estimate.",
    question: "What firm price should appear on the estimate?",
  },
  {
    id: "unclear_stump_inclusion",
    field: "service_options.items.description",
    ui_target: "jobNotes",
    patterns: [/stump inclusion is unclear/i],
    message: "Stump inclusion is unclear.",
    question: "Is stump grinding included, excluded, or a separate priced option?",
  },
  {
    id: "unclear_cleanup_or_haul",
    field: "service_options.items.description",
    ui_target: "jobNotes",
    patterns: [/cleanup or haul-away scope is unclear/i],
    message: "Cleanup or haul-away scope is unclear.",
    question: "Should cleanup or haul-away be included, excluded, or listed as a separate priced option?",
  },
];

const WARNING_DEFINITIONS = [
  {
    id: "safety_access_warning",
    field: "notes.crew_visit_notes",
    ui_target: "warnings",
    patterns: [/safety\/access note|safety or access note/i],
    message: "Safety or access note needs contractor review.",
    question: "Review the safety or access note before sending crew instructions.",
  },
  {
    id: "possible_dirty_option_text",
    field: "service_options.items.description",
    ui_target: "jobNotes",
    patterns: [/option descriptions may need cleanup/i],
    message: "One or more option descriptions may need cleanup.",
    question: "Review the option text before confirming the quote.",
  },
  {
    id: "address_may_need_city_state",
    field: "job.service_address.display",
    ui_target: "serviceAddress",
    patterns: [/service address may need city or state/i, /service address may be missing town\/city/i],
    message: "Service address may need town/city.",
    question: "Confirm the city and state for this service address.",
  },
];

const CLARIFICATION_FIELD_DEFINITIONS = [
  {
    id: "customer_name",
    field: "customer.name",
    label: "Customer name",
    aliases: ["customer_name", "customer.name", "name"],
    question: "What is the customer's confirmed name?",
    ui_target: "customerName",
  },
  {
    id: "phone",
    field: "customer.phone_primary",
    label: "Customer phone",
    aliases: ["phone", "customer.phone", "customer.phone_primary", "customer.phone_display"],
    question: "What customer phone number should be used for this estimate?",
    ui_target: "contact",
  },
  {
    id: "email",
    field: "customer.email",
    label: "Customer email",
    aliases: ["email", "customer.email"],
    question: "What customer email address should be used for this estimate?",
    ui_target: "contact",
  },
  {
    id: "service_address",
    field: "job.service_address.display",
    label: "Service address",
    aliases: ["service_address", "address", "job.service_address", "job.service_address.display"],
    question: "What is the exact service address for this job?",
    ui_target: "serviceAddress",
  },
  {
    id: "tree_count",
    field: "job.tree_details.tree_count",
    label: "Tree count",
    aliases: ["tree_count", "tree count", "count", "job.tree_details.tree_count"],
    question: "How many trees should be included in this estimate?",
    ui_target: "treeCount",
  },
  {
    id: "tree_type",
    field: "job.tree_details.tree_type",
    label: "Tree type",
    aliases: ["tree_type", "tree type", "species", "tree_species", "job.tree_details.tree_type"],
    question: "What type or species of tree is included?",
    ui_target: "jobNotes",
  },
  {
    id: "tree_size",
    field: "job.tree_details.tree_size",
    label: "Tree size",
    aliases: ["tree_size", "tree size", "size", "job.tree_details.tree_size"],
    question: "What is the tree size or diameter?",
    ui_target: "jobNotes",
  },
  {
    id: "work_action",
    field: "job.work_action",
    label: "Work action",
    aliases: ["work_action", "work action", "job.work_action"],
    question: "Should this job be removal, trimming, stump grinding, cleanup, or another specific service?",
    ui_target: "jobNotes",
  },
  {
    id: "work_scope",
    field: "job.description",
    label: "Work scope",
    aliases: ["work_scope", "scope", "job.description", "description"],
    question: "What exact work is being quoted?",
    ui_target: "jobNotes",
  },
  {
    id: "location_on_property",
    field: "job.condition_details",
    label: "Work location",
    aliases: ["location_on_property", "location", "work_location", "job.condition_details"],
    question: "Where on the property is the work located?",
    ui_target: "jobNotes",
  },
  {
    id: "options",
    field: "service_options.items",
    label: "Estimate options",
    aliases: ["options", "option", "service_options", "service_options.items"],
    question: "What does each priced option include?",
    ui_target: "jobNotes",
  },
  {
    id: "price",
    field: "service_options.items.price",
    label: "Option price",
    aliases: ["price", "prices", "option_price", "service_options.items.price"],
    question: "What firm price should appear on the estimate?",
    ui_target: "jobNotes",
  },
  {
    id: "haul_away",
    field: "service_options.items.description",
    label: "Haul-away",
    aliases: ["haul_away", "haul away", "service_options.items.haul_away"],
    question: "Should haul-away be included, excluded, or listed as a separate priced option?",
    ui_target: "jobNotes",
  },
  {
    id: "cleanup",
    field: "service_options.items.description",
    label: "Cleanup",
    aliases: ["cleanup", "clean up", "service_options.items.cleanup"],
    question: "Should cleanup be included, excluded, or listed as a separate priced option?",
    ui_target: "jobNotes",
  },
  {
    id: "stump",
    field: "service_options.items.description",
    label: "Stump work",
    aliases: ["stump", "stump_grinding", "stump grinding", "service_options.items.stump_grinding"],
    question: "Is stump grinding included, excluded, or a separate priced option?",
    ui_target: "jobNotes",
  },
  {
    id: "wood_handling",
    field: "service_options.items.description",
    label: "Wood handling",
    aliases: ["wood_handling", "wood handling", "service_options.items.wood_handling"],
    question: "Should the wood be left, stacked, or hauled away?",
    ui_target: "jobNotes",
  },
];

function definitionFor(text, definitions) {
  return definitions.find((definition) => definition.patterns.some((pattern) => pattern.test(text)));
}

function normalizeFieldPath(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function humanizeFieldLabel(value) {
  const parts = String(value || "")
    .trim()
    .split(/[._]+/)
    .filter(Boolean);
  const lastPart = parts.at(-1) || "this field";
  return lastPart
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function clarificationDefinitionFor(field) {
  const normalizedField = normalizeFieldPath(field);
  if (!normalizedField) return null;

  const knownDefinition = CLARIFICATION_FIELD_DEFINITIONS.find((definition) =>
    definition.aliases.some((alias) => {
      const normalizedAlias = normalizeFieldPath(alias);
      return normalizedField === normalizedAlias ||
        normalizedField.endsWith(`_${normalizedAlias}`) ||
        normalizedAlias.endsWith(`_${normalizedField}`);
    }),
  );
  if (knownDefinition) return knownDefinition;

  const label = humanizeFieldLabel(field);
  return {
    id: `field_${normalizedField}`,
    field: String(field).trim(),
    label,
    question: `What is the confirmed value for ${label}?`,
    ui_target: "jobNotes",
  };
}

function issueFromDefinition({ definition, severity, sourceText, blocksPdf, evidence = "" }) {
  return {
    id: definition.id,
    severity,
    field: definition.field,
    message: definition.message,
    question: definition.question,
    evidence,
    blocks_pdf: blocksPdf,
    ui_target: definition.ui_target,
    source_text: sourceText,
  };
}

function clarificationIssueFromItem(item) {
  const definition = clarificationDefinitionFor(item?.field);
  if (!definition) return null;

  const reason = String(item?.issue || item?.reason || "").trim();
  const message = reason
    ? `Clarification needed for ${definition.label}: ${reason}`
    : `Clarification needed for ${definition.label}.`;

  return {
    id: `clarification_${definition.id}`,
    severity: "warning",
    field: definition.field,
    label: definition.label,
    message,
    question: definition.question,
    evidence: String(item?.evidence || item?.text || "").trim(),
    blocks_pdf: false,
    ui_target: definition.ui_target,
    source_text: String(item?.evidence || item?.text || message).trim(),
  };
}

export function buildFieldClarificationWarnings({
  alphaJson = {},
  blocking_errors = [],
  warnings = [],
  follow_ups = [],
} = {}) {
  const existingIssues = buildStructuredFollowUps({
    alphaJson,
    blocking_errors,
    warnings,
    follow_ups,
  });
  const coveredFields = new Set(
    existingIssues
      .filter((issue) => issue.severity === "blocking")
      .map((issue) => normalizeFieldPath(issue.field))
      .filter(Boolean),
  );
  const normalization = alphaJson?.normalization || {};
  const uncertaintyItems = [
    ...(Array.isArray(normalization.uncertainties) ? normalization.uncertainties : []),
    ...(Array.isArray(normalization.low_confidence_spans) ? normalization.low_confidence_spans : []),
  ];
  const seen = new Set();

  return uncertaintyItems
    .map(clarificationIssueFromItem)
    .filter((issue) => {
      if (!issue) return false;
      const key = `${issue.id}\u0000${issue.message}\u0000${issue.evidence}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return !coveredFields.has(normalizeFieldPath(issue.field));
    });
}

function fallbackBlockingIssue(text) {
  return {
    id: "needs_tree_dude_review",
    severity: "blocking",
    field: "",
    message: text || "Review is required.",
    question: "What detail should be corrected before this estimate is sent?",
    evidence: "",
    blocks_pdf: true,
    ui_target: "jobNotes",
    source_text: text,
  };
}

function uniqueByIdAndText(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.id}\u0000${item.source_text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildStructuredFollowUps({
  alphaJson = {},
  blocking_errors = [],
  warnings = [],
  follow_ups = [],
  clarification_warnings = [],
} = {}) {
  const rawText = alphaJson?.raw_input?.customer_text || "";
  const issues = [];

  for (const error of blocking_errors) {
    const text = String(error || "");
    const definition = definitionFor(text, FOLLOW_UP_DEFINITIONS);
    issues.push(
      definition
        ? issueFromDefinition({ definition, severity: "blocking", sourceText: text, blocksPdf: true, evidence: rawText })
        : fallbackBlockingIssue(text),
    );
  }

  for (const question of follow_ups) {
    const text = String(question || "");
    if (!text) continue;
    if (issues.some((issue) => issue.question === text)) continue;
    const definition = definitionFor(text, FOLLOW_UP_DEFINITIONS);
    if (definition) {
      issues.push(issueFromDefinition({ definition, severity: "blocking", sourceText: text, blocksPdf: true, evidence: rawText }));
    }
  }

  for (const warning of warnings) {
    const text = String(warning || "");
    const definition = definitionFor(text, WARNING_DEFINITIONS);
    if (definition) {
      issues.push(issueFromDefinition({ definition, severity: "warning", sourceText: text, blocksPdf: false, evidence: text }));
    }
  }

  for (const clarification of clarification_warnings) {
    if (!clarification?.message || !clarification?.question) continue;
    issues.push({
      id: clarification.id || "clarification_needed",
      severity: "warning",
      field: clarification.field || "",
      label: clarification.label || "",
      message: clarification.message,
      question: clarification.question,
      evidence: clarification.evidence || "",
      blocks_pdf: false,
      ui_target: clarification.ui_target || "jobNotes",
      source_text: clarification.source_text || clarification.message,
    });
  }

  return uniqueByIdAndText(issues);
}
