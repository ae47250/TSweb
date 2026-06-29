// The full persisted AlphaJSON v1.4 estimate record (assembled server-side),
// plus signing state used by the customer-facing flow.
import type { Address, ExtractedOption } from "./schema"

export type OptionLabel = "Option A" | "Option B" | "Option C" | "Option D"

export interface ServiceOption extends ExtractedOption {
  label: OptionLabel
  sort_order: number // 1 = cheapest
}

export interface ValidationResult {
  can_generate_pdf: boolean
  missing_required_fields: string[]
  unclear_prices: string[]
  warnings: string[]
  blocking_errors: string[]
  tree_dude_follow_ups: string[]
  issue_status: "none" | "warning" | "warning + tree dude follow-up" | "blocking error + tree dude follow-up"
}

export interface LayoutFlags {
  option_count: number
  over_normal_option_limit: boolean
  long_notes: boolean
  likely_two_page_pdf: boolean
  long_customer_name: boolean
  customer_name_truncated_for_display: boolean
}

export type EstimateStatus = "draft" | "sent" | "signed"

export interface SigningState {
  selected_option_label: OptionLabel
  signature_name: string
  signature_date: string // ISO
  signed_pdf_url: string | null
}

export interface AlphaEstimate {
  id: string
  schema_info: { schema_name: "AlphaJSON"; schema_version: "1.4"; purpose: string }
  document: {
    document_type: "estimate_quote"
    title: string
    number: string
    date_display: string
    output_filename_base: string
  }
  company: { name: string; region: string; owner_name: string; owner_phone: string }
  customer: {
    name: string
    display_name: string
    phone_display: string
    email: string
    address: Address
  }
  job: {
    service_address: Address
    description: string
    condition_details: string | null
    tree_details: {
      tree_count: string | null
      tree_type: string | null
      tree_size: string | null
      near_power_lines: boolean | null
      stump_included: boolean | null
    }
    access_notes: string | null
    hazard_notes: string | null
    debris_notes: string | null
    scheduling_notes: string | null
  }
  service_options: { items: ServiceOption[] }
  notes: { display_notes: string | null; crew_visit_notes: string | null; payment_terms: string | null }
  raw_input: { customer_text: string }
  validation: ValidationResult
  layout_flags: LayoutFlags
  status: EstimateStatus
  signing: SigningState | null
  created_at: string
  updated_at: string
}
