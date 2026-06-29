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

test("normal UI does not render raw AlphaJSON debug panel", () => {
  assert.doesNotMatch(pageSource, /<h2>AlphaJSON<\/h2>/);
  assert.doesNotMatch(pageSource, /JSON\.stringify\(alphaJson/);
});

test("Edit Notes focuses the textarea and shows a visible retry message", () => {
  assert.match(pageSource, /notesRef\.current\?\.scrollIntoView/);
  assert.match(pageSource, /notesRef\.current\?\.focus/);
  assert.match(inputFormSource, /data-testid="edit-notes-message"/);
});

test("initial desktop layout centers the Customer Notes card", () => {
  assert.match(pageSource, /app-grid-initial/);
  assert.match(cssSource, /\.app-grid-initial\s*\{/);
  assert.match(cssSource, /justify-content:\s*center/);
  assert.match(cssSource, /width:\s*min\(100%, 720px\)/);
});

test("workflow actions use customer-safe labels and clean estimate route", () => {
  assert.match(submissionButtonsSource, /Preview Email to Tree Dude/);
  assert.match(submissionButtonsSource, /Mock mode: no real SMS or email was sent\./);
  assert.match(pdfGeneratorSource, /Download Full PDF/);
  assert.match(pdfGeneratorSource, /Download Mobile PDF/);
  assert.match(pdfGeneratorSource, /Download Signed PDF/);
  assert.match(pdfGeneratorSource, /View Customer Estimate/);
  assert.equal(existsSync("app/e/[estimateId]/page.js"), true);
  assert.equal(existsSync("app/e/[estimateId]/EstimateClient.jsx"), true);
});

test("customer route and worker panel require compact e-signature consent", () => {
  const consentText = /I agree to receive and sign this estimate electronically/;
  assert.match(customerRouteSource, consentText);
  assert.match(pdfGeneratorSource, consentText);
  assert.match(customerRouteSource, /checkboxAccepted/);
  assert.match(pdfGeneratorSource, /checkboxAccepted/);
});

test("manual acceptance foundation exists without multi-company scope", () => {
  assert.equal(existsSync("app/api/manual-acceptance/route.js"), true);
  assert.match(pdfGeneratorSource, /Record Manual Acceptance/);
  assert.doesNotMatch(pdfGeneratorSource, /Beta Tree/i);
});
