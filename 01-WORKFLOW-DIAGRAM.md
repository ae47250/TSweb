# Alpha Tree Service Web UI — Updated Workflow Diagram (V2)

## Data Flow: Input → OpenAI → JSON → HTML → PDF (Dual Format) → User Signs → Final PDF

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER INTERACTION LAYER                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  1. INTRO SCREEN                                                        │
│  ├─ Display "Alpha Tree Service Estimate Builder"                       │
│  ├─ Show required input fields (customer, job, options, debris)         │
│  └─ Wait for user text input (rough notes, prices, details)             │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  2. MESSY INPUT CAPTURE                                                 │
│  ├─ Accept free-form text (voice-style, bullets, mixed format)          │
│  ├─ Preserve original exactly in raw_input.customer_text                │
│  └─ Pass to OpenAI for structuring                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  3. OPENAI CONVERSION                                                   │
│  ├─ System prompt: "Convert messy input to AlphaJSON structure"         │
│  ├─ Input: raw customer text + instructions (V4.1 rules)                │
│  ├─ Output: Valid JSON matching AlphaJSON schema (1.4)                  │
│  └─ Validate all fields, flag missing/unclear data                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  4. JSON VALIDATION & BLOCKING ERRORS                                   │
│  ├─ Check required fields (job description, ≥1 priced option)           │
│  ├─ Validate option/price matching (no orphaned options)                │
│  ├─ Check job location (required, not placeholder)                      │
│  ├─ Flag layout risks (5+ options, long text)                           │
│  ├─ Set blocking errors → STOP before HTML/PDF                          │
│  └─ Generate "tree dude follow-up" questions if issues                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
        ┌─────────────────────────────────────────────────────┐
        │  BLOCKING ERROR?                                    │
        │  (Missing location, unmatched options, etc.)        │
        └─────────────────────────────────────────────────────┘
                    ↙ YES                ↘ NO
          ┌──────────────────┐   ┌──────────────────┐
          │ STOP - Show      │   │ Continue to      │
          │ Follow-up Q      │   │ Review           │
          │ & Wait for fix   │   │                  │
          └──────────────────┘   └──────────────────┘
                    ↓                       ↓
                                ┌─────────────────────────────────────────┐
                                │  5. TEXT-ONLY REVIEW SCREEN             │
                                │  ├─ Display validated JSON as text      │
                                │  ├─ Customer: name, address, phone      │
                                │  ├─ Job: location, description, trees   │
                                │  ├─ Options: A/B/C/D (sorted by price)  │
                                │  ├─ Notes: debris, cleanup, timing      │
                                │  └─ Ask: "Want the estimate PDF? (yes)" │
                                └─────────────────────────────────────────┘
                                            ↓
                    ┌─────────────────────────────────────────────┐
                    │  USER APPROVAL?                             │
                    │  (yes/yep/approve/proceed)                  │
                    └─────────────────────────────────────────────┘
                       ↙ NO (edits)     ↘ YES
              ┌──────────────────┐   ┌──────────────────────────┐
              │ Update JSON      │   │ Proceed to HTML fill     │
              │ Show review again│   │ & PDF generation         │
              │ Loop until yes   │   │                          │
              └──────────────────┘   └──────────────────────────┘
                    ↓                       ↓
                                ┌─────────────────────────────────────────┐
                                │  6. HTML GENERATION                     │
                                │  ├─ Load AlphaTemplEST.html             │
                                │  ├─ Fill ONLY from validated JSON       │
                                │  ├─ {{document.title}} → JSON value     │
                                │  ├─ {{customer.name}} → JSON value      │
                                │  ├─ Build INTERACTIVE option buttons    │
                                │  ├─ Add signature block (name input)    │
                                │  ├─ Apply style_updated.css             │
                                │  ├─ No messy text, no placeholders      │
                                │  └─ Return complete HTML string         │
                                └─────────────────────────────────────────┘
                                            ↓
                                ┌─────────────────────────────────────────┐
                                │  7. CLIENT-SIDE PREVIEW (OPTIONAL)      │
                                │  ├─ Display HTML in iframe              │
                                │  ├─ User sees instant visual preview    │
                                │  ├─ Checks layout before server call    │
                                │  └─ Catches issues early (cost savings) │
                                └─────────────────────────────────────────┘
                                            ↓
                                ┌─────────────────────────────────────────┐
                                │  8. PUPPETEER PDF GENERATION (DUAL)     │
                                │  ├─ Generate Format 1: Full-page PDF    │
                                │  │  └─ Desktop estimate (8.5"x11")      │
                                │  ├─ Generate Format 2: Mobile PDF       │
                                │  │  └─ Single-column mobile (optimized) │
                                │  ├─ Both PDFs include:                  │
                                │  │  ├─ Interactive option buttons       │
                                │  │  ├─ Signature field (text input)     │
                                │  │  └─ Legal disclaimer text            │
                                │  ├─ Verify: 1-page fit, no overflow     │
                                │  └─ On failure → Retry once, then HTML  │
                                │     fallback (print-to-PDF instructions)│
                                └─────────────────────────────────────────┘
                                            ↓
                    ┌─────────────────────────────────────────────┐
                    │  PDF GENERATION SUCCESS?                    │
                    └─────────────────────────────────────────────┘
                       ↙ NO (timeout/error)  ↘ YES
              ┌──────────────────┐   ┌──────────────────────────┐
              │ Auto-retry once  │   │ Generate metadata        │
              │ (5 sec delay)    │   │ (EST-YYYYMMDD-###)       │
              │ If fails: HTML   │   │ Store JSON to database   │
              │ download + call  │   │ Create audit log entry   │
              │ phone number     │   │                          │
              └──────────────────┘   └──────────────────────────┘
                    ↓                       ↓
                                ┌─────────────────────────────────────────┐
                                │  9. SEND TO CUSTOMER                    │
                                │  ├─ Text message with download links    │
                                │  ├─ Link 1: Full-page PDF (desktop)     │
                                │  ├─ Link 2: Mobile PDF (phone)          │
                                │  ├─ Document ID: EST-YYYYMMDD-###       │
                                │  └─ Instructions: "Select option, sign" │
                                └─────────────────────────────────────────┘
                                            ↓
                                ┌─────────────────────────────────────────┐
                                │  10. CUSTOMER OPENS PDF                 │
                                │  ├─ Opens in browser or PDF app         │
                                │  ├─ Sees estimate with options A/B/C    │
                                │  ├─ INTERACTIVE: Click option button    │
                                │  │  └─ Highlights selected option       │
                                │  │  └─ Adds "✓ Selected: Option B"      │
                                │  ├─ Scrolls to signature block          │
                                │  ├─ Types name → appears in cursive     │
                                │  ├─ Sees legal disclaimer               │
                                │  └─ Downloads or saves signed PDF       │
                                └─────────────────────────────────────────┘
                                            ↓
                                ┌─────────────────────────────────────────┐
                                │  11. FINAL VALIDATION                   │
                                │  ├─ Verify option selected              │
                                │  ├─ Verify signature present            │
                                │  ├─ Verify 1-page fit                   │
                                │  ├─ Check no clipping/overflow          │
                                │  ├─ Verify prices match JSON            │
                                │  ├─ Confirm filename rule applied       │
                                │  ├─ Check metadata embedded             │
                                │  └─ Log generation time & success       │
                                └─────────────────────────────────────────┘
                                            ↓
                                ┌─────────────────────────────────────────┐
                                │  12. DELIVERY TO BUSINESS               │
                                │  ├─ Signed PDF received from customer   │
                                │  ├─ Display in "Pending Signatures"     │
                                │  ├─ Show selected option                │
                                │  ├─ Show customer name (signature)      │
                                │  ├─ Show timestamp                      │
                                │  └─ Ready to schedule work              │
                                └─────────────────────────────────────────┘
                                            ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                   SIGNED ESTIMATE READY FOR WORK                        │
│          Customer selected option, signed electronically                │
│       Ready to schedule, invoice, and perform the work                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Changes (V2)

| Change | What | Why |
|--------|------|-----|
| **Dual PDF formats** | Full-page + Mobile | Works on all devices |
| **Interactive options** | Clickable buttons in PDF | Customer selects choice |
| **Cursive signature** | Typed name → cursive font | Looks professional, legal |
| **Legal disclaimer** | "By signing, you authorize..." | Protects both parties |
| **Option confirmation** | Shows "✓ Selected: Option B" | Clear record of choice |
| **SMS delivery** | Text message links | Fast, convenient access |

---

## New HTML Elements

**Option Selection Buttons:**
```html
<div class="option-selector">
  <button class="option-button" data-option="A">Option A: $2,000</button>
  <button class="option-button" data-option="B">Option B: $2,800</button>
  <button class="option-button" data-option="C">Option C: $3,200</button>
</div>
```

**Signature Block:**
```html
<div class="signature-block">
  <div class="signature-input-label">Customer signature (type your name)</div>
  <input type="text" class="signature-input" placeholder="John Smith" />
  <div class="signature-display" id="signatureDisplay"></div>
  <div class="legal-disclaimer">
    By typing your name, you agree this constitutes your electronic signature 
    and you authorize Alpha Tree Service to perform the selected work.
  </div>
  <div class="signature-date">Date: <span id="signatureDate"></span></div>
</div>
```

---

## Customer Experience Flow

1. **Receives SMS:** "Your estimate is ready! [Link to full PDF] [Link to mobile PDF]"
2. **Opens PDF** in browser or PDF app
3. **Sees estimate** with options A, B, C as clickable buttons
4. **Clicks Option B** → Button highlights green, shows "✓ Selected"
5. **Scrolls down** to signature block
6. **Types name** → Name appears in cursive script
7. **Reads disclaimer** → "By typing your name, you agree..."
8. **Submits/saves** signed PDF
9. **Business receives** signed PDF with selected option and customer signature

---

## Best Practices Maintained

✅ **Error Recovery** — Retry once, HTML fallback, phone number  
✅ **Hybrid Preview** — Client-side preview before PDF  
✅ **Metadata & Audit** — Document ID, timestamp, JSON logged  
✅ **Filename Intelligence** — Service address or customer name  
✅ **Rate Limiting** — 10 PDFs/hour per IP  
✅ **Analytics** — Log generation time, approval rate  
✅ **NEW: Interactive PDF** — Options + signature in one flow  
✅ **NEW: Dual formats** — Desktop + mobile versions  
✅ **NEW: Legal protection** — Electronic signature disclaimer  

---

## Fallback & Recovery

### If Option Selection Fails
```
PDF loads but buttons don't work → 
Show instructions: "Click the option number you choose (A, B, or C)"
Allow manual typing of selected option
```

### If Signature Fails
```
PDF loads but signature input doesn't work → 
Show instructions: "Type your name in the space provided"
Continue with plain text signature
```

### If PDF Generation Fails
```
HTML + CSS → [Puppeteer timeout] → 
Auto-retry once after 5 seconds
If still fails → 
Return HTML file + print instructions
Prompt: "Download the HTML and print to PDF, or call 812-599-6587"
```

---

## Testing Scenarios

**Scenario 1:** Customer selects Option B, signs with "John Smith"
- ✓ Option B highlights
- ✓ Name appears in cursive
- ✓ Legal text visible
- ✓ PDF saves with all elements

**Scenario 2:** Customer opens on mobile
- ✓ Mobile PDF displays single-column
- ✓ Buttons stack vertically
- ✓ Signature field responsive
- ✓ No overflow or clipping

**Scenario 3:** Customer tries to download without selecting option
- ⚠ Warning: "Please select an option first"
- ⚠ Button disabled until selection made
- ✓ Prevents incomplete submissions

---

## Files Needed for Implementation

These files must be created/updated:

1. **HTML Template** — Add interactive buttons + signature block
2. **CSS Styling** — Style buttons, signature cursive, disclaimer
3. **JavaScript** — Handle option click, signature display, validation
4. **PDF Route** — Generate two PDFs (full + mobile)
5. **Validation Logic** — Ensure option + signature present
6. **Database Schema** — Store selected option + signature name
7. **SMS Service** — Send customer text with both PDF links

---

## Success Criteria (Updated)

✅ Customer receives two PDF links (full-page + mobile)  
✅ Customer opens PDF and sees interactive option buttons  
✅ Customer clicks Option B → highlights and shows "✓ Selected"  
✅ Customer types name → appears in cursive in signature block  
✅ Customer sees legal disclaimer about electronic signature  
✅ Customer downloads/saves signed PDF  
✅ Business receives PDF with selected option + signature  
✅ All error cases handled (missing selection, signature, PDF gen fails)  
✅ Works on desktop AND mobile  
✅ Deployed to Vercel and production-ready  
