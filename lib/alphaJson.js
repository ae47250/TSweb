import { formatDisplayDate, generateDocumentId } from "./metadata.js";

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parsePrice(text) {
  const match = String(text).match(/\$\s*([0-9][0-9,]*)/);
  if (!match) return null;
  return Number(match[1].replaceAll(",", ""));
}

function money(amount) {
  return amount ? `$${amount.toLocaleString("en-US")}` : "";
}

export function emptyNormalization() {
  return {
    corrected_interpretation: "",
    corrections_made: [],
    uncertainties: [],
    field_evidence: {},
  };
}

function extractOptions(text) {
  const optionLines = String(text)
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter((line) => /\$|option|remove|trim|stump|haul|chip/i.test(line));

  const priced = optionLines
    .map((line) => ({ line, amount: parsePrice(line) }))
    .filter((item) => item.amount)
    .sort((a, b) => a.amount - b.amount)
    .slice(0, 4);

  return priced.map((item, index) => ({
    label: `Option ${String.fromCharCode(65 + index)}`,
    sort_order: index + 1,
    title: item.line.replace(/\$?\s*[0-9][0-9,]*/, "").trim() || `Service Option ${String.fromCharCode(65 + index)}`,
    description: item.line,
    price: {
      price_type: "fixed",
      currency: "USD",
      amount: item.amount,
      min_amount: null,
      max_amount: null,
      display: money(item.amount),
      is_range: false,
      is_unclear: false,
    },
  }));
}

function extractPhone(text) {
  const match = String(text).match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  return match ? match[0] : "";
}

export function createDraftAlphaJson(customerText) {
  const now = new Date();
  const text = clean(customerText);
  const options = extractOptions(text);
  const phone = extractPhone(text);
  const documentId = generateDocumentId(now);
  const addressGuess = (text.match(/\b\d+\s+[^,\n]+?\b(?:street|st|road|rd|ave|avenue|drive|dr|lane|ln|way|court|ct)\b[^,\n]*/i) || [""])[0];

  return {
    schema_info: {
      schema_name: "AlphaJSON",
      schema_version: "1.4",
      purpose: "Estimate structure for Alpha Tree Service",
      default_document_type: "estimate_quote",
      template_file: "templates/AlphaTemplEST.html",
      stylesheet_file: "templates/style_updated.css",
    },
    metadata: {
      created_by: "TSweb",
      created_at: now.toISOString(),
      last_updated_at: now.toISOString(),
      input_source: "web_form",
      raw_input_summary: text.slice(0, 160),
      processing_status: "draft",
    },
    raw_input: {
      customer_text: text,
      received_at: now.toISOString(),
      entered_by: "business_user",
      source: "web_form",
      raw_input_preserved_exactly: true,
    },
    normalization: emptyNormalization(),
    document: {
      document_type: "estimate_quote",
      title: "Estimate / Quote",
      number: documentId,
      date: now.toISOString().slice(0, 10),
      date_display: formatDisplayDate(now),
      status: "draft",
      output_filename_base: documentId.toLowerCase(),
      approved_for_pdf: false,
    },
    company: {
      name: "Alpha Tree Service",
      region: "Southeastern Indiana",
      owner_label: "Owner",
      owner_name: "William \"Billy\" Gunter",
      owner_phone: "812-599-6587",
      logo_alt_text: "Alpha Tree Service",
      footer_text: "Professional tree service estimates",
    },
    customer: {
      name: "",
      phone_primary: phone,
      phone_display: phone,
      email: "",
      address: { display: "" },
      display_name: "",
    },
    job: {
      service_address: { same_as_customer_address: false, display: addressGuess },
      description: text,
      condition_details: "",
      tree_details: {
        tree_count: (text.match(/\b\d+\s+(?:tree|trees)\b/i) || [""])[0],
        tree_type: "",
        tree_size: "",
      },
      cleanup_notes: "",
      debris_notes: "",
      scheduling_notes: "",
    },
    service_options: {
      max_normal_options: 4,
      items: options,
    },
    notes: {
      display_notes: "",
      crew_visit_notes: "",
      crew_visit_notes_visibility: "internal_by_default",
      customer_notes: "",
      contractor_notes: "",
      payment_terms: "",
    },
    review: {
      review_required: true,
      review_completed: false,
      review_summary: "",
      user_approval_text: "",
      approved_for_pdf: false,
    },
    validation: {
      can_generate_pdf: false,
      missing_required_fields: [],
      missing_optional_fields: [],
      unclear_fields: [],
      unclear_prices: [],
      warnings: [],
      blocking_errors: [],
      validation_notes: "",
      tree_dude_follow_ups: [],
      blocking_errors_require_follow_up: true,
      issue_status: "none",
    },
    layout_flags: {
      option_count: options.length,
      over_normal_option_limit: options.length > 4,
      long_option_text: options.some((option) => option.description.length > 160),
      long_price_display: false,
      long_notes: text.length > 800,
      likely_two_page_pdf: text.length > 1200,
      needs_consolidation_warning: text.length > 1200,
      long_customer_name: false,
      customer_name_truncated_for_display: false,
    },
  };
}
