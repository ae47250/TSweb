# Name Extraction Investigation

## 1. Executive Summary

This document covers only customer/person-name extraction in the current local TSweb pipeline.

Bottom line:

- Name extraction is not handled by one isolated "name normalizer." It is split across pre-AI text cleanup, OpenAI draft extraction, and final AlphaJSON normalization.
- The final production authority is `normalizeToAlphaJsonV14()` in `lib/normalizeAlphaJson.js`.
- The strongest deterministic name logic is `cleanCustomerName()`, `extractNameFromRaw()`, and `firstCleanCustomerName()` in `lib/normalizeAlphaJson.js`.
- The pre-AI handoff also has name extraction in `extractCustomerName()` and `coherentNoteNormalizer()` in `lib/textCleanupNormalizer.js`.
- There is no explicit numeric name confidence score. Name confidence is inferred from source priority, regex match order, OpenAI uncertainty fields, and validation warnings.
- Contact sidecars currently strengthen phone/email extraction, but they do not directly run a separate name extractor. Email-derived name hints are used later in `normalizeAlphaJson.js`.
- A typed UI name, when present, has highest priority over model and raw-text extraction.
- Validation does not block PDF generation for missing or messy names. It only warns when the final name looks messy.

## 2. Files and Functions Involved

Top production files:

| File | Main functions/areas | Role |
| --- | --- | --- |
| `lib/normalizeAlphaJson.js` | `normalizeToAlphaJsonV14()`, `extractNameFromRaw()`, `cleanCustomerName()`, `firstCleanCustomerName()`, `extractEmailNameHint()`, `orderNameUsingEmailHint()` | Final name selection, cleanup, fallback extraction, email-hint ordering |
| `lib/textCleanupNormalizer.js` | `extractCustomerName()`, `stripNameNoise()`, `coherentNoteNormalizer()`, `buildEvidenceBackedCoherentNote()`, `customerWithAlias()` | Pre-AI name evidence extraction and coherent parser handoff text |
| `app/api/openai/route.js` | `POST()` parser orchestration | Runs pre-normalizers, calls OpenAI, normalizes final AlphaJSON, applies overlays |
| `lib/openaiPrompt.js` | `OPENAI_SYSTEM_PROMPT` | Tells the model to output `contact.customer_name` and `normalization.field_evidence.customer_name` |
| `lib/openaiDraftSchema.js` | `OPENAI_DRAFT_JSON_SCHEMA`, `sanitizeDraft()`, `sanitizeFieldEvidence()` | Requires and sanitizes draft name fields from OpenAI |
| `lib/openaiDraftAdapter.js` | `openAiDraftToNormalizerInput()` | Maps draft `contact.customer_name` into canonical normalizer input |
| `lib/validateJson.js` | `looksLikeMessyName()`, `validateAlphaJson()` | Warns on suspicious final customer names |
| `lib/alphaJson.js` | `createDraftAlphaJson()` | Initializes blank `customer.name` and `customer.display_name` |
| `app/components/InputForm.jsx` | `Customer name` input and submit assembly | User-typed name source |

Test and benchmark files:

| File | Name-related role |
| --- | --- |
| `tests/normalizeAlphaJson.test.js` | Main name extraction, cleanup, rejection, and uncertainty tests |
| `tests/openaiExtractionBoundary.test.js` | Draft-adapter and legacy-output boundary tests |
| `tests/alpha-cohort-RULES-simulation.test.js` | Counts `parser_name` mismatches against expected `customer_name` |
| `tests/fixtures/alpha-*.json` | Expected `customer_name` fixture data and historical `parser_name` failure labels |
| `reports/alpha-metrics-report.md` | Current aggregate report includes `parser_name` failures |

## 3. End-to-End Name Extraction Flow

Current route order in `app/api/openai/route.js`:

1. Read `customer_text` and optional structured `intake`.
2. If TD1 pre-normalizers are enabled:
   - Run `textCleanupNormalizer(customerText)`.
   - Run `normalizeContactFields({ rawText: customerText, intake })`.
   - Optionally run option-price sidecar extraction.
   - Build evidence-backed parser text with `buildEvidenceBackedTextCleanupResult()` and `buildPreNormalizerParserInput()`.
3. Send the parser text to OpenAI using `OPENAI_SYSTEM_PROMPT`.
4. Parse and sanitize the OpenAI draft with `parseOpenAiDraft()`.
5. Convert draft into normalizer input with `openAiDraftToNormalizerInput()`.
6. Run `normalizeToAlphaJsonV14(normalizerInput, customerText, intake)`.
7. Apply contact overlay for phone/email with `applyContactNormalizationOverlay()`.
8. Reconcile prices and validate final AlphaJSON.

Name-specific selection order inside `normalizeToAlphaJsonV14()`:

| Priority | Source | Code behavior |
| --- | --- | --- |
| 1 | Structured intake name | `firstCleanCustomerName(intake.name, ...)` checks typed UI/structured input first |
| 2 | Model-provided name | Uses `client.name`, `customer.name`, or `modelJson.name` if OpenAI did not mark customer-name uncertainty |
| 3 | Raw-input fallback | `extractNameFromRaw(sourceRawInput)` searches the original customer text |
| 4 | Blank | Returns empty string when no cleaned candidate survives validation |

Important detail: if OpenAI draft normalization has an uncertainty for `customer_name` or `customer name`, `modelProvidedName` is ignored before final name selection.

## 4. Regex Inventory

### Pre-AI name cleanup regexes in `lib/textCleanupNormalizer.js`

`stripNameNoise(value)` removes trailing non-name material:

```js
/\b(?:ph|fone|phone|call|reach|text|number|eml|email|email-ish|quote|send|addr|adrs|loc|service|addy|work|job)\b.*$/i
```

It removes leading label/noise words repeatedly:

```js
/^(?:cust(?:omer)?|homeowner|contact|name|line|says?|maybe|ish|label|labels?|no\s+labels?|eml-ish|adrs)\s+/i
```

`extractCustomerName(text)` patterns:

```js
/\b(?:name\s+line\s+says|customer\s+name\s+maybe|customer|cust|homeowner|contact)\s*(?:is|=|:)?\s*([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})/i
/\bno\s+labels?\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,2})/i
/\blabel\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,2})/i
/\bish\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,2})/i
/\bvoice\s+note\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,2})\s+says?\b/i
/^\s*([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,2})\s*(?:\/|,|;|\bphone\b|\bcall\b)/i
```

`customerWithAlias(rawInput, primaryCustomer)` handles ambiguous "maybe X or Y":

```js
/\b(?:cust(?:omer)?\s+name\s+)?maybe\s+(${nameToken}(?:\s+${nameToken}){1,2})\s+or\s+(${nameToken}(?:\s+${nameToken}){0,2})/i
```

### Final AlphaJSON name cleanup regexes in `lib/normalizeAlphaJson.js`

Reject job-text-like names:

```js
/\b(?:oak|pine|maple|elm|ash|cedar|sycamore|hickory|locust|birch|spruce|walnut|cherry|tree|trees|limb|limbs|branch|branches|stump|brush|garage|garaje|yard|driveway|fence|remove|removal|take\s+down|take|cut|drop|trim|haul|cleanup|clean\s+up|grind|quote|option|opt)\b/i
```

Reject placeholder names:

```js
/^(?:cust|customer|client|homeowner|name|no\s+name|unknown|none|n\/a|not\s+available)$/i
```

Reject cue fragments:

```js
/^(?:wrote|written|write|says?|said|talked|spoke|called|texted)\b/i
```

Reject vehicle/non-person fragments:

```js
/\b(?:truck|trailer|pickup|van|car|suv|blue\s+truck|white\s+truck|red\s+truck|black\s+truck)\b/i
```

Remove leading labels from name candidates:

```js
/\b(?:note\s+from|text\s+from|send\s+quote\s+to|customer\s+is|customer|client|homeowner|lady\s+named|lady|guy|person|office\s+said\s+call|call\/text|called\s+from|called|call|texted|text|email\s+for\s+approval(?:\s+is)?|email|said|or|text\s+mess)\b[:\s-]*/gi
```

Cut off uncertainty/contact-tail phrases:

```js
/\b(?:maybe|no\s+phone\s+(?:in\s+note|written)(?:\s+no\s+email)?|no\s+email|contact\s+later|email\s+only|estimate\s+from\s+yesterday|from\s+yesterday)\b.*$/i
```

Cut off job/address/contact words after the name:

```js
/\b(?:phone|email|service|address|job|lives?|wants?|needs?|says?|property|place|at|on|remove|removal|take|cut|drop|tree|trees?|stump|option)\b.*$/i
```

Reverse `Last, First`:

```js
/^([A-Za-z\u00c0-\u024f][A-Za-z\u00c0-\u024f.'-]+),\s*([A-Za-z\u00c0-\u024f][A-Za-z\u00c0-\u024f.'-]+)$/
```

`extractNameFromRaw(rawInput)` uses a general name candidate pattern:

```js
([A-Za-z\u00c0-\u024f][A-Za-z\u00c0-\u024f.'-]+(?:,\s*[A-Za-z\u00c0-\u024f][A-Za-z\u00c0-\u024f.'-]+|\s+[A-Za-z\u00c0-\u024f][A-Za-z\u00c0-\u024f.'-]+){0,3})
```

And stop pattern:

```js
(?=\s*(?:--|;|\.|,|\n|\d|call\b|text\b|phone\b|email\b|send\s+quote\s+to\b|address\b|service\b|job\b|contact\b|later\b|fallen\b|scope\b|wants?\b|needs?\b|says?\b|remove\b|take\b|cut\b|option\b|$))
```

`extractNameFromRaw()` source patterns include:

```js
\b(?:note\s+from|text\s+from|message\s+from|msg\s+from|voicemail\s+from|vm\s+from|call\s+from|called\s+by)\s+NAME\s+(?=send\s+quote\s+to\s+EMAIL)
\b(?:note\s+from|text\s+from|email\s+from|email|message\s+from|msg\s+from|voicemail\s+from|vm\s+from|call\s+from|called\s+by|send\s+quote\s+to|customer\s+is|customer|client|homeowner|lady\s+named|lady|guy|person)\s+NAME STOP
^\s*NAME\s*[;,]?\s+(?=(?:address|service\s+address|at)\b|STREET_ADDRESS)
^\s*NAME\s+(?:said|says?|wants?|needs?|call\/text|called\s+from|called|call|text|phone|email|no\s+phone|no\s+email|PHONE)
^\s*NAME\s+(?=STREET_ADDRESS)
EMAIL\s+(?:or\s+)?NAME STOP
PHONE\s+(?:or\s+)?NAME STOP
```

### Validation warning regex in `lib/validateJson.js`

`looksLikeMessyName(name)` warns when:

```js
/\b(customer|lady|guy|texted|maybe|phone|estimate|yesterday|cousin|office|call)\b/i
```

or when the name has more than four words.

## 5. Confidence Scoring

There is no dedicated numeric confidence score for final name extraction.

Current confidence signals:

| Signal | Where | Meaning |
| --- | --- | --- |
| Source priority | `normalizeToAlphaJsonV14()` | Intake name beats model name; model name beats raw fallback |
| OpenAI uncertainty gate | `hasNormalizationUncertainty()` | If OpenAI marks `customer_name` uncertain, model-provided name is not accepted |
| Regex order | `extractNameFromRaw()` and `extractCustomerName()` | Earlier patterns are trusted first |
| Cleanup/rejection filters | `cleanCustomerName()` | Candidate must survive anti-job-text, anti-placeholder, anti-fragment checks |
| Email hint | `extractEmailNameHint()` and `orderNameUsingEmailHint()` | Email local-part can reorder reversed two-token names or provide a fallback |
| Low-confidence spans | OpenAI draft schema and normalization | Model can mark ambiguous text, but there is no final numeric name confidence |
| Validation warning | `looksLikeMessyName()` | Suspicious final names produce a warning, not a blocker |

Important distinction: contact normalizer sidecars have confidence for phone/email candidates, but not for person names.

## 6. Name Validation Rules

Final name candidate cleanup happens in `cleanCustomerName(value)`.

Accepted candidates must:

- Be string-like after trimming.
- Not contain an email address after the leading-email cleanup.
- Survive phone and email stripping.
- Survive label stripping.
- Be at most four words after cleanup.
- Not be a placeholder like `unknown`, `no name`, `customer`, or `n/a`.
- Not start with cue fragments like `wrote`, `said`, `called`, or `texted`.
- Not contain obvious non-person text like `blue truck`.
- Not be job text such as tree species, option, price, removal, brush, stump, driveway, etc.
- Not contain digits.

Validation after final AlphaJSON:

- Missing customer name is allowed.
- Messy-looking customer name creates a warning: `Customer name may need review.`
- PDF blocking focuses on address, phone/email, tree count/scope, option descriptions, price firmness, and safety/scope issues, not name completeness.

## 7. Normalization and Cleanup

Name cleanup steps:

1. Remove a leading email from model-provided name candidates.
2. Reject the candidate if any email remains.
3. Strip phone numbers and emails.
4. Strip leading contact/source labels such as `customer`, `lady named`, `note from`, `called`, `texted`, and `send quote to`.
5. Cut the candidate at uncertainty/contact phrases such as `maybe`, `no phone`, `no email`, `contact later`, and `email only`.
6. Cut the candidate at job/address/contact words such as `phone`, `email`, `address`, `job`, `remove`, `tree`, `stump`, and `option`.
7. Strip trailing numbers and punctuation.
8. Convert `Last, First` to `First Last`.
9. Cap to the first four words.
10. Reject non-person, placeholder, vehicle, job-text, or connector-only fragments.
11. Title-case the result.

Email hint behavior:

- `extractEmailNameHint(rawInput)` reads the email local-part.
- It removes trailing digits from the local-part.
- It splits on `.`, `_`, and `-`.
- It keeps up to three alphabetic tokens.
- If a two-token candidate appears reversed relative to the email, `orderNameUsingEmailHint()` swaps it into email order.
- If no regex name match survives and the email has at least two name-like tokens, `extractNameFromRaw()` returns the first two email tokens.

## 8. Output Shape

Final AlphaJSON customer name output:

```json
{
  "customer": {
    "name": "",
    "phone_primary": "",
    "phone_display": "",
    "email": "",
    "address": { "display": "" },
    "display_name": ""
  }
}
```

Final assignment in `normalizeToAlphaJsonV14()`:

```js
base.customer = {
  ...base.customer,
  ...customer,
  name,
  phone_primary: phone,
  phone_display: phone,
  email,
  display_name: name.slice(0, 30),
};
```

Schema/documentation notes:

- `customer.name` is optional and can be blank.
- `customer.name` has a documented max length of 100.
- `customer.display_name` is a layout-safe truncation at max 30 characters.
- Template mapping uses `{{customer.name}}` and `{{customer.display_name}}`.

Pre-AI handoff evidence shape from `buildEvidenceBackedCoherentNote()`:

```json
{
  "customer": {
    "value": "",
    "source": "raw_input_name_evidence",
    "fallback_value": ""
  }
}
```

OpenAI draft shape:

```json
{
  "contact": {
    "customer_name": ""
  },
  "normalization": {
    "field_evidence": {
      "customer_name": ""
    }
  },
  "low_confidence_spans": [
    {
      "field": "customer_name",
      "text": "",
      "reason": "",
      "confidence": "low"
    }
  ]
}
```

## 9. Tests and Examples

Key tests in `tests/normalizeAlphaJson.test.js`:

| Test area | Examples covered |
| --- | --- |
| Standard positive cases | `Maria Lopez`, `Jon Baleu`, `Darren Fields`, `Beth Ann Miller`, etc. |
| Prefixed names | `Customer is James Carter ...` becomes `James Carter` |
| Email/address/contact cues | `email stella.hunt... Stella Hunt`, `note from Ben Reed send quote to...`, `Garza, Kara` |
| Email hint ordering | `bryant sam` with `sam.bryant...` becomes `Sam Bryant` |
| Leading-email model candidate | `ben.reed721@example.com Ben Reed` becomes `Ben Reed` |
| Rejected fake names | `blue truck`, job-only fragments, numeric fragments, placeholders, ambiguous `kay` |
| Follow-up cleanup | Later clean name `Customer Nora Field` replaces earlier messy no-name text |
| Uncertain OpenAI draft | Draft `customer_name: "kay"` is rejected when normalization uncertainty says it may not be a name |

Key tests in `tests/openaiExtractionBoundary.test.js`:

- OpenAI draft adapter preserves `contact.customer_name` for normal drafts.
- Low-confidence spans survive canonical normalization.
- Legacy/invalid model AlphaJSON output containing `Wrong Customer` is not trusted as final customer name.

Benchmark metric hook:

- `tests/alpha-cohort-RULES-simulation.test.js` records `parser_name` when expected `customer_name` differs from actual `alphaJson.customer.name`.
- `reports/alpha-metrics-report.md` currently reports at least one `parser_name` failure in the medium cohort.

## 10. Edge Cases and Risks

Current known risks:

- No dedicated name confidence score exists, so "how confident are we about this name?" must be inferred indirectly.
- Name extraction can be conservative. It intentionally returns blank for ambiguous fragments like `kay` when evidence says it may mean something else.
- Missing name is not a blocker, so a case may proceed if contact method, address, scope, and price are sufficient.
- Pre-AI name extraction does not use phone/email sidecar evidence to improve name selection. It uses raw/literal text plus basic regexes.
- Final name extraction can use email local-part hints, but only inside `normalizeAlphaJson.js`.
- The `extractCustomerName()` pre-AI regexes require capitalized name-looking tokens and may miss lowercase messy names unless later final normalization catches them.
- `titleCaseName()` is simple title casing and does not handle every real-world casing convention.
- Single-token names are generally weak. Some final regex candidate pattern allows 1 to 4 tokens, but cleanup/rejection and context determine acceptance.
- Tests are spread across broad AlphaJSON tests, not organized as a focused name-extraction test suite.
- Generated reports and fixtures contain many `customer_name` examples, but they are not production logic.

## 11. Improvement Opportunities

Possible improvements without changing the current conclusion:

1. Add a dedicated name extraction report/test harness that records expected name, pre-AI name evidence, OpenAI draft name, final name, and rejection reason.
2. Add explicit name confidence metadata, for example `customer_name_confidence` and `customer_name_source`.
3. Feed accepted email sidecar evidence into pre-AI name extraction as a sidecar, not as a replacement for raw evidence.
4. Add a name-only sidecar that emits candidates, spans, source labels, and rejection reasons.
5. Add tests for lowercase names, initials, apostrophes, hyphenated names, one-token names, spouse/relative names, and email-derived names.
6. Split tests into `nameExtraction.test.js` so name regressions are easier to see.
7. Preserve exact raw span for the accepted name in final normalization evidence.
8. Treat name warnings as a separate quality metric even when PDF generation is allowed.

Feasibility of email-sidecar augmentation:

- It is feasible.
- It makes sense if treated as evidence, not authority.
- Best use: use email local-part to reorder or strengthen a raw-text name candidate, and to produce a fallback when raw text has no clear explicit name.
- Main risk: emails like `treeservice`, shared inboxes, spouse emails, business emails, or typo-repaired emails can create false names if trusted too strongly.
- Safer design: keep raw span required for high confidence, use email sidecar only to boost/reorder or produce low-confidence fallback with clear evidence.

## 12. Copy/Paste Package for ChatGPT

Use this package to ask another model to reason about TSweb name extraction without changing code.

```text
We are auditing only customer/person-name extraction in TSweb. Do not change application logic.

Current production flow:
- `app/api/openai/route.js` reads `customer_text` and optional structured `intake`.
- If TD1 pre-normalizers are enabled, it runs:
  1. `textCleanupNormalizer(customerText)`
  2. `normalizeContactFields({ rawText: customerText, intake })`
  3. option-price sidecar extraction
  4. `buildEvidenceBackedTextCleanupResult(...)`
  5. `buildPreNormalizerParserInput(...)`
- It sends parser text to OpenAI with `OPENAI_SYSTEM_PROMPT`.
- It parses the OpenAI draft, maps it with `openAiDraftToNormalizerInput()`, then runs:
  `normalizeToAlphaJsonV14(normalizerInput, customerText, intake)`.
- It applies contact overlay for phone/email and validates final AlphaJSON.

Important files:
- `lib/normalizeAlphaJson.js`: final authority for customer name.
- `lib/textCleanupNormalizer.js`: pre-AI name evidence extraction.
- `lib/openaiPrompt.js`: asks model for `contact.customer_name` and field evidence.
- `lib/openaiDraftSchema.js`: requires/sanitizes draft `contact.customer_name`.
- `lib/openaiDraftAdapter.js`: maps draft `contact.customer_name` into normalizer input.
- `lib/validateJson.js`: warns if final name looks messy.
- `app/components/InputForm.jsx`: typed customer name from UI.

Final name selection in `normalizeToAlphaJsonV14()`:
1. Structured intake name.
2. Model-provided name from `client.name`, `customer.name`, or `modelJson.name`, unless OpenAI marked customer-name uncertainty.
3. Raw input fallback from `extractNameFromRaw(sourceRawInput)`.
4. Blank.

Main final-name functions:
- `cleanCustomerName(value)`
- `firstCleanCustomerName(...values)`
- `extractNameFromRaw(rawInput)`
- `extractEmailNameHint(rawInput)`
- `orderNameUsingEmailHint(candidate, emailHint)`

Main pre-AI functions:
- `stripNameNoise(value)`
- `extractCustomerName(text)`
- `coherentNoteNormalizer(rawInput, literalCleanedText)`
- `buildEvidenceBackedCoherentNote(...)`
- `customerWithAlias(rawInput, primaryCustomer)`

Key current behavior:
- There is no numeric name confidence score.
- Confidence is inferred from source priority, regex order, cleanup/rejection filters, OpenAI uncertainty fields, low-confidence spans, and validation warnings.
- Contact normalizer sidecars provide confidence for phone/email, not names.
- Final normalization can derive name hints from email local-part.
- Missing customer name does not block PDF generation.
- Messy customer name only creates a warning.

Question to analyze:
Would it improve name extraction to first extract phone/email with evidence and confidence from raw input, then extract name from raw input plus email evidence sidecar? Evaluate likely benefits, risks, and how to simulate without changing production logic.
```

