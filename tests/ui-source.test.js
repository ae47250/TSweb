import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";

const pageSource = readFileSync("app/page.js", "utf8");
const inputFormSource = readFileSync("app/components/InputForm.jsx", "utf8");
const pdfGeneratorSource = readFileSync("app/components/PdfGenerator.jsx", "utf8");
const submissionButtonsSource = readFileSync("app/components/SubmissionButtons.jsx", "utf8");
const cssSource = readFileSync("app/styles/globals.css", "utf8");
const customerRouteSource = readFileSync("app/e/[estimateId]/EstimateClient.jsx", "utf8");
const openaiRouteSource = readFileSync("app/api/openai/route.js", "utf8");

test("normal UI does not render raw AlphaJSON debug panel", () => {
  assert.doesNotMatch(pageSource, /<h2>AlphaJSON<\/h2>/);
  assert.doesNotMatch(pageSource, /JSON\.stringify\(alphaJson/);
});

test("Edit Notes focuses the textarea and shows a visible retry message", () => {
  assert.match(pageSource, /notesRef\.current\?\.scrollIntoView/);
  assert.match(pageSource, /notesRef\.current\?\.focus/);
  assert.match(inputFormSource, /data-testid="edit-notes-message"/);
  assert.match(pageSource, /quoteContact/);
  assert.match(inputFormSource, /contactValue/);
  assert.match(inputFormSource, /onContactChange/);
  assert.match(pageSource, /setCustomerText\(savedNotes\)/);
});

test("initial desktop layout centers the Customer Notes card", () => {
  assert.match(pageSource, /app-grid-initial/);
  assert.match(cssSource, /\.app-grid-initial\s*\{/);
  assert.match(cssSource, /justify-content:\s*center/);
  assert.match(cssSource, /width:\s*min\(100%, 720px\)/);
});

test("workflow actions use customer-safe labels and clean estimate route", () => {
  assert.match(pageSource, /New Quote/);
  assert.match(pageSource, /Recent Estimates/);
  assert.match(pageSource, /Record Manual Acceptance/);
  assert.match(inputFormSource, /Enter what you know/);
  assert.match(inputFormSource, /Create Review/);
  assert.match(inputFormSource, /Clear/);
  assert.match(pdfGeneratorSource, /Inform Customer/);
  assert.match(pdfGeneratorSource, /Send SMS/);
  assert.match(pdfGeneratorSource, /Send Email/);
  assert.match(pdfGeneratorSource, /Download Estimate/);
  assert.match(pdfGeneratorSource, /Copy Link to Estimate/);
  assert.match(pdfGeneratorSource, /Send Now/);
  assert.match(pdfGeneratorSource, /setActivePreview\(""\)/);
  assert.match(pdfGeneratorSource, /sendCustomerMessage/);
  assert.match(pdfGeneratorSource, /recipient:\s*"customer"/);
  assert.doesNotMatch(pdfGeneratorSource, /function sendMock/);
  assert.match(pdfGeneratorSource, /Copy Link to Completed Estimate/);
  assert.match(pdfGeneratorSource, /Back to Front Page/);
  assert.match(pdfGeneratorSource, /btn-neutral/);
  assert.match(pdfGeneratorSource, /btn-light-orange/);
  assert.match(pdfGeneratorSource, /btn-light-blue/);
  assert.match(pdfGeneratorSource, /btn-yellow/);
  assert.equal(existsSync("app/api/estimates/[documentId]/route.js"), true);
  assert.equal(existsSync("app/e/[estimateId]/page.js"), true);
  assert.equal(existsSync("app/e/[estimateId]/EstimateClient.jsx"), true);
});

test("Tree Dude review and confirm screens separate AI review from final quote approval", () => {
  const reviewSource = readFileSync("app/components/JsonReview.jsx", "utf8");
  assert.match(pageSource, /stage === "review"/);
  assert.match(pageSource, /mode="review"/);
  assert.match(pageSource, /mode="confirm"/);
  assert.match(reviewSource, /AI Review/);
  assert.match(reviewSource, /Check details before confirming quote/);
  assert.match(reviewSource, /Review ready/);
  assert.match(reviewSource, /Needs more info/);
  assert.match(reviewSource, /Job Summary/);
  assert.match(reviewSource, /Structured from the reviewed job details/);
  assert.match(reviewSource, /buildCustomerJobSummary/);
  assert.match(reviewSource, /structuredJobSummary\s*\|\|\s*cleanJobNotesForReview/);
  assert.match(reviewSource, /Quote Options/);
  assert.match(reviewSource, /Customer Options/);
  assert.match(reviewSource, /quote-option-card/);
  assert.match(reviewSource, /Option 1/);
  assert.match(reviewSource, /normalizeTreeServiceText/);
  assert.match(reviewSource, /orderJobWarningsLast/);
  assert.match(reviewSource, /Tree Dude reviews these options/);
  assert.match(reviewSource, /Do not choose an option here/);
  assert.match(reviewSource, /Needs More Info/);
  assert.match(reviewSource, /Fix missing info before confirming quote/);
  assert.match(reviewSource, /Edit Info/);
});

test("customer route requires compact e-signature consent and Tree Dude panel does not sign for customer", () => {
  const consentText = /I agree to receive and sign this estimate electronically/;
  assert.match(customerRouteSource, consentText);
  assert.match(customerRouteSource, /checkboxAccepted/);
  assert.match(customerRouteSource, /buildCustomerJobSummary/);
  assert.match(customerRouteSource, /workDescription/);
  assert.doesNotMatch(pdfGeneratorSource, consentText);
  assert.doesNotMatch(pdfGeneratorSource, /checkboxAccepted/);
  assert.doesNotMatch(pdfGeneratorSource, /onSelectOption/);
});

test("customer-facing estimate documents use cleaned job notes without internal evidence fields", () => {
  const customerDocumentSource = readFileSync("lib/customerDocument.js", "utf8");
  assert.match(customerDocumentSource, /buildCustomerJobSummary/);
  assert.match(customerDocumentSource, /workDescription/);
  assert.doesNotMatch(customerRouteSource, /field_evidence/);
  assert.doesNotMatch(customerRouteSource, /uncertainties/);
  assert.doesNotMatch(customerDocumentSource, /field_evidence/);
  assert.doesNotMatch(customerDocumentSource, /uncertainties/);
});

test("manual acceptance foundation exists without multi-company scope", () => {
  assert.equal(existsSync("app/api/manual-acceptance/route.js"), true);
  assert.match(pdfGeneratorSource, /Record Manual Acceptance/);
  assert.match(pdfGeneratorSource, /Acceptance has been saved/);
  assert.match(pdfGeneratorSource, /Download Saved Estimate/);
  assert.doesNotMatch(pdfGeneratorSource, /Beta Tree/i);
});

test("OpenAI route can use reasoning effort without affecting non-reasoning models", () => {
  const envExampleSource = readFileSync(".env.example", "utf8");
  assert.match(openaiRouteSource, /OPENAI_REASONING_EFFORT/);
  assert.match(openaiRouteSource, /reasoning_effort/);
  assert.match(openaiRouteSource, /gpt-5/);
  assert.match(openaiRouteSource, /gpt-4o/);
  assert.match(envExampleSource, /OPENAI_REASONING_EFFORT=/);
});

test("OpenAI route logs production case metrics without raw customer text", () => {
  assert.match(openaiRouteSource, /openai_case_result/);
  assert.match(openaiRouteSource, /case_id/);
  assert.match(openaiRouteSource, /model/);
  assert.match(openaiRouteSource, /reasoning_effort/);
  assert.match(openaiRouteSource, /input_tokens/);
  assert.match(openaiRouteSource, /output_tokens/);
  assert.match(openaiRouteSource, /total_tokens/);
  assert.match(openaiRouteSource, /parse_block_outcome/);
  assert.match(openaiRouteSource, /error_message/);
  assert.match(openaiRouteSource, /validateAlphaJson/);
  assert.doesNotMatch(openaiRouteSource, /customerText,\s*$/m);
});
