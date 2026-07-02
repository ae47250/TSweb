import { z } from "zod";

const DRAFT_VERSION = "alpha_extraction_v1";
const TREE_COUNT_STATUSES = new Set(["found", "missing", "vague", "uncertain"]);
const WORK_ACTIONS = new Set(["remove", "trim", "haul", "cleanup", "stump_grind", "other", "unclear"]);
const PRICE_STATUSES = new Set(["firm", "range", "non_firm", "missing", "unclear"]);
const INCLUSION_STATUSES = new Set(["included", "excluded", "unclear", "not_stated"]);
const WOOD_HANDLING_STATUSES = new Set(["leave", "stack", "haul", "unclear", "not_stated"]);
const SAFETY_NOTE_TYPES = new Set(["power_lines", "dog", "gate", "access", "emergency", "fence", "other"]);

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
