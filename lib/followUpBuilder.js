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
    patterns: [/unclear work scope|remove, trim, or another service/i],
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
    patterns: [/service address may need city or state/i],
    message: "Service address may need city or state.",
    question: "Confirm the city and state for this service address.",
  },
];

function definitionFor(text, definitions) {
  return definitions.find((definition) => definition.patterns.some((pattern) => pattern.test(text)));
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

export function buildStructuredFollowUps({ alphaJson = {}, blocking_errors = [], warnings = [], follow_ups = [] } = {}) {
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

  return uniqueByIdAndText(issues);
}
