import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pageSource = readFileSync("app/page.js", "utf8");
const inputFormSource = readFileSync("app/components/InputForm.jsx", "utf8");
const cssSource = readFileSync("app/styles/globals.css", "utf8");

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
