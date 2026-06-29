// AI extraction schema for AlphaJSON v1.4.
// This is the shape OpenAI must return when structuring messy input.
// Optional fields use .nullable() (NOT .optional()) for OpenAI strict-mode compatibility.
import * as z from "zod"

export const addressSchema = z.object({
  line1: z.string().nullable(),
  line2: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  display: z.string().nullable().describe("Single formatted address line, or null if unknown"),
})

export const priceSchema = z.object({
  price_type: z.enum(["fixed", "range", "unknown"]),
  amount: z.number().nullable().describe("Numeric amount for fixed prices"),
  min_amount: z.number().nullable().describe("Minimum for ranges"),
  max_amount: z.number().nullable().describe("Maximum for ranges"),
  display: z.string().describe("Compact display, e.g. '$2,000' or '$2,000–$3,000'"),
  is_range: z.boolean(),
  is_unclear: z.boolean().describe("True if the price could not be confidently determined"),
})

export const optionSchema = z.object({
  title: z.string().describe("Short option name, e.g. 'Remove + Stump Grind'"),
  description: z.string().describe("What is included in this option"),
  price: priceSchema,
  debris_handling: z.string().nullable(),
})

export const extractionSchema = z.object({
  customer: z.object({
    name: z.string().nullable(),
    phone_display: z.string().nullable().describe("Formatted phone, e.g. '(555) 123-4567'"),
    email: z.string().nullable(),
    address: addressSchema,
  }),
  job: z.object({
    service_address: addressSchema.describe("Where the work happens — required, must be a real address"),
    description: z.string().describe("What work is being quoted"),
    condition_details: z.string().nullable(),
    tree_details: z.object({
      tree_count: z.string().nullable(),
      tree_type: z.string().nullable(),
      tree_size: z.string().nullable(),
      near_power_lines: z.boolean().nullable(),
      stump_included: z.boolean().nullable(),
    }),
    access_notes: z.string().nullable(),
    hazard_notes: z.string().nullable(),
    debris_notes: z.string().nullable(),
    scheduling_notes: z.string().nullable(),
  }),
  service_options: z
    .array(optionSchema)
    .min(1)
    .describe("At least one priced option. Cheapest first."),
  notes: z.object({
    display_notes: z.string().nullable().describe("Customer-visible notes (timing, payment, cleanup)"),
    crew_visit_notes: z.string().nullable().describe("Internal crew instructions (gate, dog, parking)"),
    payment_terms: z.string().nullable(),
  }),
})

export type Extraction = z.infer<typeof extractionSchema>
export type ExtractedOption = z.infer<typeof optionSchema>
export type Price = z.infer<typeof priceSchema>
export type Address = z.infer<typeof addressSchema>
