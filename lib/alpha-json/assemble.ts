// Assembles the AI extraction into a full AlphaJSON v1.4 estimate and runs the
// authoritative validation engine (blocking errors / warnings / follow-ups).
import { COMPANY } from "@/lib/constants"
import { OPTION_LABELS } from "@/lib/constants"
import type { Extraction } from "./schema"
import type { AlphaEstimate, LayoutFlags, ServiceOption, ValidationResult } from "./types"

function priceSortKey(o: Extraction["service_options"][number]): number {
  const p = o.price
  if (p.price_type === "fixed" && typeof p.amount === "number") return p.amount
  if (p.price_type === "range" && typeof p.min_amount === "number") return p.min_amount
  return Number.MAX_SAFE_INTEGER // unclear prices sink to the bottom
}

function isPlaceholder(value: string | null | undefined): boolean {
  if (!value) return true
  const v = value.trim().toLowerCase()
  return v === "" || v === "n/a" || v === "tbd" || v === "unknown" || v === "address" || v.includes("placeholder")
}

function formatDateDisplay(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "estimate"
  )
}

export function validate(
  options: ServiceOption[],
  serviceAddressDisplay: string | null,
  jobDescription: string,
): ValidationResult {
  const blocking_errors: string[] = []
  const warnings: string[] = []
  const unclear_prices: string[] = []
  const missing_required_fields: string[] = []
  const tree_dude_follow_ups: string[] = []

  if (isPlaceholder(serviceAddressDisplay)) {
    blocking_errors.push("Missing or placeholder service address.")
    missing_required_fields.push("job.service_address.display")
    tree_dude_follow_ups.push("What is the exact service address where the work will be performed?")
  }

  if (isPlaceholder(jobDescription)) {
    blocking_errors.push("Job description is missing or unclear.")
    missing_required_fields.push("job.description")
    tree_dude_follow_ups.push("Can you describe the work to be done?")
  }

  if (options.length < 1) {
    blocking_errors.push("At least one priced service option is required.")
    missing_required_fields.push("service_options.items")
  }

  options.forEach((o) => {
    const p = o.price
    if (p.is_unclear || p.price_type === "unknown" || !p.display) {
      unclear_prices.push(o.label)
      blocking_errors.push(`${o.label} ("${o.title}") has an unclear price.`)
      tree_dude_follow_ups.push(`What is the price for ${o.label}: "${o.title}"?`)
    }
    const numeric = priceSortKey(o)
    if (numeric !== Number.MAX_SAFE_INTEGER && numeric <= 0) {
      blocking_errors.push(`${o.label} has an invalid price (zero or negative).`)
    }
  })

  if (options.length > 4) {
    warnings.push(`There are ${options.length} options; only 4 (A–D) are supported. Extra options were dropped.`)
  }

  const can_generate_pdf = blocking_errors.length === 0

  let issue_status: ValidationResult["issue_status"] = "none"
  if (blocking_errors.length > 0) issue_status = "blocking error + tree dude follow-up"
  else if (warnings.length > 0 && tree_dude_follow_ups.length > 0) issue_status = "warning + tree dude follow-up"
  else if (warnings.length > 0) issue_status = "warning"

  return {
    can_generate_pdf,
    missing_required_fields,
    unclear_prices,
    warnings,
    blocking_errors,
    tree_dude_follow_ups,
    issue_status,
  }
}

export function assembleEstimate(extraction: Extraction, rawText: string): AlphaEstimate {
  const now = new Date()

  // Sort options by price (cheapest first), cap at 4, assign labels.
  const sorted = [...extraction.service_options].sort((a, b) => priceSortKey(a) - priceSortKey(b))
  const items: ServiceOption[] = sorted.slice(0, 4).map((o, i) => ({
    ...o,
    label: OPTION_LABELS[i],
    sort_order: i + 1,
  }))

  const customerName = (extraction.customer.name || "").trim()
  const longName = customerName.length > 30
  const displayName = longName ? customerName.slice(0, 30) : customerName

  const serviceDisplay = extraction.job.service_address.display
  const filenameBase = !isPlaceholder(serviceDisplay)
    ? slugify(serviceDisplay as string)
    : customerName
      ? slugify(customerName)
      : "estimate"

  const validation = validate(items, serviceDisplay, extraction.job.description)

  const longNotes = (extraction.notes.display_notes || "").length > 400
  const layout_flags: LayoutFlags = {
    option_count: items.length,
    over_normal_option_limit: extraction.service_options.length > 4,
    long_notes: longNotes,
    likely_two_page_pdf: longNotes && items.length >= 4,
    long_customer_name: longName,
    customer_name_truncated_for_display: longName,
  }

  const id = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.random()
    .toString(36)
    .slice(2, 8)}`

  return {
    id,
    schema_info: { schema_name: "AlphaJSON", schema_version: "1.4", purpose: "Estimate structure for Alpha Tree Service" },
    document: {
      document_type: "estimate_quote",
      title: "Estimate / Quote",
      number: `EST-${id}`,
      date_display: formatDateDisplay(now),
      output_filename_base: filenameBase,
    },
    company: { name: COMPANY.name, region: COMPANY.region, owner_name: COMPANY.ownerName, owner_phone: COMPANY.ownerPhone },
    customer: {
      name: customerName,
      display_name: displayName,
      phone_display: extraction.customer.phone_display || "",
      email: extraction.customer.email || "",
      address: extraction.customer.address,
    },
    job: {
      service_address: extraction.job.service_address,
      description: extraction.job.description,
      condition_details: extraction.job.condition_details,
      tree_details: extraction.job.tree_details,
      access_notes: extraction.job.access_notes,
      hazard_notes: extraction.job.hazard_notes,
      debris_notes: extraction.job.debris_notes,
      scheduling_notes: extraction.job.scheduling_notes,
    },
    service_options: { items },
    notes: extraction.notes,
    raw_input: { customer_text: rawText },
    validation,
    layout_flags,
    status: "draft",
    signing: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  }
}
