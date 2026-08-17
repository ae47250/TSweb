import test from "node:test";
import assert from "node:assert/strict";
import { createDraftAlphaJson } from "../lib/alphaJson.js";
import { renderCustomerDocument } from "../lib/customerDocument.js";
import { formatPingramErrorDetail, notifyContractor, notifyCustomerEstimate } from "../lib/notifications.js";
import { validateAlphaJson } from "../lib/validateJson.js";
import { difficultInput, easyInput } from "./fixtures/sampleInput.js";

test("integration iteration: easy customer reaches customer document", () => {
  const alphaJson = validateAlphaJson(createDraftAlphaJson(easyInput)).alphaJson;
  const html = renderCustomerDocument(alphaJson, {
    selectedOption: "Option A",
    signature: "John Smith",
  });
  assert.match(html, /Alpha Tree Service/);
  assert.match(html, /Option A/);
  assert.match(html, /John Smith/);
  assert.match(html, /electronic signature/);
});

test("integration iteration: difficult customer asks follow-up instead of guessing", () => {
  const result = validateAlphaJson(createDraftAlphaJson(difficultInput));
  assert.equal(result.can_generate_pdf, false);
  assert.ok(result.follow_ups.length >= 1);
});

test("mock notification targets Pingram phone and tree dude email without sending", async () => {
  const result = await notifyContractor({
    documentId: "EST-20260629-001",
    customerName: "John Smith",
    address: "805 2nd Street",
    selectedOption: "Option A",
    price: "$2,000",
  });
  assert.equal(result.mocked, true);
  assert.equal(result.sentSms, false);
  assert.equal(result.sentEmail, false);
  assert.equal(result.intendedRecipients.phone, "502-310-6952");
  assert.equal(result.intendedRecipients.email, "huagalli@hotmail.com");
  assert.equal(
    result.payload.email.payload.email.html,
    "John Smith accepted Option A - $2,000. View signed estimate: /e/EST-20260629-001<br><br>Service address: 805 2nd Street",
  );
});

test("notification email escapes customer-controlled markup and preserves safe links", async () => {
  const result = await notifyContractor({
    documentId: "EST-20260629-001",
    customerName: '<img src=x onerror="alert(1)">',
    address: '<b>805 <a href="https://attacker.example">2nd Street</a></b>',
    selectedOption: '<a href="https://attacker.example" title="Injected">Option A</a>',
    price: "$2,000 & more",
    signedAtDisplay: '<script data-test="injected">bad</script>',
    estimateUrl: "https://example.com/e/EST-20260629-001?foo=1&bar=2",
  });
  const html = result.payload.email.payload.email.html;

  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /&lt;a href=&quot;https:\/\/attacker\.example&quot; title=&quot;Injected&quot;&gt;Option A&lt;\/a&gt;/);
  assert.match(html, /&lt;script data-test=&quot;injected&quot;&gt;bad&lt;\/script&gt;/);
  assert.match(html, /Service address: &lt;b&gt;805 &lt;a href=&quot;https:\/\/attacker\.example&quot;&gt;2nd Street&lt;\/a&gt;&lt;\/b&gt;/);
  assert.match(html, /https:\/\/example\.com\/e\/EST-20260629-001\?foo=1&amp;bar=2/);
  assert.match(html, /<br><br>/);
  assert.doesNotMatch(html, /<(?:img|a|b|script)\b/i);
});

test("mock customer estimate notification uses Pingram without sending", async () => {
  const result = await notifyCustomerEstimate({
    channel: "sms",
    documentId: "EST-20260629-001",
    customerName: "John Smith",
    customerPhone: "502-555-0100",
    customerEmail: "john@example.com",
    estimateUrl: "https://example.com/e/EST-20260629-001",
  });
  assert.equal(result.mocked, true);
  assert.equal(result.sent, false);
  assert.equal(result.channel, "sms");
  assert.equal(result.to, "502-555-0100");
  assert.match(result.message, /https:\/\/example\.com\/e\/EST-20260629-001/);
});

test("Pingram object errors format as readable text", () => {
  const detail = formatPingramErrorDetail({
    code: "invalid_sms_recipient",
    message: { reason: "Phone number is not SMS-capable", providerStatus: 400 },
  });

  assert.match(detail, /Phone number is not SMS-capable|invalid_sms_recipient|providerStatus/);
  assert.doesNotMatch(detail, /\[object Object\]/);
});
