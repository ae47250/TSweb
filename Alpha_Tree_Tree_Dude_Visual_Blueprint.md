# Alpha Tree Service Tree Dude Visual Blueprint

Purpose: give GPT, v0, Codex, or another visual generator enough detail to recreate the Tree Dude experience after the next intended Alpha Tree Service workflow changes.

This is a visual blueprint only. Do not treat it as permission to change app code, commit, push, deploy, create databases, create Blob stores, enable live SMS/email, or add multi-company logic.

## Non-Negotiable Rules

- Company is Alpha Tree Service only.
- Do not mention Beta Tree.
- Do not add company switching, tenant switching, or multi-company UI.
- Tree Dude confirms the quote.
- Tree Dude does not choose the customer option.
- Customer chooses the option later.
- Manual acceptance means the customer accepted outside the app by phone call, text reply, email reply, in person, or similar.
- Customer signature in the app counts as acceptance.
- Tree Dude receipt confirmation is not part of this pass.
- Do not create a separate Waiting on Customer screen.
- Use recent activity cards instead.
- Show exactly 3 recent activity cards on the Front Page.
- Do not expose raw Blob URLs.
- Use clean customer links like `/e/EST-20260629-002`.
- Do not fake PDFs.
- If PDF is unavailable, label the fallback as HTML.
- Do not send real SMS or email.
- Mock SMS/email may be previewed or logged only.

## Visual Style

Design for a phone-first field workflow. Tree Dude may be standing outside, in a truck, or talking with a customer. The UI should be direct and operational.

Use:

- large tap targets
- short headings
- one obvious next action per step
- compact cards
- high contrast button labels
- clear disabled states
- short helper text
- status labels that explain what happened
- minimal typing after the first job-entry screen

Avoid:

- admin dashboard density
- tables
- filters
- search bars
- company selectors
- raw JSON
- raw storage paths
- long legal text
- unnecessary icons
- confusing words like "package" or "file"

## Sample Data

Use this data throughout the mockups.

Customer:

- Name: Maria Lopez
- Phone: 812-555-0134
- Email: maria.lopez@example.com
- Service address: 805 2nd Street, Madison, IN

Estimate:

- Estimate ID: EST-20260629-002
- Created: Jun 29, 2026, 3:58 PM
- Job summary: Remove 2 maple trees near the back fence.
- Work description: Remove 2 maple trees near the back fence. Customer requested pricing for basic cut-and-stack versus full removal with debris haul-away and stump grinding.

Options:

- Option A - Cut and Stack - $1,800
  - Cut both trees and leave wood stacked on property.
- Option B - Full Removal - $2,750
  - Cut both trees, haul debris, and grind stumps.
- Option C - Full Removal + Cleanup - $3,100
  - Cut both trees, haul debris, grind stumps, rake work area, and remove small branches.

Important: on Tree Dude screens, options are quote options to review, not choices for Tree Dude to select.

## Overall Tree Dude Flow

Show these screens in order:

1. TD0 - Front Page
2. TD1 - New Quote
3. TD2 - AI Review / Check Details
4. TD3 - Confirm Quote
5. TD4 - Quote Confirmed / Send or Share
6. TD5 - Manual Acceptance Form
7. TD6 - Accepted Result

There is no separate Waiting on Customer screen in this pass. Waiting, sent, copied, and accepted states are represented by Front Page recent activity cards.

## TD0 - Front Page

Purpose: this is the home screen Tree Dude sees when he opens the app.

Screen title:

```text
Alpha Tree Service
```

Subtitle:

```text
Quotes and customer approvals
```

Main buttons, in this exact order:

```text
New Quote
Recent Estimates
Record Manual Acceptance
```

These buttons should be full-width or nearly full-width on phone. `New Quote` is the primary button. `Recent Estimates` and `Record Manual Acceptance` are secondary but still look like buttons.

Below the three buttons, show a section:

```text
Recent Activity
```

Show exactly 3 recent activity cards. Do not add a full dashboard. Do not add search or filters.

Recent card 1:

```text
Maria Lopez
EST-20260629-002
Signed Estimate Received
Jun 29, 2026, 4:25 PM
```

Actions:

```text
Open
Download Signed Estimate
```

Recent card 2:

```text
Dale Porter
EST-20260629-001
Ready to Share
Jun 29, 2026, 4:05 PM
```

Actions:

```text
Open
Copy Link to Estimate
Record Manual Acceptance
```

Recent card 3:

```text
Carla Evans
EST-20260628-004
Manual Acceptance Recorded
Jun 28, 2026, 6:12 PM
```

Actions:

```text
Open
Download Accepted Estimate
```

Card design:

- Keep each card compact.
- Show customer name first.
- Show estimate ID as small supporting text.
- Show status as a pill or strong line.
- Show time in muted text.
- Actions should be small but readable buttons.
- Do not show raw Blob URLs or internal file paths.

Behavior:

- `New Quote` starts TD1.
- `Recent Estimates` may scroll to or open the same recent cards in this MVP. It does not need a full history page.
- `Record Manual Acceptance` opens TD5 and lets Tree Dude choose or enter an estimate ID.

## TD1 - New Quote

Purpose: Tree Dude enters rough customer/job notes. This screen captures what Tree Dude knows before AI cleanup.

Screen title:

```text
New Quote
```

Short helper:

```text
Enter what you know. The review screen will flag missing details.
```

Fields:

```text
Customer name
Maria Lopez
```

```text
Customer phone
812-555-0134
```

```text
Customer email
maria.lopez@example.com
```

```text
Service address
805 2nd Street, Madison, IN
```

```text
Job notes
Remove 2 maple trees near back fence. Option A cut and stack 1800. Option B full removal haul debris and grind stumps 2750. Option C full removal cleanup rake area 3100.
```

Helper under job notes:

```text
Include tree count, location, cleanup, hauling, stump grinding, access issues, and prices/options.
```

Buttons:

```text
Create Review
Clear
```

Behavior:

- `Create Review` is the primary button.
- Job notes are required.
- If customer name, phone, email, or address are incomplete, Tree Dude may still continue if notes exist.
- Missing information should appear clearly on TD2.
- `Clear` resets the form.

Visual note:

This screen may be a bit more form-like than later screens, but still keep fields large and easy to tap.

## TD2 - AI Review / Check Details

Purpose: AI has parsed the rough notes. Tree Dude checks the extracted info before confirming the quote.

Screen title:

```text
AI Review
```

Subtitle:

```text
Check details before confirming quote
```

Show a compact status line:

```text
Review ready
```

or if missing information:

```text
Needs more info
```

Card 1 title:

```text
Customer
```

Card content:

```text
Maria Lopez
812-555-0134
maria.lopez@example.com
805 2nd Street, Madison, IN
```

Card 2 title:

```text
Job Summary
```

Card content:

```text
Remove 2 maple trees near the back fence.
```

Card 3 title:

```text
Quote Options
```

Card content:

```text
Option A - Cut and Stack - $1,800
Cut both trees and leave wood stacked on property.

Option B - Full Removal - $2,750
Cut both trees, haul debris, and grind stumps.

Option C - Full Removal + Cleanup - $3,100
Cut both trees, haul debris, grind stumps, rake work area, and remove small branches.
```

Important visible note:

```text
Tree Dude reviews these options. The customer chooses one later.
```

If there are missing details, show a checklist card:

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

Behavior:

- `Edit Info` returns to TD1 with existing text preserved.
- `Confirm Quote` is primary.
- `Confirm Quote` is disabled if validation has blocking errors.
- If disabled, show:

```text
Fix missing info before confirming quote.
```

Do not show:

- option radio buttons
- selected option state
- customer signature field
- e-signature checkbox
- customer acceptance wording

## TD3 - Confirm Quote

Purpose: final Tree Dude review before the estimate becomes ready to send/share.

Screen title:

```text
Confirm Quote
```

Subtitle:

```text
This creates the customer estimate link.
```

Summary card:

```text
Maria Lopez
805 2nd Street, Madison, IN
Remove 2 maple trees near the back fence.
```

Options card:

```text
Customer options
Option A - Cut and Stack - $1,800
Option B - Full Removal - $2,750
Option C - Full Removal + Cleanup - $3,100
```

Important note:

```text
Do not choose an option here. Maria will choose one when she opens the estimate.
```

Buttons:

```text
Back
Confirm Quote
```

Behavior:

- `Confirm Quote` stores/updates the estimate.
- `Confirm Quote` creates or confirms the clean customer route `/e/EST-20260629-002`.
- After confirmation, go to TD4.

Visual note:

This screen should feel like a final quote approval by Tree Dude, not a contract acceptance by the customer.

## TD4 - Quote Confirmed / Send or Share

Purpose: the quote is now ready. Tree Dude can send, copy, or download it.

Screen title:

```text
Quote Confirmed
```

Subtitle:

```text
Ready to send to customer
```

Main action buttons, immediately below subtitle:

```text
Send SMS
Send Email
Copy Link to Estimate
Download Estimate
```

Disabled examples:

If phone missing:

```text
Send SMS
SMS unavailable - missing phone
```

If email missing:

```text
Send Email
Email unavailable - missing email
```

Mock-safe notice:

```text
Mock mode: no real SMS or email was sent.
```

Estimate details:

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

Secondary action:

```text
Record Manual Acceptance
```

Helper:

```text
Use this only if the customer approved outside the app, such as by phone call, text reply, email reply, or in person.
```

Status title after action:

- If SMS preview/action used: `Sent to Customer by SMS`
- If email preview/action used: `Sent to Customer by Email`
- If both used: `Sent to Customer by SMS and Email`
- If only copied: `Ready to Share with Customer`

Do not say `Sent by SMS` if Tree Dude only copied the link.

Do not show:

- raw Blob URL
- customer option selector
- signature form
- internal storage details

## TD5 - Record Manual Acceptance

Purpose: record acceptance that already happened outside the app.

Screen title:

```text
Record Manual Acceptance
```

Intro:

```text
Use this when the customer approved outside the app, such as by phone call, text reply, email reply, or in person.
```

Read-only estimate summary:

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
Phone call
Text reply
Email reply
In person
Other
```

Required field:

```text
Customer note/reply
```

Placeholder:

```text
Customer texted: Go ahead with Option B.
```

Optional field:

```text
Typed name/signature if available
```

Placeholder:

```text
Maria Lopez
```

Buttons:

```text
Cancel
Save Manual Acceptance
```

Behavior:

- `Save Manual Acceptance` is disabled until accepted option, approval method, and customer note/reply are filled.
- Accepted date/time is captured automatically.
- After save, go to TD6.
- Manual acceptance does not mean Tree Dude chose the option himself. It means he recorded what the customer accepted outside the app.

## TD6 - Accepted Result

Purpose: show final operational result after customer signature or manual acceptance.

If customer signed in the app, title:

```text
Signed Estimate Received
```

If manual acceptance was recorded, title:

```text
Manual Acceptance Recorded
```

Customer signed in app summary:

```text
Maria Lopez accepted Option B - Full Removal - $2,750
Signed by: Maria Lopez
Signed: Jun 29, 2026, 4:25 PM
Method: Customer app signature
```

Manual acceptance summary:

```text
Maria Lopez accepted Option B - Full Removal - $2,750
Accepted: Jun 29, 2026, 4:25 PM
Method: Text reply
Note: Customer texted: Go ahead with Option B.
```

Actions for signed estimate:

```text
Download Signed Estimate
Copy Link to Estimate
Back to Front Page
```

Actions for manual acceptance:

```text
Download Accepted Estimate
Copy Link to Estimate
Back to Front Page
```

If PDF is unavailable:

```text
PDF is not available yet. The accepted estimate has still been recorded.
```

If fallback exists:

```text
Download Accepted HTML
```

Do not show:

- raw Blob URL
- internal storage path
- customer-facing follow-up message
- receipt confirmation

## Recent Activity Statuses

Use these statuses in cards:

- Draft
- Quote Confirmed
- Ready to Share
- Sent by SMS
- Sent by Email
- Sent by SMS and Email
- Viewed by Customer
- Accepted by Customer
- Signed Estimate Received
- Manual Acceptance Recorded
- Accepted Estimate Received

Only show statuses that match what actually happened.

## Visual Test Cases

Test TD0:

- Front Page shows three main buttons.
- Front Page shows exactly 3 recent activity cards.
- No filters/search appear.

Test TD2:

- Tree Dude sees options but cannot select one.
- `Confirm Quote` exists.
- Missing info blocks confirmation.

Test TD4:

- Buttons say `Send SMS`, `Send Email`, `Copy Link to Estimate`, `Download Estimate`.
- Missing phone disables SMS.
- Missing email disables email.
- Clean route `/e/EST-20260629-002` is visible.
- Raw Blob URL is not visible.

Test TD5:

- Manual form explains outside-app acceptance.
- Accepted option is selected only after customer approved outside the app.
- Approval methods include phone call, text reply, email reply, and in person.

Test TD6:

- Signed result uses `Download Signed Estimate`.
- Manual result uses `Download Accepted Estimate`.
- Date/time is shown.
- No receipt confirmation appears.

## One-Sentence Summary For GPT

Tree Dude opens a simple Alpha Tree Service home screen, starts a quote, reviews AI-generated quote details, confirms the quote, sends or shares a clean estimate link, and can record outside-app acceptance without ever choosing the customer's option himself.
