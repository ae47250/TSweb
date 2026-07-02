import { LEGAL_DISCLAIMER, TREE_DUDE_EMAIL, TREE_DUDE_PHONE } from "../config/constants.js";
import { buildCustomerJobSummary } from "./normalizeAlphaJson.js";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderCustomerDocument(alphaJson, { mobile = false, signature = "", selectedOption = "", signedAtDisplay = "" } = {}) {
  const options = alphaJson.service_options?.items || [];
  const workDescription = buildCustomerJobSummary(alphaJson);
  const optionHtml = options
    .map((option) => {
      const selected = selectedOption === option.label ? " selected" : "";
      return `<button class="option-button${selected}" data-option="${esc(option.label)}">
        <strong>${esc(option.label)}:</strong> ${esc(option.title)}
        <span>${esc(option.price?.display)}</span>
        <small>${esc(option.description)}</small>
      </button>`;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(alphaJson.document?.number)} ${mobile ? "Mobile" : "Full"} Estimate</title>
  <style>
    body { font-family: Arial, sans-serif; color: #222; margin: 0; background: #f5f5f5; }
    .page { width: ${mobile ? "100%" : "8.5in"}; max-width: 100%; min-height: ${mobile ? "auto" : "11in"}; margin: 0 auto; background: #fff; padding: ${mobile ? "16px" : "0.45in"}; box-sizing: border-box; }
    header { border-bottom: 4px solid #3f7045; margin-bottom: 18px; padding-bottom: 12px; }
    h1 { color: #1f4229; margin: 0; font-size: ${mobile ? "24px" : "30px"}; }
    h2 { color: #1f4229; margin: 18px 0 8px; font-size: 18px; }
    .meta { display: grid; grid-template-columns: ${mobile ? "1fr" : "1fr 1fr"}; gap: 10px; }
    .box { border: 1px solid #ddd; border-radius: 6px; padding: 10px; margin-bottom: 10px; }
    .options { display: grid; gap: 8px; }
    .option-button { display: grid; grid-template-columns: ${mobile ? "1fr" : "110px 1fr 100px"}; gap: 8px; width: 100%; text-align: left; border: 2px solid #ddd; background: #fafafa; border-radius: 8px; padding: 10px; }
    .option-button.selected { border-color: #3f7045; background: #eef6ed; }
    .option-button.selected::before { content: "Selected"; color: #3f7045; font-weight: 700; }
    .notes { max-height: 150px; overflow: hidden; }
    .legal-disclaimer { border-left: 4px solid #f1ce55; background: #fffbe8; padding: 10px; margin: 12px 0; font-size: 12px; }
    .signature { font-family: cursive; font-size: 28px; border-bottom: 1px solid #222; min-height: 40px; color: #1f4229; }
    .actions { display: grid; grid-template-columns: ${mobile ? "1fr" : "1fr 1fr"}; gap: 10px; margin-top: 12px; }
    .actions button, .actions a { padding: 12px; border-radius: 6px; border: 0; background: #3f7045; color: #fff; font-weight: 700; text-align: center; text-decoration: none; }
    .actions .secondary { background: #f0f0f0; color: #222; border: 1px solid #ddd; }
    @media print { body { background: #fff; } .page { width: auto; min-height: auto; } }
  </style>
</head>
<body>
  <main class="page">
    <header>
      <h1>Alpha Tree Service</h1>
      <div>${esc(alphaJson.document?.title)} | ${esc(alphaJson.document?.number)} | ${esc(alphaJson.document?.date_display)}</div>
    </header>
    <section class="meta">
      <div class="box"><strong>Customer</strong><br>${esc(alphaJson.customer?.name || "Customer")}<br>${esc(alphaJson.customer?.phone_display)}</div>
      <div class="box"><strong>Service Address</strong><br>${esc(alphaJson.job?.service_address?.display)}</div>
    </section>
    <section>
      <h2>Work Description</h2>
      <div class="box">${esc(workDescription)}</div>
    </section>
    <section>
      <h2>Options</h2>
      <div class="options">${optionHtml}</div>
    </section>
    <section>
      <h2>Notes</h2>
      <div class="box notes">${esc(alphaJson.notes?.display_notes || "No additional customer-visible notes.")}</div>
    </section>
    <section>
      <h2>Authorization</h2>
      <div class="legal-disclaimer">${esc(LEGAL_DISCLAIMER)}</div>
      <div>Selected option: <strong>${esc(selectedOption || "Not selected")}</strong></div>
      <div class="signature">${esc(signature)}</div>
      <div>Signed: ${esc(signedAtDisplay || "Not signed yet")}</div>
      <div>Date: ${esc(new Date().toLocaleDateString("en-US"))}</div>
      <div class="actions">
        <a class="secondary" href="mailto:${TREE_DUDE_EMAIL}?subject=Signed Estimate ${esc(alphaJson.document?.number)}">Preview Email to Tree Dude</a>
        <button type="button">Submit to Contractor (${TREE_DUDE_PHONE})</button>
      </div>
      <div class="legal-disclaimer">Mock mode: no real SMS or email was sent.</div>
    </section>
  </main>
</body>
</html>`;
}

export function renderTreeDudeDocument(alphaJson, { warnings = [] } = {}) {
  const options = alphaJson.service_options?.items || [];
  const workDescription = buildCustomerJobSummary(alphaJson);
  const warningItems = warnings.length ? warnings : alphaJson.review?.override_warnings || [];
  const optionHtml = options
    .map((option) => `<div class="box option-row">
      <strong>${esc(option.label)}:</strong>
      <span>${esc(option.title)}</span>
      <span>${esc(option.price?.display)}</span>
      <small>${esc(option.description)}</small>
    </div>`)
    .join("");
  const warningHtml = warningItems.length
    ? warningItems
      .map((warning) => `<li><strong>${esc(warning.title)}:</strong> ${esc(warning.message)}</li>`)
      .join("")
    : "<li>No internal override warnings were recorded.</li>";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(alphaJson.document?.number)} Tree Dude Copy</title>
  <style>
    body { font-family: Arial, sans-serif; color: #222; margin: 0; background: #f5f5f5; }
    .page { width: 8.5in; max-width: 100%; min-height: 11in; margin: 0 auto; background: #fff; padding: 0.45in; box-sizing: border-box; }
    header { border-bottom: 4px solid #3f7045; margin-bottom: 18px; padding-bottom: 12px; }
    h1 { color: #1f4229; margin: 0; font-size: 30px; }
    h2 { color: #1f4229; margin: 18px 0 8px; font-size: 18px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .box { border: 1px solid #ddd; border-radius: 6px; padding: 10px; margin-bottom: 10px; }
    .warning-box { background: #fff7ed; border: 3px solid #f97316; border-radius: 8px; padding: 12px; margin: 14px 0; }
    .warning-box h2 { color: #7c2d12; margin-top: 0; }
    .warning-box li { margin-bottom: 6px; }
    .option-row { display: grid; grid-template-columns: 90px 1fr 100px; gap: 8px; }
    .option-row small { grid-column: 2 / -1; }
    @media print { body { background: #fff; } .page { width: auto; min-height: auto; } }
  </style>
</head>
<body>
  <main class="page">
    <header>
      <h1>Alpha Tree Service - Tree Dude Copy</h1>
      <div>${esc(alphaJson.document?.title)} | ${esc(alphaJson.document?.number)} | ${esc(alphaJson.document?.date_display)}</div>
    </header>
    <section class="warning-box">
      <h2>Internal Warnings</h2>
      <ul>${warningHtml}</ul>
      <p>These warnings are for Tree Dude's copy only. They are not printed on the customer estimate.</p>
    </section>
    <section class="meta">
      <div class="box"><strong>Customer</strong><br>${esc(alphaJson.customer?.name || "Customer")}<br>${esc(alphaJson.customer?.phone_display || "Phone missing")}<br>${esc(alphaJson.customer?.email || "Email missing")}</div>
      <div class="box"><strong>Service Address</strong><br>${esc(alphaJson.job?.service_address?.display || "Address missing")}</div>
    </section>
    <section>
      <h2>Work Description</h2>
      <div class="box">${esc(workDescription)}</div>
    </section>
    <section>
      <h2>Quote Options</h2>
      ${optionHtml}
    </section>
  </main>
</body>
</html>`;
}
