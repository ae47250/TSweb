# Alpha Tree Service Customer Visual Blueprint

Purpose: give GPT, v0, Codex, or another visual generator enough detail to recreate the customer experience after the next intended Alpha Tree Service workflow changes.

This is a visual blueprint only. Do not treat it as permission to change app code, commit, push, deploy, create databases, create Blob stores, enable live SMS/email, or add multi-company logic.

## Non-Negotiable Rules

- Company is Alpha Tree Service only.
- Do not mention Beta Tree.
- Do not add company switching or multi-company UI.
- Customer opens a clean estimate link.
- Customer chooses exactly one option.
- Customer agrees to electronic signature language.
- Customer types/signs name.
- Customer signature counts as acceptance.
- Do not require Tree Dude receipt confirmation.
- Do not show raw Blob URLs.
- Do not expose internal storage paths.
- Do not fake PDFs.
- If PDF is unavailable, label the fallback clearly as HTML.
- Keep the customer experience polished, simple, and phone-first.

## Visual Style

The customer flow should feel cleaner and more polished than the Tree Dude workflow. The customer may be opening a link from SMS or email on a phone. They should immediately understand:

1. This is from Alpha Tree Service.
2. This is their estimate.
3. They need to choose one option.
4. They need to sign electronically.
5. After signing, the estimate has been received.

Use:

- large readable text
- clear company branding
- simple cards
- one primary action per screen
- obvious selected option state
- compact legal/e-sign checkbox
- clean confirmation

Avoid:

- admin controls
- debug text
- mock/testing language on customer screens
- raw JSON
- raw Blob URLs
- internal IDs except the estimate ID
- too many buttons
- duplicated primary buttons

## Sample Data

Use this data throughout the mockups.

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

Clean customer route:

```text
/e/EST-20260629-002
```

Full example URL:

```text
https://tree-service-web-app.vercel.app/e/EST-20260629-002
```

## Overall Customer Flow

Show these screens:

1. C1 - SMS First Contact Preview
2. C2 - Email First Contact Preview
3. C3 - Review Estimate and Choose Option
4. C4 - Electronic Signature
5. C5 - Received Confirmation

In real use, the customer normally starts at C3 after tapping the SMS/email link. C1 and C2 are visual previews of what the customer receives.

## C1 - SMS First Contact Preview

Purpose: show what Maria sees in a text message.

Screen title:

```text
Text from Alpha Tree Service
```

Phone-style message bubble:

```text
Hi Maria, your Alpha Tree Service estimate is ready. Review options and sign here:
https://tree-service-web-app.vercel.app/e/EST-20260629-002
```

Primary button:

```text
View Your Alpha Tree Service Estimate
```

Secondary link or small button:

```text
Show Email Version
```

Rules:

- Use the same primary button wording as C2.
- SMS may show the clean full URL because text messages often do.
- Never show a raw Blob URL.
- Do not show duplicate identical primary buttons.
- Do not use `Open Estimate Link`; use `View Your Alpha Tree Service Estimate`.

Visual note:

The SMS preview can look like a simple phone message bubble. The main purpose is to show the wording and clean link.

## C2 - Email First Contact Preview

Purpose: show what Maria sees in email.

Screen title:

```text
Email from Alpha Tree Service
```

Email card:

```text
Subject: Alpha Tree Service Estimate - Maria Lopez

Hi Maria,

Your Alpha Tree Service estimate is ready. Please review the options and sign electronically.
```

Primary button inside the email card:

```text
View Your Alpha Tree Service Estimate
```

Small helper for mockup only:

```text
Links to /e/EST-20260629-002
```

Rules:

- Use the same primary button wording as C1.
- Do not add a second identical button below the email card.
- Email can hide the clean URL behind the button.
- Underlying route must be `/e/EST-20260629-002`.
- Never show a raw Blob URL.

## C3 - Review Estimate and Choose Option

Purpose: customer reviews the estimate and chooses exactly one option.

Screen title:

```text
Review Your Estimate
```

Subtitle:

```text
Choose the option you want Alpha Tree Service to perform.
```

Top branding area:

```text
Alpha Tree Service
Estimate EST-20260629-002
```

Summary card:

```text
For: Maria Lopez
Job site: 805 2nd Street, Madison, IN
Job: Remove 2 maple trees near the back fence.
```

Work description card:

```text
Work Description
Remove 2 maple trees near the back fence. Customer requested pricing for basic cut-and-stack versus full removal with debris haul-away and stump grinding.
```

Options section title:

```text
Choose one option
```

Option cards:

```text
Option A
Cut and Stack
Cut both trees and leave wood stacked on property.
$1,800
```

```text
Option B
Full Removal
Cut both trees, haul debris, and grind stumps.
$2,750
```

```text
Option C
Full Removal + Cleanup
Cut both trees, haul debris, grind stumps, rake work area, and remove small branches.
$3,100
```

Selected state example:

```text
Selected: Option B - Full Removal
```

Primary button:

```text
Continue to Signature
```

Disabled helper if no option selected:

```text
Choose an option before continuing.
```

Behavior:

- Customer can select exactly one option.
- Option cards should be tap-friendly.
- Selected option should be visually obvious with a border, checkmark, or selected label.
- `Continue to Signature` is disabled until one option is selected.
- Tree Dude must not have preselected an option.
- Do not show Tree Dude controls.
- Do not show raw Blob URLs.

## C4 - Electronic Signature

Purpose: customer confirms selected option, agrees to e-signature language, and signs.

Screen title:

```text
Sign Your Estimate
```

Selected option summary:

```text
Selected Option
Option B - Full Removal - $2,750
Cut both trees, haul debris, and grind stumps.
```

Required checkbox text, exact wording:

```text
I agree to receive and sign this estimate electronically, and I understand that typing my name below is my electronic signature.
```

Signature input label:

```text
Type your full name
```

Example input:

```text
Maria Lopez
```

Helper:

```text
Signed date and time will be recorded automatically.
```

Buttons:

```text
Back
Submit Signed Estimate
```

Disabled helper:

```text
Select an option, check the e-signature box, and type your name before submitting.
```

Behavior:

- Submit is disabled unless one option is selected.
- Submit is disabled unless checkbox is checked.
- Submit is disabled unless typed name/signature is present.
- On submit, customer acceptance is recorded.
- Signed date/time is captured automatically.

Stored acceptance fields:

- estimateId
- selectedOptionLabel
- selectedOptionTitle
- selectedOptionDescription
- selectedOptionPrice
- checkboxAccepted
- signatureName
- signedAt
- signedAtDisplay
- acceptanceSource = `customer_app`

Visual note:

Keep the e-signature text compact but readable. Do not add long legal paragraphs.

## C5 - Received Confirmation

Purpose: customer sees that Alpha Tree Service received the signed estimate.

Screen title:

```text
Your signed estimate has been received.
```

Summary card:

```text
Selected: Option B - Full Removal - $2,750
Signed by: Maria Lopez
Signed: Jun 29, 2026, 4:25 PM
Status: Accepted
```

If signed PDF is available:

```text
Download Signed Estimate
```

If only accepted HTML fallback is available:

```text
Download Signed HTML
```

Fallback message:

```text
PDF is not available yet. Your accepted estimate has still been recorded.
```

Rules:

- Use received language, not submitted language.
- Do not say Tree Dude must confirm receipt.
- Do not show the later follow-up message in this pass.
- Do not show mock-safe SMS/email details to the customer.
- Do not expose raw Blob URLs.
- Do not show admin buttons.

Do not use this title:

```text
Your signed estimate has been submitted.
```

Use:

```text
Your signed estimate has been received.
```

## Customer Flow Validation

Visual generator should show these states:

No option selected:

- option cards visible
- `Continue to Signature` disabled
- helper says choose an option

Option selected:

- selected option visibly highlighted
- `Continue to Signature` enabled

Signature incomplete:

- selected option summary visible
- checkbox unchecked or name missing
- `Submit Signed Estimate` disabled

Signature complete:

- checkbox checked
- typed name present
- `Submit Signed Estimate` enabled

Confirmation:

- received wording
- selected option
- signature name
- signed date/time
- accepted status

## Customer Screens Must Not Include

- Tree Dude Front Page
- `Record Manual Acceptance`
- `Confirm Quote`
- receipt confirmation
- mock notification target phone/email
- raw Blob URLs
- internal file paths
- JSON debug blocks
- company selector
- Beta Tree
- database/admin wording

## Visual Test Cases

Test C1:

- SMS button says `View Your Alpha Tree Service Estimate`.
- Clean URL is shown.
- No raw Blob URL appears.

Test C2:

- Email button says `View Your Alpha Tree Service Estimate`.
- There is only one primary button with that wording.
- No duplicate identical button appears.

Test C3:

- Customer sees work description and all options.
- Customer can select exactly one option.
- Tree Dude did not preselect an option.
- Continue button is disabled until an option is selected.

Test C4:

- Exact e-signature checkbox text appears.
- Submit is disabled until option, checkbox, and typed name are complete.
- Selected option summary is visible.

Test C5:

- Title says `Your signed estimate has been received.`
- Selected option, signature name, signed time, and accepted status are visible.
- No follow-up receipt-confirmation message appears.

## One-Sentence Summary For GPT

The customer receives a clean Alpha Tree Service estimate link, reviews the work, chooses exactly one option, agrees to electronic signature terms, types their name, submits the signed estimate, and sees a short received confirmation.
