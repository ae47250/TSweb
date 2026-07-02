import { resolvePrice } from "./priceResolver.js";
import { resolveServiceAddress } from "./addressResolver.js";

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function optionDescription(option) {
  return asString(option.scope) || asString(option.raw_text) || asString(option.raw_label);
}

function optionTitle(option) {
  return asString(option.scope) || asString(option.raw_text) || "Quoted tree service";
}

function optionEvidence(option) {
  return asString(option.evidence) || asString(option.raw_text) || asString(option.scope);
}

function safetyEvidence(notes) {
  return notes.map((note) => asString(note.evidence)).filter(Boolean).join(" | ");
}

export function openAiDraftToNormalizerInput(draft, context = {}) {
  const rawInput = asString(context.rawInput) || asString(draft?.raw_input?.customer_text);
  const address = resolveServiceAddress({ intake: context.intake, draft, rawInput });
  const options = Array.isArray(draft?.options) ? draft.options : [];
  const safetyNotes = Array.isArray(draft?.safety_access_notes) ? draft.safety_access_notes : [];

  return {
    draft_version: draft?.draft_version || "alpha_extraction_v1",
    raw_input: {
      customer_text: asString(draft?.raw_input?.customer_text) || rawInput,
    },
    customer: {
      name: asString(draft?.contact?.customer_name),
      phone: asString(draft?.contact?.phone),
      email: asString(draft?.contact?.email),
      service_address: address.value,
    },
    job: {
      service_address: { display: address.value },
      description: asString(draft?.job?.work_scope),
      condition_details: asString(draft?.job?.location_on_property),
      tree_details: {
        tree_count: asString(draft?.job?.tree_count),
        tree_count_status: asString(draft?.job?.tree_count_status),
        tree_type: asString(draft?.job?.tree_type),
        tree_size: asString(draft?.job?.tree_size),
      },
      work_action: asString(draft?.job?.work_action),
    },
    service_options: {
      items: options.map((option) => {
        const resolvedPrice = resolvePrice({
          rawPrice: option.price_raw,
          optionText: option.raw_text || option.scope,
          rawText: rawInput,
        });
        const amount = option.price_status === "firm" ? option.price_amount ?? resolvedPrice.amount : null;
        return {
          raw_label: asString(option.raw_label),
          raw_text: asString(option.raw_text),
          evidence: optionEvidence(option),
          title: optionTitle(option),
          description: optionDescription(option),
          scope: asString(option.scope),
          price: {
            amount,
            display: amount ? resolvedPrice.display : "",
            raw: asString(option.price_raw),
            status: option.price_status || resolvedPrice.priceStatus,
            is_unclear: option.price_status !== "firm" || !amount,
          },
          price_status: option.price_status || resolvedPrice.priceStatus,
          haul_away: asString(option.haul_away),
          cleanup: asString(option.cleanup),
          stump_grinding: asString(option.stump_grinding),
          wood_handling: asString(option.wood_handling),
        };
      }),
    },
    notes: {
      crew_visit_notes: safetyEvidence(safetyNotes),
    },
    normalization: {
      corrected_interpretation: "",
      corrections_made: draft?.normalization?.corrections_made || [],
      uncertainties: [
        ...(draft?.normalization?.uncertainties || []),
        ...address.blockingIssues.map((issue) => ({
          field: "service_address",
          issue,
          evidence: address.evidence,
        })),
        ...options.flatMap((option) => {
          const resolvedPrice = resolvePrice({
            rawPrice: option.price_raw,
            optionText: option.raw_text || option.scope,
            rawText: rawInput,
          });
          return resolvedPrice.blockingIssues.map((issue) => ({
            field: "price",
            issue,
            evidence: resolvedPrice.evidence,
          }));
        }),
      ],
      field_evidence: {
        ...(draft?.normalization?.field_evidence || {}),
        customer_name: asString(draft?.normalization?.field_evidence?.customer_name) || asString(draft?.contact?.customer_name),
        phone: asString(draft?.normalization?.field_evidence?.phone) || asString(draft?.contact?.phone),
        email: asString(draft?.normalization?.field_evidence?.email) || asString(draft?.contact?.email),
        service_address: address.value || asString(draft?.normalization?.field_evidence?.service_address),
        tree_count: asString(draft?.normalization?.field_evidence?.tree_count) || asString(draft?.job?.tree_count),
        tree_type: asString(draft?.normalization?.field_evidence?.tree_type) || asString(draft?.job?.tree_type),
        work_scope: asString(draft?.normalization?.field_evidence?.work_scope) || asString(draft?.job?.work_scope),
        haul_away: asString(draft?.normalization?.field_evidence?.haul_away),
        cleanup: asString(draft?.normalization?.field_evidence?.cleanup),
        stump: asString(draft?.normalization?.field_evidence?.stump),
        price: options.map((option) => asString(option.price_raw)).filter(Boolean),
        options: options.map(optionEvidence).filter(Boolean),
      },
    },
  };
}
