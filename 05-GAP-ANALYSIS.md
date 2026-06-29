# Alpha Tree Service Web UI — Gap Analysis

## What Exists (Current Test Project)

✅ **Basic Next.js structure** — App Router, pages, API route  
✅ **PDF generation working** — Puppeteer + @sparticuz/chromium via `/api/pdf`  
✅ **HTML-to-PDF pipeline** — Working end-to-end  
✅ **Vercel deployment ready** — Runtime config correct (Node.js, 60 sec timeout)  

---

## What's MISSING (Gap List)

### Category 1: CRITICAL (Must Have Before Launch)

| Gap | Current State | Needed | Blocker? | Priority |
|-----|---------------|--------|----------|----------|
| **AlphaJSON parsing** | Not implemented | API route `/api/openai` calls OpenAI, converts messy input to AlphaJSON v1.4 | ✅ BLOCKER | P0 |
| **JSON validation** | Not implemented | API route `/api/validate` validates JSON against schema, returns blocking errors + warnings | ✅ BLOCKER | P0 |
| **HTML template binding** | Not implemented | Logic to fill `AlphaTemplEST.html` from validated JSON ({{field}} replacements) | ✅ BLOCKER | P0 |
| **Intro screen UI** | Not implemented | React component showing form with required input fields (customer, job, options, debris) | ✅ BLOCKER | P0 |
| **Review screen UI** | Not implemented | React component showing text-only review from JSON, approval prompt | ✅ BLOCKER | P0 |
| **Approved templates** | Not copied | `AlphaTemplEST.html`, `style_updated.css` must be in `/templates/` directory | ✅ BLOCKER | P0 |
| **System prompt** | Not configured | OpenAI system prompt in config (how to convert messy input per TS bot instructions) | ✅ BLOCKER | P0 |
| **Error handling** | Basic try-catch | Detailed error messages (non-technical for users), retry logic, fallback to HTML | ⚠️ CRITICAL | P0 |
| **Rate limiting** | Not implemented | Prevent abuse (10 req/hour per IP), track usage | ⚠️ CRITICAL | P1 |
| **Metadata & document ID** | Not implemented | Generate `EST-YYYYMMDD-###`, embed in PDF, store to database (optional) | ⚠️ CRITICAL | P1 |

### Category 2: IMPORTANT (Phase 1.5 or Phase 2)

| Gap | Current State | Needed | Blocker? | Priority |
|-----|---------------|--------|----------|----------|
| **Client-side preview** | Not implemented | Show HTML in iframe before PDF generation (instant feedback) | ⚠️ RECOMMENDED | P1 |
| **PDF caching** | Not implemented | Cache PDFs by filename hash for 24 hours (reduce cold starts) | ⚠️ RECOMMENDED | P2 |
| **Audit logging** | Not implemented | Store JSON payload + timestamp + user to database on success | ⚠️ RECOMMENDED | P2 |
| **Email delivery** | Not implemented | Option to email PDF to customer (SendGrid integration) | ⚠️ OPTIONAL | P3 |
| **Past estimates** | Not implemented | `/api/history` to retrieve & search previous estimates | ⚠️ OPTIONAL | P3 |
| **Analytics** | Not implemented | Track PDF generation time, approval rate, abandonment funnel | ⚠️ RECOMMENDED | P2 |
| **Database** | Not set up | Vercel Postgres or Supabase for audit log, history, analytics | ⚠️ OPTIONAL | P2 |

### Category 3: STRUCTURAL (Code Quality & Deployment)

| Gap | Current State | Needed | Impact | Priority |
|-----|---------------|--------|--------|----------|
| **File structure** | Test project only | Reorganize into proper Next.js structure with `/lib`, `/config`, `/components`, `/data` | Code maintainability | P1 |
| **Environment vars** | Hardcoded examples | `.env.example` + `.env.local` + `.env.production` templates | Deployment safety | P0 |
| **Testing** | None | Unit tests for validation, integration tests for API routes, e2e tests for workflow | Quality assurance | P2 |
| **Documentation** | Minimal | README, API docs, deployment guide, troubleshooting | Onboarding | P1 |
| **Logging** | console.log only | Structured logging with levels (debug, info, warn, error) | Debugging | P2 |
| **Error messages** | Generic | User-facing messages + admin logs + fallback instructions | UX quality | P1 |
| **Components** | One test form | Proper React components (InputForm, JsonReview, PdfGenerator, ErrorAlert) | Code organization | P1 |

### Category 4: BEST PRACTICES (Production Ready)

| Gap | Current State | Needed | Blocker? | Priority |
|-----|---------------|--------|----------|----------|
| **Input sanitization** | Basic HTML escape in test | Full XSS protection (no messy text in output HTML) | ✅ SECURITY | P0 |
| **CORS headers** | Not configured | Lock API routes to your domain only | ✅ SECURITY | P1 |
| **Rate limit headers** | Not set | Return proper 429 + Retry-After header | ⚠️ IMPORTANT | P1 |
| **PDF validation** | Render-only check | Verify 1-page fit, no clipping, no overflow before returning | ⚠️ IMPORTANT | P1 |
| **Filename intelligence** | Generic name in test | Use service address or customer name (per rules) | ⚠️ IMPORTANT | P1 |
| **Date formatting** | Hardcoded in test | Dynamic "Month Day, Year" per current date | ⚠️ IMPORTANT | P0 |
| **Monitor cold starts** | Not tracked | Log PDF generation time for performance baseline | ⚠️ RECOMMENDED | P2 |
| **API timeout handling** | Basic | Implement OpenAI + Puppeteer timeouts with retry/fallback | ⚠️ IMPORTANT | P1 |

---

## Detailed Gap Breakdown

### GAP 1: AlphaJSON Parsing via OpenAI

**Current:** Test project has `buildEstimateHtml()` that takes plain text and generates HTML directly.

**Needed:**
- API route `/api/openai` that:
  1. Receives raw user text
  2. Sends to OpenAI with system prompt (from TS bot instructions V4.1)
  3. Requests output in AlphaJSON v1.4 format
  4. Returns structured JSON
  
**Implementation sketch:**
```javascript
// POST /api/openai
// Body: { customer_text: "..." }
// Response: { json: AlphaJSON object, error?: string }
```

**Why it's a blocker:** Cannot proceed to validation/HTML without structured data.

---

### GAP 2: JSON Validation Engine

**Current:** No validation logic exists.

**Needed:**
- API route `/api/validate` that:
  1. Receives JSON from `/api/openai`
  2. Checks required fields (job location, ≥1 priced option, etc.)
  3. Validates option/price matching
  4. Flags layout risks (5+ options, long text)
  5. Returns structured response: `{ can_generate_pdf: boolean, errors: [], warnings: [], blocking_errors: [], follow_ups: [] }`

**Implementation sketch:**
```javascript
// POST /api/validate
// Body: { json: AlphaJSON object }
// Response: { can_generate_pdf: true/false, issues: { blocking: [], warnings: [] } }
```

**Why it's a blocker:** Prevents invalid PDFs from being generated. Core safety mechanism.

---

### GAP 3: HTML Template Binding

**Current:** Test project has hardcoded HTML template. `AlphaTemplEST.html` exists but not integrated.

**Needed:**
- Function that:
  1. Loads `AlphaTemplEST.html`
  2. Replaces `{{document.title}}`, `{{customer.name}}`, etc. with JSON values
  3. Generates `<div class="option-card">...</div>` from `service_options.items[]`
  4. Applies `style_updated.css`
  5. Returns complete HTML string (no placeholders)

**Implementation sketch:**
```javascript
// lib/templateBindings.js
function bindJsonToTemplate(validatedJson, html, css) {
  // Replace all {{field}} with json values
  // Generate option cards from array
  // Verify no placeholders remain
  return finalHtml;
}
```

**Why it's a blocker:** Cannot generate PDFs without proper HTML filled from JSON.

---

### GAP 4: UI Components for Workflow

**Current:** Test project has single-page form.

**Needed:**
- **InputForm.jsx** — Captures customer, job, options, debris info
- **JsonReview.jsx** — Shows text-only review from validated JSON
- **HtmlPreview.jsx** — Shows HTML in iframe (optional, Phase 1.5)
- **PdfGenerator.jsx** — Button + status + download link
- **ErrorAlert.jsx** — Shows errors with retry/fallback instructions

**Why it's a blocker:** Users need to see the workflow and approve before PDF.

---

### GAP 5: Error Recovery & Fallback

**Current:** Test route returns 500 error, no recovery.

**Needed:**
- OpenAI timeout → show error, allow retry after 5 sec
- PDF generation timeout → auto-retry once, then return HTML with "print to PDF" instructions
- Rate limit hit → return 429 + friendly message
- All errors → include phone number (812-599-6587) for user support

**Implementation sketch:**
```javascript
// lib/errorHandler.js
const errorMessages = {
  openai_timeout: "Having trouble structuring your data. Please try again.",
  pdf_timeout: "PDF generation took too long. Download the HTML file and print to PDF. Need help? Call 812-599-6587.",
  rate_limited: "Too many requests. Please try again in 1 hour.",
};
```

**Why it's critical:** Users lose confidence if estimates fail. Fallback ensures service continues.

---

### GAP 6: Approved Templates Not Integrated

**Current:** `AlphaTemplEST.html` and `style_updated.css` are provided but not in project.

**Needed:**
- Copy files to `/templates/` directory
- Verify all CSS class names preserved
- Test HTML rendering with various content lengths
- Verify 1-page fit with sample data

**Why it's a blocker:** Without these approved files, output won't match brand/business rules.

---

### GAP 7: Rate Limiting

**Current:** No rate limiting. Anyone can spam `/api/pdf` endpoint.

**Needed:**
- Middleware to track requests by IP address
- Limit: 10 PDFs per hour per IP
- Return 429 (Too Many Requests) when exceeded
- Log abuse patterns for monitoring

**Implementation sketch:**
```javascript
// lib/rateLimiter.js
async function checkRateLimit(ipAddress) {
  // Get request count for this IP in last hour
  // If > 10, return { allowed: false, retryAfter: timestamp }
  // Otherwise increment counter and return { allowed: true }
}
```

**Why it's critical:** Prevents accidental/intentional API abuse, controls costs.

---

### GAP 8: Metadata & Document ID

**Current:** Files named `mr-lombardi-demo.pdf` (hardcoded).

**Needed:**
- Generate unique document ID: `EST-20260628-001`
- Embed in PDF metadata (creation date, service address)
- Store JSON payload + timestamp to database (optional)
- Return document ID to user for reference

**Implementation sketch:**
```javascript
// lib/metadataGenerator.js
function generateDocumentId(json) {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  return `EST-${dateStr}-001`; // increment counter for same-day estimates
}
```

**Why it's critical:** Legal tracking, audit trail, customer reference.

---

### GAP 9: Client-Side Preview (Phase 1.5)

**Current:** User sees no preview before requesting PDF.

**Needed:**
- Step 6 (after validation): Show HTML in iframe
- User can see exact layout before server PDF call
- Catches layout issues early (saves computation)
- User says "looks good" or asks for changes

**Implementation sketch:**
```javascript
// components/HtmlPreview.jsx
<iframe srcDoc={filledHtml} style={{width: '8.5in', height: '11in'}} />
```

**Why it's recommended:** Better UX, cost savings (fewer failed PDF attempts).

---

## Migration Path (Codex Roadmap)

### Phase 1: Core (Weeks 1-2)
1. Create file structure `/lib`, `/config`, `/components`, `/data`
2. Copy approved templates to `/templates/`
3. Implement `/api/openai` (messy → JSON)
4. Implement `/api/validate` (JSON → errors/warnings)
5. Implement template binding logic
6. Create `InputForm`, `JsonReview`, `PdfGenerator` components
7. Update `/api/pdf` route to use validated JSON
8. Add basic error handling + phone number in messages
9. Deploy to Vercel, test end-to-end

### Phase 1.5: UX Improvements (Weeks 3-4)
1. Add client-side HTML preview (optional but recommended)
2. Implement rate limiting
3. Better error messages
4. Analytics logging (generation time, approval rate)
5. PDF caching (24-hour TTL)

### Phase 2: Production Features (Weeks 5+)
1. Set up database (Vercel Postgres)
2. Implement audit logging
3. Add `/api/history` (past estimates)
4. Email delivery (SendGrid)
5. Unit + integration testing
6. Comprehensive documentation

---

## Testing the Gaps (Verification Checklist)

### Before Phase 1 Complete:
- [ ] User submits messy text → gets JSON back (validate schema)
- [ ] JSON missing job location → error + follow-up Q
- [ ] JSON with 3 priced options → passes validation
- [ ] Validated JSON → HTML fills correctly (no placeholders)
- [ ] HTML → PDF generates in <30 sec
- [ ] PDF is 1 page, no overflow, no clipping
- [ ] Filename uses service address (e.g., "805-2nd-street-estimate.pdf")
- [ ] User sees review before PDF + must approve
- [ ] Errors are user-friendly (not stack traces)
- [ ] Retry works (OpenAI timeout, then succeeds)

### Before Phase 2 Complete:
- [ ] 10+ PDFs in 1 hour from same IP → returns 429
- [ ] PDF generation time logged
- [ ] JSON stored to database with timestamp
- [ ] User can retrieve past estimates
- [ ] Test suite passes (unit + integration)

---

## Summary: What Codex Must Build

| Component | Files | Complexity | Time Estimate |
|-----------|-------|-----------|-----------------|
| `/api/openai` route | 1 file | Medium | 4 hours |
| `/api/validate` logic | 1 file | High | 8 hours |
| Template binding | 1 file | Medium | 4 hours |
| UI components | 5 files | Medium | 8 hours |
| Error handling | 1 file | Low | 2 hours |
| Rate limiting | 1 file | Low | 2 hours |
| Config + env setup | 3 files | Low | 2 hours |
| Testing + QA | 4 files | High | 8 hours |
| Documentation | 3 files | Low | 3 hours |
| **TOTAL** | **24 files** | — | **~40-50 hours** |

**Realistic timeline:** 2-3 weeks (Phase 1) + 1 week (Phase 1.5) + 2+ weeks (Phase 2)

