# Alpha Tree Service Visual Mockup Master Spec

Purpose: give GPT, v0, Codex, or another UI generator a clear source of truth for creating representative HTML mockups of the Alpha Tree Service estimate workflow.

This is a visual mockup specification, not production code.

Do not push, deploy, create Vercel projects, create Blob stores, enable real SMS/email, or add multi-company logic from this file alone.

## Project Facts

- Product: Alpha Tree Service Estimate Builder
- Company scope: Alpha Tree Service only
- Production URL: https://tree-service-web-app.vercel.app/
- Customer route format: `/e/[estimateId]`
- Example customer route: `https://tree-service-web-app.vercel.app/e/EST-20260629-002`
- Blob store name: `TSwebAppBlob`
- Raw Blob URLs must never be shown to customers.
- SMS/email are mock-safe unless explicitly enabled later.

## Primary Design Goal

Create simple phone-first mockups for two separate experiences:

1. Tree Dude workflow
2. Customer workflow

The mockups should show clear screens, buttons, disabled states, and transitions. They should not look like an admin dashboard. They should look like a field-ready mobile web app.

## Style Direction

- Mobile-first
- Large buttons
- Short labels
- Clear next action
- Minimal cards
- No debug clutter
- No raw JSON
- No raw Blob URLs
- No legal paragraphs
- No company selector
- No Beta Tree
- No multi-tenant language
- Use Alpha Tree Service only
- Use realistic sample data
- Keep navigation buttons close to content
- Do not push buttons far below the visible card

Recommended visual feel:

- Clean white or light gray background
- Cards with simple borders
- One strong primary button per screen
- Secondary actions grouped below
- Disabled buttons visible with reason text
- Compact helper text

## Sample Data To Use In All Mockups

Customer:

- Name: Maria Lopez
- Phone: 812-555-0134
- Email: maria.lopez@example.com
- Service address: 805 2nd Street, Madison, IN

Estimate:

- Estimate ID: EST-20260629-002
- Job summary: Remove 2 maple trees near the back fence.
- Work description: Remove 2 maple trees near the back fence. Customer requested pricing for basic cut-and-stack versus full removal with debris haul-away and stump grinding.

Options:

- Option A - Cut and Stack - $1,800
  - Cut both trees and leave wood stacked on property.
- Option B - Full Removal - $2,750
  - Cut both trees, haul debris, and grind stumps.
- Option C - Full Removal + Cleanup - $3,100
  - Cut both trees, haul debris, grind stumps, rake work area, and remove small branches.

Important: Tree Dude does not choose one of these options. Tree Dude reviews and confirms that these options are correct. The customer chooses one later.

## Terms To Use

Use these labels:

- Confirm Quote
- Quote Confirmed
- Ready to send to customer
- Send SMS
- Send Email
- Copy Customer Link
- Download Customer File
- Record Manual Acceptance
- Accepted outside the app
- Customer signed in app

Avoid these labels:

- Tree Dude chooses option
- Customer committed before signature
- Estimate accepted before customer action
- Raw Blob file
- Internal storage URL
- Tenant
- Company selector
- Beta Tree

## Tree Dude Workflow Overview

Tree Dude creates and sends a quote. Tree Dude does not accept the quote for the customer and does not select the customer's option.

Correct Tree Dude flow:

```text
Screen TD1: Enter Job Info
-> Screen TD2: AI Review / Check Details
-> Screen TD3: Quote Confirmed / Ready to Send
-> Screen TD4: Waiting / Follow Up
-> Screen TD5: Accepted
```

Screen TD3 combines the old "confirmed" moment and the send actions. Do not create a separate full screen that only says "Proceed to Send" unless specifically requested.

## Tree Dude Screen TD1 - Enter Job Info

Purpose: Tree Dude enters the minimum field info plus messy notes.

Title:

```text
Enter Job Info
```

Fields:

```text
Customer name
Maria Lopez

Customer phone
812-555-0134

Complete service address
805 2nd Street, Madison, IN

Job notes / what needs done
Remove 2 maple trees near back fence. Option A cut and stack 1800. Option B full removal haul debris and grind stumps 2750.
```

Helper under address:

```text
Type the full address if possible: street, city, state.
```

Helper under job notes:

```text
Add tree count, location, cleanup, hauling, stump grinding, access issues, and prices/options.
```

Primary button:

```text
Create Review
```

Secondary button:

```text
Clear
```

Behavior:

- Job notes are required.
- Email is not required on this screen.
- If name, phone, or address is missing, still allow AI review if notes exist.
- Missing required info should be flagged on TD2, not silently ignored.

## Tree Dude Screen TD2 - AI Review / Check Details

Purpose: AI shows extracted customer info, job summary, and quote options. Tree Dude checks correctness.

Title:

```text
AI Review - Check Details
```

Card 1:

```text
Customer
Maria Lopez
812-555-0134
maria.lopez@example.com
805 2nd Street, Madison, IN
```

Card 2:

```text
Job
Remove 2 maple trees near the back fence.
```

Card 3:

```text
Quote Options
Option A - Cut and Stack - $1,800
Option B - Full Removal - $2,750
Option C - Full Removal + Cleanup - $3,100
```

Important visible note:

```text
Tree Dude reviews these options. The customer chooses one later.
```

If missing info exists, show a compact checklist:

```text
Needs More Info
- Customer phone missing
- Service address missing
- Option B price missing
```

Buttons:

```text
Edit Info
Confirm Quote
```

Button behavior:

- `Edit Info` returns to TD1 with existing values preserved.
- `Confirm Quote` is disabled if validation fails.
- If disabled, show exact reason:
  - `Fix missing info before confirming quote.`

Do not show:

- Option radio buttons
- Option selection state
- Customer signature
- Customer acceptance

## Tree Dude Screen TD3 - Quote Confirmed / Ready To Send

Purpose: Confirm the quote package is ready and immediately show send/share actions.

Title:

```text
Quote Confirmed
```

Subtitle:

```text
Ready to send to customer
```

Place the main send buttons immediately below the title/subtitle.

Primary action area:

```text
Send SMS
Send Email
Copy Customer Link
Download Customer File
```

If phone is missing:

```text
SMS unavailable - missing phone
```

If email is missing:

```text
Email unavailable - missing email
```

Mock-safe notice:

```text
Mock mode: no real SMS or email was sent.
```

Quote details below buttons:

```text
Estimate ID: EST-20260629-002
Customer link: /e/EST-20260629-002
```

SMS preview:

```text
Hi Maria, your Alpha Tree Service estimate is ready. Review options and sign here:
https://tree-service-web-app.vercel.app/e/EST-20260629-002
```

Email preview:

```text
Subject: Alpha Tree Service Estimate - Maria Lopez

Hi Maria,

Your Alpha Tree Service estimate is ready. Please review the options and sign electronically.

View Your Alpha Tree Service Estimate
```

Manual/fallback action:

```text
Record Manual Acceptance
```

Helper under manual button:

```text
Use this only if the customer approved outside the app, such as by phone call, text reply, email reply, or in person.
```

Do not show:

- Raw Blob URL
- Storage internals
- Customer option selection
- Customer signature form

## Tree Dude Screen TD4 - Waiting / Follow Up

Purpose: Show the quote was sent or copied, and give Tree Dude follow-up actions.

Title:

```text
Waiting on Customer
```

Summary:

```text
Quote sent or ready to share.
Customer can open the link, choose an option, and sign.
```

Status examples:

```text
SMS preview created
Email preview created
Customer link copied
No real SMS or email sent in mock mode
```

Actions:

```text
Copy Customer Link
Copy SMS Message
Copy Email Message
Download Customer File
Record Manual Acceptance
```

Manual helper:

```text
Record manual acceptance if Maria approved outside the app by phone call, text reply, email reply, or in person.
```

Do not make Tree Dude select the accepted option on this screen unless he clicks `Record Manual Acceptance`.

## Tree Dude Manual Acceptance Form

Purpose: Record that the customer accepted outside the app.

Trigger button:

```text
Record Manual Acceptance
```

Title:

```text
Record Manual Acceptance
```

Intro helper:

```text
Use this when the customer approved outside the app, such as by phone call, text reply, email reply, or in person.
```

Read-only summary:

```text
Maria Lopez
805 2nd Street, Madison, IN
EST-20260629-002
```

Required field:

```text
Accepted option
```

Choices:

```text
Option A - Cut and Stack - $1,800
Option B - Full Removal - $2,750
Option C - Full Removal + Cleanup - $3,100
```

Required field:

```text
Approval method
```

Choices:

```text
Text reply
Phone call
Email reply
In person
Other
```

Required field:

```text
Customer note or reply
```

Placeholder:

```text
Customer texted: Go ahead with Option B.
```

Optional field:

```text
Typed name/signature if available
```

Primary button:

```text
Save Manual Acceptance
```

After save, move to TD5.

## Tree Dude Screen TD5 - Accepted

Purpose: Show final operational result after customer signs in app or after Tree Dude records manual acceptance.

Title:

```text
Customer Accepted Quote
```

If customer signed in app:

```text
Maria Lopez accepted Option B - Full Removal - $2,750
Signed: Jun 29, 2026, 4:25 PM
Method: Customer app signature
```

If Tree Dude recorded manual acceptance:

```text
Maria Lopez accepted Option B - Full Removal - $2,750
Accepted: Jun 29, 2026, 4:25 PM
Method: Text reply
Note: Customer texted: Go ahead with Option B.
```

Actions:

```text
Download Signed/Accepted File
Copy Accepted Link
Copy SMS Message
Copy Email Message
Back to Dashboard
```

If PDF is not available:

```text
Signed PDF is not available yet. The accepted quote has still been recorded.
```

Do not show:

- Raw Blob URL
- Internal storage path
- Debug status
- Full legal text

## Customer Workflow Overview

Customer receives a clean link by SMS or email, opens the estimate, reviews the work/options, chooses one option, signs, and gets confirmation.

Correct customer flow:

```text
Screen C1: SMS Received preview
Screen C2: Email Received preview
Screen C3: Review Estimate & Choose Option
Screen C4: Signature
Screen C5: Confirmation
```

In the real app, the customer normally lands directly on C3 after clicking `/e/[estimateId]`. C1 and C2 are previews/simulations for mockup purposes.

## Customer Screen C1 - SMS Received Preview

Purpose: show what the customer sees in a text message.

Title:

```text
SMS from Alpha Tree
```

Message bubble:

```text
Hi Maria, your Alpha Tree Service estimate is ready. Review options and sign here:
https://tree-service-web-app.vercel.app/e/EST-20260629-002
```

Primary button:

```text
Open Estimate Link
```

Secondary button:

```text
Show Email Version
```

Rules:

- SMS shows the clean URL visibly.
- SMS does not hide links behind friendly text.
- SMS never shows raw Blob URLs.

## Customer Screen C2 - Email Received Preview

Purpose: show what customer sees in email.

Title:

```text
Email from Alpha Tree
```

Email card:

```text
Subject: Alpha Tree Service Estimate - Maria Lopez

Hi Maria,

Your estimate is ready. Please review the options and sign electronically.

[View Your Alpha Tree Service Estimate]
```

Small helper for mockup only:

```text
Button points to: /e/EST-20260629-002
```

Primary button:

```text
View Your Alpha Tree Service Estimate
```

Rules:

- Email can hide the clean URL behind button text.
- Underlying link is the clean app route.
- Never show raw Blob URL.

## Customer Screen C3 - Review Estimate & Choose Option

Purpose: combine estimate opening and option choice into one screen.

Title:

```text
Review estimate & choose option
```

Top card contains only high-level info:

```text
Estimate ID: EST-20260629-002
Customer: Maria Lopez
Job site: 805 2nd Street, Madison, IN
```

Do not put full work description in the top card.

Second card:

```text
Work description
Remove 2 maple trees near the back fence. Customer requested pricing for basic cut-and-stack versus full removal with debris haul-away and stump grinding.
```

Options section directly under work description:

```text
Choose one option
```

Option cards:

```text
Option A - Cut and Stack
Cut both trees and leave wood stacked on property.
$1,800

Option B - Full Removal
Cut both trees, haul debris, and grind stumps.
$2,750

Option C - Full Removal + Cleanup
Cut both trees, haul debris, grind stumps, rake work area, and remove small branches.
$3,100
```

Selected state example:

```text
Selected: Option B. Next step is electronic signature.
```

Primary button:

```text
Continue to Signature
```

If no option selected:

```text
Choose an option before continuing.
```

Rules:

- Customer chooses exactly one option.
- Selected option must be visually obvious.
- Customer cannot continue until one option is selected.
- Customer should not see raw Blob URLs.

## Customer Screen C4 - Signature

Purpose: customer confirms selected option and signs.

Title:

```text
Sign Estimate
```

Selected option summary:

```text
Selected: Option B - Full Removal - $2,750
```

Required checkbox:

```text
I agree to receive and sign this estimate electronically, and I understand that typing my name below is my electronic signature.
```

Signature field:

```text
Type your full name
Maria Lopez
```

Helper:

```text
Signed date/time will be captured automatically.
```

Buttons:

```text
Back
Submit Signed Selection
```

Submit disabled until:

- one option selected
- checkbox checked
- typed name/signature present

Stored fields:

- estimateId
- selectedOptionId
- selectedOptionLabel
- selectedOptionDescription
- selectedOptionPrice
- checkboxAccepted
- signatureName
- signedAt
- signedAtDisplay
- acceptanceSource = `customer_app`

## Customer Screen C5 - Confirmation

Purpose: customer sees that signed estimate was submitted.

Title:

```text
Your signed estimate has been submitted.
```

Summary:

```text
Selected: Option B - Full Removal - $2,750
Signed by: Maria Lopez
Signed: Jun 29, 2026, 4:25 PM
Status: Accepted
```

Button if PDF is available:

```text
Download Signed PDF
```

Fallback if PDF is not available:

```text
Signed PDF is not available yet. Your accepted estimate has still been recorded.
```

Optional button:

```text
Copy Signed Document Link
```

Rules:

- Confirmation must not expose raw Blob URLs.
- Confirmation should be short and reassuring.
- Do not show Tree Dude admin actions to customer.

## Customer-to-Tree-Dude Notification

After the customer signs in app, Tree Dude gets mock-safe notification/status.

Message:

```text
Maria Lopez accepted Option B - Full Removal - $2,750. Signed: Jun 29, 2026, 4:25 PM. View signed estimate:
https://tree-service-web-app.vercel.app/e/EST-20260629-002
```

Development/testing values:

```text
mocked = true
sentSms = false
sentEmail = false
```

## Required Do / Do Not List

Do:

- Make Tree Dude review options, not select them.
- Make customer select the option.
- Use `Confirm Quote` for Tree Dude.
- Use `Quote Confirmed` after Tree Dude confirms.
- Put send buttons immediately under `Quote Confirmed`.
- Explain outside-app acceptance with examples.
- Keep customer review and option choice combined.
- Keep signature as its own customer step.
- Keep final confirmation minimal.
- Use clean `/e/[estimateId]` links.
- Use HTML fallback labels if PDF is not real.

Do not:

- Let Tree Dude choose Option A/B/C during quote creation.
- Say customer accepted before customer signs or manual acceptance is recorded.
- Use `Approve Estimate Package` if `Confirm Quote` fits better.
- Use `Estimate Accepted` for Tree Dude's pre-send confirmation.
- Show raw Blob URLs.
- Show internal Blob paths.
- Send real SMS/email in mockups.
- Add Beta Tree.
- Add company selector.
- Add multi-tenant routing.
- Make PDF claims if output is HTML.

## Mockup Deliverables Requested From GPT/v0/Codex

Create representative HTML mockups with two sections:

1. Tree Dude Screens
2. Customer Screens

For each screen:

- Show a phone-sized frame.
- Use the exact titles and button labels from this spec.
- Use the sample Maria Lopez data.
- Use arrows or simple navigation between screens.
- Show disabled button examples where relevant.
- Keep layout compact and phone-first.

Recommended generated files:

```text
alpha-tree-tree-dude-flow.html
alpha-tree-customer-flow.html
alpha-tree-combined-flow.html
```

If only one HTML file is created, include both flows on one page with clear headings.

## Test Cases For Visual Logic

Test TD-A: Tree Dude quote review

- TD2 shows options.
- TD2 does not show radio buttons for Tree Dude to choose one.
- TD2 button says `Confirm Quote`.

Test TD-B: Missing email

- TD3 shows SMS available.
- TD3 shows `Email unavailable - missing email`.
- Copy link remains available.

Test TD-C: Manual acceptance

- TD4 says outside-app examples:
  - phone call
  - text reply
  - email reply
  - in person
- Manual form asks Tree Dude to choose accepted option only after customer has approved outside the app.

Test C-A: Customer choose option

- C3 shows option cards.
- Customer selects exactly one option.
- Continue disabled until option is selected.

Test C-B: Customer signature

- C4 shows selected option summary.
- Checkbox and typed name are required.
- Submit disabled until checkbox and signature are complete.

Test C-C: Confirmation

- C5 shows selected option, price, signature name, signed time, accepted status.
- No raw Blob URL.

## Final Instruction For Mockup Generator

The most important rule:

```text
Tree Dude confirms the quote package.
Customer chooses the option.
Manual acceptance is only for customer approval that happened outside the app.
```

If the generated mockup violates that rule, regenerate it.
