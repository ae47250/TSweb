import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";

const pageSource = readFileSync("app/page.js", "utf8");
const inputFormSource = readFileSync("app/components/InputForm.jsx", "utf8");
const pdfGeneratorSource = readFileSync("app/components/PdfGenerator.jsx", "utf8");
const submissionButtonsSource = readFileSync("app/components/SubmissionButtons.jsx", "utf8");
const cssSource = readFileSync("app/styles/globals.css", "utf8");
const globalCssSource = readFileSync("styles-globals.css", "utf8");
const customerRouteSource = readFileSync("app/e/[estimateId]/EstimateClient.jsx", "utf8");
const openaiRouteSource = readFileSync("app/api/openai/route.js", "utf8");
const openaiPromptSource = readFileSync("lib/openaiPrompt.js", "utf8");
const debugPipelineSource = readFileSync("lib/debugPipeline.js", "utf8");

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
  assert.match(pageSource, /New Estimate/);
  assert.match(pageSource, /New Invoice/);
  assert.match(pageSource, /Recent Estimates/);
  assert.match(pageSource, /Record Manual Acceptance/);
  assert.doesNotMatch(pageSource, /Recent Activity/);
  assert.match(cssSource, /\.front-action-primary/);
  assert.match(cssSource, /min-height:\s*104px/);
  assert.match(cssSource, /\.front-action-invoice/);
  assert.match(cssSource, /\.front-action-recent/);
  assert.match(cssSource, /background:\s*#dbeafe/);
  assert.match(inputFormSource, /Fill in the red fields and add Job Notes/);
  assert.match(inputFormSource, /Review Estimate/);
  assert.match(inputFormSource, /Clear/);
  assert.match(inputFormSource, /Tree count/);
  assert.match(inputFormSource, /treeCountOverride/);
  assert.match(inputFormSource, /<option value="Auto">Auto<\/option>/);
  assert.match(inputFormSource, /<option value="Unknown">Unknown<\/option>/);
  assert.match(inputFormSource, /job-notes-card/);
  assert.match(inputFormSource, /Include<\/span> as much information as possible about the job, scope of work, and prices/);
  assert.match(inputFormSource, /btn-create-review/);
  assert.match(cssSource, /\.job-notes-card/);
  assert.match(cssSource, /border:\s*2px solid #b91c1c/);
  assert.match(cssSource, /\.job-notes-guidance/);
  assert.match(globalCssSource, /\.btn-create-review/);
  assert.match(globalCssSource, /\.banner/);
  assert.match(globalCssSource, /padding:\s*8px 14px/);
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
  assert.match(reviewSource, /Job Notes/);
  assert.doesNotMatch(reviewSource, /Include:/);
  assert.doesNotMatch(reviewSource, /job-notes-example-text/);
  assert.match(reviewSource, /intake = \{\}/);
  assert.match(reviewSource, /intake\.address/);
  assert.match(reviewSource, /normalizeServiceAddress/);
  assert.match(pageSource, /intake=\{quoteContact\}/);
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
  assert.match(reviewSource, /warningItems/);
  assert.match(reviewSource, /Warnings/);
  assert.match(reviewSource, /warning-card/);
  assert.match(reviewSource, /Fix missing info before confirming quote/);
  assert.match(reviewSource, /Edit Info/);
  assert.match(reviewSource, /customer-summary-card/);
  assert.match(reviewSource, /customer-info-grid/);
  assert.match(reviewSource, /customer-info-right/);
  assert.match(reviewSource, /td2-action-toolbar/);
  assert.match(cssSource, /\.td2-action-toolbar/);
  assert.match(cssSource, /\.warning-card/);
  assert.match(cssSource, /grid-template-columns:\s*max-content minmax\(0, 1fr\)/);
  assert.match(cssSource, /\.customer-summary-card/);
  assert.match(cssSource, /\.customer-info-grid/);
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

test("OpenAI prompt and route keep model output at extraction-draft boundary", () => {
  assert.match(openaiPromptSource, /draft_version/);
  assert.match(openaiPromptSource, /Do not create final AlphaJSON/);
  assert.match(openaiPromptSource, /Do not decide whether PDF generation is allowed/);
  assert.match(openaiPromptSource, /Do not sort or relabel options/);
  assert.doesNotMatch(openaiPromptSource, /alphaJson must be compatible/i);
  assert.doesNotMatch(openaiPromptSource, /Set validation\.can_generate_pdf/i);
  assert.match(openaiRouteSource, /parseOpenAiDraft/);
  assert.match(openaiRouteSource, /openAiDraftToNormalizerInput/);
  assert.match(openaiRouteSource, /normalizeToAlphaJsonV14\(normalizerInput,\s*customerText,\s*intake\)/);
  assert.match(openaiRouteSource, /buildDebugPipelinePayload/);
  assert.match(debugPipelineSource, /structured_follow_ups/);
});
