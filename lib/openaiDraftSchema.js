import { z } from "zod";

const DRAFT_VERSION = "alpha_extraction_v1";
const TREE_COUNT_STATUSES = new Set(["found", "missing", "vague", "uncertain"]);
const WORK_ACTIONS = new Set(["remove", "trim", "haul", "cleanup", "stump_grind", "other", "unclear"]);
const PRICE_STATUSES = new Set(["firm", "range", "non_firm", "missing", "unclear", "explicit_numeric_with_soft_language"]);
const INCLUSION_STATUSES = new Set(["included", "excluded", "unclear", "not_stated"]);
const WOOD_HANDLING_STATUSES = new Set(["leave", "stack", "haul", "unclear", "not_stated"]);
const SAFETY_NOTE_TYPES = new Set(["power_lines", "dog", "gate", "access", "emergency", "fence", "other"]);
const CONFIDENCE_STATUSES = new Set(["low", "medium", "unknown"]);
const NUMBER_TRACE_CLASSIFICATIONS = new Set(["phone", "price", "address", "tree_count", "other"]);

const stringSchema = { type: "string" };

const correctionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["original", "corrected", "reason"],
  properties: {
    original: stringSchema,
    corrected: stringSchema,
    reason: stringSchema,
  },
};

const uncertaintySchema = {
  type: "object",
  additionalProperties: false,
  required: ["field", "issue", "evidence"],
  properties: {
    field: stringSchema,
    issue: stringSchema,
    evidence: stringSchema,
  },
};

const optionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "raw_label",
    "raw_text",
    "scope",
    "price_raw",
    "price_amount",
    "price_status",
    "haul_away",
    "cleanup",
    "stump_grinding",
    "wood_handling",
    "evidence",
  ],
  properties: {
    raw_label: stringSchema,
    raw_text: stringSchema,
    scope: stringSchema,
    price_raw: stringSchema,
    price_amount: { type: ["number", "null"] },
    price_status: { type: "string", enum: [...PRICE_STATUSES] },
    haul_away: { type: "string", enum: [...INCLUSION_STATUSES] },
    cleanup: { type: "string", enum: [...INCLUSION_STATUSES] },
    stump_grinding: { type: "string", enum: [...INCLUSION_STATUSES] },
    wood_handling: { type: "string", enum: [...WOOD_HANDLING_STATUSES] },
    evidence: stringSchema,
  },
};

const safetyAccessNoteSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "evidence"],
  properties: {
    type: { type: "string", enum: [...SAFETY_NOTE_TYPES] },
    evidence: stringSchema,
  },
};

const lowConfidenceSpanSchema = {
  type: "object",
  additionalProperties: false,
  required: ["field", "text", "reason", "confidence"],
  properties: {
    field: stringSchema,
    text: stringSchema,
    reason: stringSchema,
    confidence: { type: "string", enum: [...CONFIDENCE_STATUSES] },
  },
};

const numberTraceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["raw", "normalized", "classification", "field", "reason", "context"],
  properties: {
    raw: stringSchema,
    normalized: stringSchema,
    classification: { type: "string", enum: [...NUMBER_TRACE_CLASSIFICATIONS] },
    field: stringSchema,
    reason: stringSchema,
    context: stringSchema,
  },
};

export const OPENAI_DRAFT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "draft_version",
    "raw_input",
    "contact",
    "job",
    "options",
    "safety_access_notes",
    "low_confidence_spans",
    "number_trace",
    "normalization",
  ],
  properties: {
    draft_version: { type: "string", enum: [DRAFT_VERSION] },
    raw_input: {
      type: "object",
      additionalProperties: false,
      required: ["customer_text"],
      properties: {
        customer_text: stringSchema,
      },
    },
    contact: {
      type: "object",
      additionalProperties: false,
      required: ["customer_name", "phone", "email", "service_address"],
      properties: {
        customer_name: stringSchema,
        phone: stringSchema,
        email: stringSchema,
        service_address: stringSchema,
      },
    },
    job: {
      type: "object",
      additionalProperties: false,
      required: [
        "tree_count",
        "tree_count_status",
        "tree_type",
        "tree_size",
        "work_action",
        "work_scope",
        "location_on_property",
      ],
      properties: {
        tree_count: stringSchema,
        tree_count_status: { type: "string", enum: [...TREE_COUNT_STATUSES] },
        tree_type: stringSchema,
        tree_size: stringSchema,
        work_action: { type: "string", enum: [...WORK_ACTIONS] },
        work_scope: stringSchema,
        location_on_property: stringSchema,
      },
    },
    options: {
      type: "array",
      items: optionSchema,
    },
    safety_access_notes: {
      type: "array",
      items: safetyAccessNoteSchema,
    },
    low_confidence_spans: {
      type: "array",
      items: lowConfidenceSpanSchema,
    },
    number_trace: {
      type: "array",
      items: numberTraceSchema,
    },
    normalization: {
      type: "object",
      additionalProperties: false,
      required: ["corrections_made", "uncertainties", "field_evidence"],
      properties: {
        corrections_made: {
          type: "array",
          items: correctionSchema,
        },
        uncertainties: {
          type: "array",
          items: uncertaintySchema,
        },
        field_evidence: {
          type: "object",
          additionalProperties: false,
          required: [
            "customer_name",
            "phone",
            "email",
            "service_address",
            "tree_count",
            "tree_type",
            "work_scope",
            "haul_away",
            "cleanup",
            "stump",
            "price",
            "options",
          ],
          properties: {
            customer_name: stringSchema,
            phone: stringSchema,
            email: stringSchema,
            service_address: stringSchema,
            tree_count: stringSchema,
            tree_type: stringSchema,
            work_scope: stringSchema,
            haul_away: stringSchema,
            cleanup: stringSchema,
            stump: stringSchema,
            price: stringSchema,
            options: stringSchema,
          },
        },
      },
    },
  },
};

export const OPENAI_DRAFT_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "alpha_tree_extraction_draft",
    strict: true,
    schema: OPENAI_DRAFT_JSON_SCHEMA,
  },
};

const DraftRootSchema = z
  .object({
    draft_version: z.literal(DRAFT_VERSION),
    raw_input: z.object({ customer_text: z.string() }).passthrough(),
  })
  .passthrough();

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value, path, warnings) {
  if (Array.isArray(value)) return value;
  if (value != null) warnings.push(`${path} was not an array and was replaced with [].`);
  return [];
}

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function asNumberOrNull(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = asString(value);
  if (!text) return null;
  const amount = Number(text.replace(/[$,\s]/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function enumValue(value, allowed, fallback, path, warnings) {
  const text = asString(value);
  if (allowed.has(text)) return text;
  if (text) warnings.push(`${path} used invalid status "${text}" and was replaced with "${fallback}".`);
  return fallback;
}

function fallbackDraft(customerText = "") {
  return {
    draft_version: DRAFT_VERSION,
    raw_input: { customer_text: asString(customerText) },
    contact: {
      customer_name: "",
      phone: "",
      email: "",
      service_address: "",
    },
    job: {
      tree_count: "",
      tree_count_status: "missing",
      tree_type: "",
      tree_size: "",
      work_action: "unclear",
      work_scope: "",
      location_on_property: "",
    },
    options: [],
    safety_access_notes: [],
    low_confidence_spans: [],
    number_trace: [],
    normalization: {
      corrections_made: [],
      uncertainties: [],
      field_evidence: {
        customer_name: "",
        phone: "",
        email: "",
        service_address: "",
        tree_count: "",
        tree_type: "",
        work_scope: "",
        haul_away: "",
        cleanup: "",
        stump: "",
        price: "",
        options: "",
      },
    },
  };
}

function sanitizeCorrection(item) {
  const value = asObject(item);
  return {
    original: asString(value.original),
    corrected: asString(value.corrected),
    reason: asString(value.reason),
  };
}

function sanitizeUncertainty(item) {
  const value = asObject(item);
  return {
    field: asString(value.field),
    issue: asString(value.issue),
    evidence: asString(value.evidence),
  };
}

function sanitizeFieldEvidence(value) {
  const source = asObject(value);
  return {
    customer_name: asString(source.customer_name),
    phone: asString(source.phone),
    email: asString(source.email),
    service_address: asString(source.service_address),
    tree_count: asString(source.tree_count),
    tree_type: asString(source.tree_type),
    work_scope: asString(source.work_scope),
    haul_away: asString(source.haul_away),
    cleanup: asString(source.cleanup),
    stump: asString(source.stump),
    price: asString(source.price),
    options: asString(source.options),
  };
}

function sanitizeOption(item, index, warnings) {
  const option = asObject(item);
  return {
    raw_label: asString(option.raw_label),
    raw_text: asString(option.raw_text),
    scope: asString(option.scope),
    price_raw: asString(option.price_raw),
    price_amount: asNumberOrNull(option.price_amount),
    price_status: enumValue(option.price_status, PRICE_STATUSES, option.price_raw ? "unclear" : "missing", `options[${index}].price_status`, warnings),
    haul_away: enumValue(option.haul_away, INCLUSION_STATUSES, "not_stated", `options[${index}].haul_away`, warnings),
    cleanup: enumValue(option.cleanup, INCLUSION_STATUSES, "not_stated", `options[${index}].cleanup`, warnings),
    stump_grinding: enumValue(option.stump_grinding, INCLUSION_STATUSES, "not_stated", `options[${index}].stump_grinding`, warnings),
    wood_handling: enumValue(option.wood_handling, WOOD_HANDLING_STATUSES, "not_stated", `options[${index}].wood_handling`, warnings),
    evidence: asString(option.evidence),
  };
}

function sanitizeSafetyNote(item, index, warnings) {
  const note = asObject(item);
  return {
    type: enumValue(note.type, SAFETY_NOTE_TYPES, "other", `safety_access_notes[${index}].type`, warnings),
    evidence: asString(note.evidence),
  };
}

function sanitizeLowConfidenceSpan(item, index, warnings) {
  const span = asObject(item);
  return {
    field: asString(span.field),
    text: asString(span.text),
    reason: asString(span.reason),
    confidence: enumValue(span.confidence, CONFIDENCE_STATUSES, "unknown", `low_confidence_spans[${index}].confidence`, warnings),
  };
}

function sanitizeNumberTrace(item, index, warnings) {
  const trace = asObject(item);
  return {
    raw: asString(trace.raw),
    normalized: asString(trace.normalized),
    classification: enumValue(trace.classification, NUMBER_TRACE_CLASSIFICATIONS, "other", `number_trace[${index}].classification`, warnings),
    field: asString(trace.field),
    reason: asString(trace.reason),
    context: asString(trace.context),
  };
}

function sanitizeDraft(rawJson, warnings) {
  const raw = asObject(rawJson);
  const job = asObject(raw.job);
  const normalization = asObject(raw.normalization);
  return {
    draft_version: DRAFT_VERSION,
    raw_input: {
      customer_text: asString(raw.raw_input?.customer_text),
    },
    contact: {
      customer_name: asString(raw.contact?.customer_name),
      phone: asString(raw.contact?.phone),
      email: asString(raw.contact?.email),
      service_address: asString(raw.contact?.service_address),
    },
    job: {
      tree_count: asString(job.tree_count),
      tree_count_status: enumValue(job.tree_count_status, TREE_COUNT_STATUSES, job.tree_count ? "found" : "missing", "job.tree_count_status", warnings),
      tree_type: asString(job.tree_type),
      tree_size: asString(job.tree_size),
      work_action: enumValue(job.work_action, WORK_ACTIONS, "unclear", "job.work_action", warnings),
      work_scope: asString(job.work_scope),
      location_on_property: asString(job.location_on_property),
    },
    options: asArray(raw.options, "options", warnings).map((option, index) => sanitizeOption(option, index, warnings)),
    safety_access_notes: asArray(raw.safety_access_notes, "safety_access_notes", warnings).map((note, index) =>
      sanitizeSafetyNote(note, index, warnings),
    ),
    low_confidence_spans: asArray(raw.low_confidence_spans, "low_confidence_spans", warnings)
      .map((span, index) => sanitizeLowConfidenceSpan(span, index, warnings))
      .filter((span) => span.field || span.text || span.reason),
    number_trace: asArray(raw.number_trace, "number_trace", warnings)
      .map((trace, index) => sanitizeNumberTrace(trace, index, warnings))
      .filter((trace) => trace.raw || trace.normalized || trace.context),
    normalization: {
      corrections_made: asArray(normalization.corrections_made, "normalization.corrections_made", warnings)
        .map(sanitizeCorrection)
        .filter((item) => item.original || item.corrected),
      uncertainties: asArray(normalization.uncertainties, "normalization.uncertainties", warnings)
        .map(sanitizeUncertainty)
        .filter((item) => item.field || item.issue || item.evidence),
      field_evidence: sanitizeFieldEvidence(normalization.field_evidence),
    },
  };
}

export function parseOpenAiDraft(rawJson) {
  const root = DraftRootSchema.safeParse(rawJson);
  if (!root.success) {
    const customerText = rawJson?.raw_input?.customer_text || rawJson?.alphaJson?.raw_input?.customer_text || "";
    return {
      ok: false,
      draft: fallbackDraft(customerText),
      warnings: [
        "OpenAI draft failed schema validation.",
        ...root.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`),
      ],
    };
  }

  const warnings = [];
  const draft = sanitizeDraft(root.data, warnings);
  return {
    ok: true,
    draft,
    warnings,
  };
}
