# Alpha Tree Service — JSON Schema Definition

## What OpenAI Should Output

This schema defines the **exact structure** that OpenAI must produce when converting messy user input into AlphaJSON v1.4. Codex will use this to validate OpenAI responses before proceeding to HTML/PDF.

---

## Root Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AlphaJSON v1.4",
  "type": "object",
  "required": [
    "schema_info",
    "metadata",
    "raw_input",
    "document",
    "company",
    "customer",
    "job",
    "service_options",
    "notes",
    "review",
    "validation",
    "layout_flags"
  ],
  "properties": {
    
    "schema_info": {
      "type": "object",
      "required": ["schema_name", "schema_version", "purpose"],
      "properties": {
        "schema_name": { "type": "string", "const": "AlphaJSON" },
        "schema_version": { "type": "string", "const": "1.4" },
        "purpose": { "type": "string" },
        "default_document_type": { "type": "string", "enum": ["estimate_quote", "invoice", "receipt", "work_order"] },
        "template_file": { "type": "string" },
        "stylesheet_file": { "type": "string" },
        "last_schema_change": { "type": "string" }
      }
    },

    "metadata": {
      "type": "object",
      "properties": {
        "created_by": { "type": "string", "maxLength": 100 },
        "created_at": { "type": "string", "format": "date-time" },
        "last_updated_at": { "type": "string", "format": "date-time" },
        "input_source": { "type": "string", "enum": ["web_form", "email", "phone", "chat", "other"] },
        "raw_input_summary": { "type": "string" },
        "processing_status": { "type": "string", "enum": ["draft", "validated", "approved", "generated"] }
      }
    },

    "raw_input": {
      "type": "object",
      "required": ["customer_text"],
      "properties": {
        "customer_text": { "type": "string", "description": "Preserve exact messy input as received" },
        "received_at": { "type": "string", "format": "date-time" },
        "entered_by": { "type": "string" },
        "source": { "type": "string" },
        "source_file_or_message_id": { "type": "string" },
        "raw_input_preserved_exactly": { "type": "boolean", "const": true }
      }
    },

    "document": {
      "type": "object",
      "required": ["document_type", "title", "date_display"],
      "properties": {
        "document_type": {
          "type": "string",
          "enum": ["estimate_quote", "invoice", "receipt", "work_order"],
          "description": "Default: estimate_quote"
        },
        "title": {
          "type": "string",
          "description": "Display title (e.g., 'Estimate / Quote')"
        },
        "number": {
          "type": "string",
          "description": "Optional document number (can be blank)"
        },
        "date": {
          "type": "string",
          "format": "date"
        },
        "date_display": {
          "type": "string",
          "description": "Human format: 'June 28, 2026'"
        },
        "expiration_date": {
          "type": "string",
          "format": "date"
        },
        "status": {
          "type": "string",
          "enum": ["draft", "approved", "signed", "archived"]
        },
        "output_filename_base": {
          "type": "string",
          "description": "e.g., '805-2nd-street' or 'john-doe'"
        },
        "approved_for_pdf": {
          "type": "boolean"
        }
      }
    },

    "company": {
      "type": "object",
      "required": ["name", "owner_name", "owner_phone"],
      "properties": {
        "name": { "type": "string", "const": "Alpha Tree Service" },
        "region": { "type": "string", "const": "Southeastern Indiana" },
        "owner_label": { "type": "string" },
        "owner_name": { "type": "string", "const": "William \"Billy\" Gunter" },
        "owner_phone": { "type": "string", "const": "812-599-6587" },
        "logo_alt_text": { "type": "string" },
        "footer_text": { "type": "string" }
      }
    },

    "customer": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "maxLength": 100,
          "description": "Optional (can be blank)"
        },
        "phone_primary": {
          "type": "string",
          "description": "Cleaned phone number or empty string"
        },
        "phone_secondary": {
          "type": "string"
        },
        "phone_alternate_notes": {
          "type": "string",
          "description": "e.g., 'call spouse first' when no direct number"
        },
        "phone_display": {
          "type": "string",
          "description": "Formatted for display (can be empty)"
        },
        "email": {
          "type": "string",
          "format": "email"
        },
        "address": {
          "type": "object",
          "properties": {
            "line1": { "type": "string" },
            "line2": { "type": "string" },
            "city": { "type": "string" },
            "state": { "type": "string" },
            "zip": { "type": "string" },
            "display": { "type": "string", "description": "Formatted for display" }
          }
        },
        "billing_address": {
          "type": "object",
          "properties": {
            "same_as_customer_address": { "type": "boolean" },
            "line1": { "type": "string" },
            "line2": { "type": "string" },
            "city": { "type": "string" },
            "state": { "type": "string" },
            "zip": { "type": "string" },
            "display": { "type": "string" }
          }
        },
        "display_name": {
          "type": "string",
          "maxLength": 30,
          "description": "Truncated customer name for layout safety"
        }
      }
    },

    "job": {
      "type": "object",
      "required": ["description"],
      "properties": {
        "service_address": {
          "type": "object",
          "required": ["display"],
          "properties": {
            "same_as_customer_address": { "type": "boolean" },
            "line1": { "type": "string" },
            "line2": { "type": "string" },
            "city": { "type": "string" },
            "state": { "type": "string" },
            "zip": { "type": "string" },
            "display": {
              "type": "string",
              "description": "Required: must be real address, not placeholder"
            }
          }
        },
        "location_notes": { "type": "string" },
        "description": {
          "type": "string",
          "description": "Required: what work is being quoted"
        },
        "condition_details": { "type": "string" },
        "tree_details": {
          "type": "object",
          "properties": {
            "tree_count": { "type": "string" },
            "tree_type": { "type": "string" },
            "tree_size": { "type": "string" },
            "tree_status": { "type": "string" },
            "fallen_on_structure": { "type": "boolean" },
            "near_power_lines": { "type": "boolean" },
            "stump_included": { "type": "boolean" }
          }
        },
        "access_notes": { "type": "string" },
        "hazard_notes": { "type": "string" },
        "pet_notes": { "type": "string" },
        "storm_or_urgency_notes": { "type": "string" },
        "cleanup_notes": { "type": "string" },
        "debris_notes": { "type": "string" },
        "scheduling_notes": { "type": "string" }
      }
    },

    "service_options": {
      "type": "object",
      "required": ["items"],
      "properties": {
        "max_normal_options": { "type": "integer", "const": 4 },
        "items": {
          "type": "array",
          "minItems": 1,
          "description": "At least 1 priced option required",
          "items": {
            "type": "object",
            "required": ["title", "description", "price"],
            "properties": {
              "label": {
                "type": "string",
                "enum": ["", "Option A", "Option B", "Option C", "Option D"],
                "description": "Assigned after sorting by price"
              },
              "sort_order": {
                "type": "integer",
                "description": "1=cheapest, 2, 3, 4=most expensive"
              },
              "title": {
                "type": "string",
                "description": "Option name/service title"
              },
              "description": {
                "type": "string",
                "description": "What's included in this option"
              },
              "price": {
                "type": "object",
                "required": ["currency", "display"],
                "properties": {
                  "price_type": {
                    "type": "string",
                    "enum": ["fixed", "range", "unknown"]
                  },
                  "currency": { "type": "string", "const": "USD" },
                  "amount": {
                    "type": ["number", "null"],
                    "description": "For fixed prices: numeric amount"
                  },
                  "min_amount": {
                    "type": ["number", "null"],
                    "description": "For ranges: minimum"
                  },
                  "max_amount": {
                    "type": ["number", "null"],
                    "description": "For ranges: maximum"
                  },
                  "display": {
                    "type": "string",
                    "description": "Display format: '$2,000' or '$2,000–$3,000'"
                  },
                  "is_range": { "type": "boolean" },
                  "is_unclear": { "type": "boolean", "description": "Blocking flag" }
                }
              },
              "debris_handling": { "type": "string" },
              "included_work": { "type": "string" },
              "excluded_work": { "type": "string" },
              "option_notes": { "type": "string" }
            }
          }
        }
      }
    },

    "notes": {
      "type": "object",
      "properties": {
        "display_notes": {
          "type": "string",
          "description": "Customer-visible notes (debris, cleanup, timing, payment)"
        },
        "crew_visit_notes": {
          "type": "string",
          "description": "Internal crew instructions (gate, dog, parking, hazards)"
        },
        "crew_visit_notes_visibility": {
          "type": "string",
          "enum": ["internal_by_default", "customer_visible_if_approved"]
        },
        "customer_notes": { "type": "string" },
        "contractor_notes": { "type": "string" },
        "payment_terms": { "type": "string" },
        "deposit": { "type": "string" },
        "balance_due": { "type": "string" },
        "timing_notes": { "type": "string" },
        "additional_work_disclaimer": { "type": "string" },
        "internal_notes_not_for_pdf": { "type": "string" }
      }
    },

    "review": {
      "type": "object",
      "properties": {
        "review_required": { "type": "boolean", "const": true },
        "review_completed": { "type": "boolean" },
        "review_summary": { "type": "string" },
        "user_approval_text": { "type": "string" },
        "approved_for_pdf": { "type": "boolean" }
      }
    },

    "validation": {
      "type": "object",
      "properties": {
        "can_generate_pdf": {
          "type": "boolean",
          "description": "True only if no blocking_errors AND approved_for_pdf=true"
        },
        "missing_required_fields": {
          "type": "array",
          "items": { "type": "string" },
          "description": "List of missing required fields"
        },
        "missing_optional_fields": {
          "type": "array",
          "items": { "type": "string" }
        },
        "unclear_fields": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Fields with ambiguous data"
        },
        "unclear_prices": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Options with unclear pricing"
        },
        "warnings": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Non-blocking issues (layout, missing phone, etc.)"
        },
        "blocking_errors": {
          "type": "array",
          "items": { "type": "string" },
          "description": "MUST be fixed before PDF generation"
        },
        "validation_notes": { "type": "string" },
        "tree_dude_follow_ups": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Specific questions for human confirmation"
        },
        "blocking_errors_require_follow_up": { "type": "boolean", "const": true },
        "issue_status": {
          "type": "string",
          "enum": [
            "none",
            "warning",
            "warning + tree dude follow-up",
            "blocking error + tree dude follow-up"
          ]
        }
      }
    },

    "layout_flags": {
      "type": "object",
      "properties": {
        "option_count": { "type": "integer" },
        "over_normal_option_limit": { "type": "boolean" },
        "long_option_text": { "type": "boolean" },
        "long_price_display": { "type": "boolean" },
        "long_notes": { "type": "boolean" },
        "likely_two_page_pdf": { "type": "boolean" },
        "needs_consolidation_warning": { "type": "boolean" },
        "long_customer_name": { "type": "boolean" },
        "customer_name_truncated_for_display": { "type": "boolean" }
      }
    }
  }
}
```

---

## HTML Template Bindings

OpenAI must output JSON values that match these **exact field paths**. Codex will use these bindings to fill the HTML template.

| HTML Placeholder | JSON Path | Required? | Example |
|---|---|---|---|
| `{{document.title}}` | `document.title` | YES | "Estimate / Quote" |
| `{{customer.name}}` | `customer.name` | NO | "John Smith" or "" |
| `{{customer.address.display}}` | `customer.address.display` | NO | "123 Main St, Anytown, IN 46001" or "" |
| `{{customer.phone_display}}` | `customer.phone_display` | NO | "(555) 123-4567" or "" |
| `{{document.number}}` | `document.number` | NO | "EST-20260628-001" or "" |
| `{{document.date_display}}` | `document.date_display` | YES | "June 28, 2026" |
| `{{job.service_address.display}}` | `job.service_address.display` | YES | "805 2nd Street, Anytown, IN 46001" |
| `{{job.description}}` | `job.description` | YES | "Remove three oak trees from property..." |
| `{{job.condition_details}}` | `job.condition_details` | NO | "Trees diseased, one leaning toward house" |
| `{{service_options_html}}` | Generated from `service_options.items[]` | YES | `<div class="option-card">...</div>` |
| `{{notes.display_notes}}` | `notes.display_notes` | NO | "Debris will be chipped and removed" |
| `{{customer.display_name}}` | `customer.display_name` (max 30 chars) | NO | "John Smith" (fallback: `customer.name`) |

---

## Validation Rules OpenAI Must Follow

| Rule | Check | Action |
|------|-------|--------|
| **Required Fields** | `document.date_display`, `job.service_address.display`, `job.description`, ≥1 option with price | BLOCKING if missing |
| **Job Location** | Not placeholder, not blank, not ambiguous | BLOCKING if unclear |
| **Service Options** | Each option has matched title, description, price | BLOCKING if unmatched |
| **Price Format** | `$2,000` or `$2,000–$3,000` (compact range) | Reject `$2,000 to $3,000` |
| **Option Count** | 1-4 options (normal), 5+ = layout warning | WARNING if 5+ |
| **Customer Name** | Truncate to 30 chars for display | Set flag if truncated |
| **Address Fields** | Keep customer & service addresses separate | ERROR if merged |
| **Debris Notes** | No conflicting instructions per option | BLOCKING if conflict |

---

## Blocking Errors (Stop Before PDF)

OpenAI MUST set `blocking_errors[]` and `tree_dude_follow_ups[]` if ANY of these occur:

1. No service address (or placeholder address)
2. Job description missing or unclear
3. No priced service option
4. Option/price mismatch (unclear which price goes with which option)
5. Option missing price display
6. Invalid/suspicious price (zero, negative, "free", extreme outlier)
7. Unmatched debris instructions (conflicting scope/price)
8. Ambiguous job location (multiple addresses, unclear which is actual service location)

---

## Example Valid OpenAI Output

```json
{
  "schema_info": {
    "schema_name": "AlphaJSON",
    "schema_version": "1.4",
    "purpose": "Estimate structure for Alpha Tree Service"
  },
  "metadata": {
    "created_by": "OpenAI",
    "input_source": "web_form",
    "processing_status": "validated"
  },
  "raw_input": {
    "customer_text": "Customer: john smith 555-1234 123 main st job: 3 big oak trees at 805 2nd street need to remove asap. option 1: just cut and haul $2000. option 2: stump grind too $2800. option 3: chip debris $3200",
    "raw_input_preserved_exactly": true
  },
  "document": {
    "document_type": "estimate_quote",
    "title": "Estimate / Quote",
    "number": "",
    "date_display": "June 28, 2026",
    "output_filename_base": "805-2nd-street",
    "approved_for_pdf": false
  },
  "company": {
    "name": "Alpha Tree Service",
    "owner_name": "William \"Billy\" Gunter",
    "owner_phone": "812-599-6587"
  },
  "customer": {
    "name": "John Smith",
    "phone_primary": "(555) 123-4567",
    "phone_display": "(555) 123-4567",
    "address": {
      "line1": "123 Main St",
      "city": "Anytown",
      "state": "IN",
      "display": "123 Main St, Anytown, IN"
    },
    "display_name": "John Smith"
  },
  "job": {
    "service_address": {
      "same_as_customer_address": false,
      "line1": "805 2nd Street",
      "city": "Anytown",
      "state": "IN",
      "display": "805 2nd Street, Anytown, IN"
    },
    "description": "Remove three oak trees from property",
    "condition_details": "Trees are large (40-50 ft) and diseased",
    "tree_details": {
      "tree_count": "3",
      "tree_type": "Oak",
      "tree_size": "40-50 ft"
    },
    "debris_notes": "Debris handling per option selected"
  },
  "service_options": {
    "items": [
      {
        "label": "Option A",
        "sort_order": 1,
        "title": "Cut and Remove",
        "description": "Cut trees down and haul all debris away",
        "price": {
          "price_type": "fixed",
          "currency": "USD",
          "amount": 2000,
          "display": "$2,000",
          "is_range": false
        }
      },
      {
        "label": "Option B",
        "sort_order": 2,
        "title": "Remove + Stump Grind",
        "description": "Cut trees down, haul debris, and grind stumps",
        "price": {
          "price_type": "fixed",
          "currency": "USD",
          "amount": 2800,
          "display": "$2,800",
          "is_range": false
        }
      },
      {
        "label": "Option C",
        "sort_order": 3,
        "title": "Remove + Chip Debris",
        "description": "Cut trees down, chip all debris for mulch",
        "price": {
          "price_type": "fixed",
          "currency": "USD",
          "amount": 3200,
          "display": "$3,200",
          "is_range": false
        }
      }
    ]
  },
  "notes": {
    "display_notes": "Urgent request. Trees are diseased and pose hazard to property.",
    "crew_visit_notes": "Call John first (555-1234). Gate locked; key under mat. Dog in back yard, secure before entering."
  },
  "review": {
    "review_required": true,
    "review_completed": false,
    "approved_for_pdf": false
  },
  "validation": {
    "can_generate_pdf": true,
    "missing_required_fields": [],
    "missing_optional_fields": [],
    "blocking_errors": [],
    "warnings": [],
    "tree_dude_follow_ups": [],
    "issue_status": "none"
  },
  "layout_flags": {
    "option_count": 3,
    "over_normal_option_limit": false,
    "likely_two_page_pdf": false
  }
}
```

---

## Notes for Codex Implementation

1. **Validate every OpenAI response** against this schema before proceeding
2. **Reject incomplete responses** that leave required fields blank
3. **Check blocking_errors first** — stop before HTML/PDF if any exist
4. **Price format must be display-ready** — no "$2000 to $3000", only "$2,000–$3,000"
5. **Option labels auto-assign** after sorting — preserve sort_order from OpenAI
6. **Service address is required** — cannot be blank, placeholder, or ambiguous
7. **All dates use "Month Day, Year" format** — e.g., "June 28, 2026"
