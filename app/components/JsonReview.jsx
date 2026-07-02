"use client";

import { useState } from "react";
import { buildCustomerJobSummary, normalizeServiceAddress, normalizeTreeServiceText } from "../../lib/normalizeAlphaJson.js";

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const warningPattern = /\b(aggressive\s+dogs?|dogs?|warning|hazard|power\s*lines?|wires?|unsafe|locked\s+gate|gate\s+code|access|poison\s+ivy|bees?|wasps?)\b/i;
const treePattern = /\b(trees?|limbs?|branches?|stumps?|oak|pine|maple|ash|elm|cedar|sycamore|trim|remove|removal|cut|drop|haul|cleanup|grind)\b/i;

function splitNoteParts(text) {
  return normalizeTreeServiceText(text)
    .split(/(?<=[.!?])\s+|;\s+|,\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function extractWarningParts(text) {
  return splitNoteParts(text).filter((part) => warningPattern.test(part));
}

function orderJobWarningsLast(text) {
  const normalized = normalizeTreeServiceText(text);
  const parts = splitNoteParts(normalized);

  if (parts.length < 2) return normalized;

  const jobParts = parts.filter((part) => !warningPattern.test(part));
  const warningParts = parts.filter((part) => warningPattern.test(part));

  if (!warningParts.length || !jobParts.some((part) => treePattern.test(part))) return normalized;

  return [...jobParts, ...warningParts.map((part) => /^warning:/i.test(part) ? part : `Warning: ${part}`)]
    .join(". ")
    .replace(/\s+\./g, ".")
    .replace(/\.+/g, ".")
    .trim();
}

function cleanJobNotesForReview(sourceNotes, alphaJson) {
  let text = String(sourceNotes || alphaJson.job?.description || "").trim();
  const customer = alphaJson.customer || {};
  const address = alphaJson.job?.service_address?.display || "";
  const removals = [
    customer.name,
    customer.phone_display,
    customer.phone_primary,
    customer.email,
    address,
  ].filter(Boolean);

  for (const value of removals) {
    text = text.replace(new RegExp(escapeRegExp(value), "gi"), " ");
  }

  text = text
    .replace(/\bCustomer\s+name\s*:\s*/gi, " ")
    .replace(/\bCustomer\s+phone\s*:\s*/gi, " ")
    .replace(/\bCustomer\s+email\s*:\s*/gi, " ")
    .replace(/\bService\s+address\s*:\s*/gi, " ")
    .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-./\s]?\d{3}[-./\s]?\d{4}\b/g, " ")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, " ");
  const warningParts = extractWarningParts(text);

  const optionIndex = text.search(/\bOption\s*(?:[A-E]|[1-5])\b/i);
  if (optionIndex > -1) text = text.slice(0, optionIndex);

  const priceIndex = text.search(/\$?\s*[0-9][0-9,]*(?:\.\d{2})?\b/);
  if (priceIndex > -1) text = text.slice(0, priceIndex);

  text = text
    .replace(/\b(?:for|at|price|cost|would be|is)\s*$/i, "")
    .replace(/[,:;.\s-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const cleanedText = normalizeTreeServiceText(text);
  const extraWarnings = warningParts.filter((part) => !cleanedText.toLowerCase().includes(normalizeTreeServiceText(part).toLowerCase()));
  const notesWithWarnings = [cleanedText, ...extraWarnings].filter(Boolean).join(". ");
  return orderJobWarningsLast(notesWithWarnings || alphaJson.job?.description || "No job notes supplied.");
}

function formatDebugJson(value) {
  return JSON.stringify(value ?? null, null, 2);
}

function DebugJsonBlock({ value }) {
  return <pre className="debug-json-block">{formatDebugJson(value)}</pre>;
}

function highlightDebugCorrections(text, corrections = []) {
  const sourceText = String(text || "");
  const originals = [...new Set(corrections.map((item) => String(item?.original || "").trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length);

  if (!originals.length) return sourceText;

  const pattern = new RegExp(`(${originals.map(escapeRegExp).join("|")})`, "gi");
  return sourceText.split(pattern).map((part, index) => (
    originals.some((original) => original.toLowerCase() === part.toLowerCase())
      ? <strong className="debug-typo-highlight" key={`${part}-${index}`}>{part}</strong>
      : part
  ));
}

function DebugTextBlock({ text, corrections = [] }) {
  return <div className="debug-text-block">{highlightDebugCorrections(text, corrections)}</div>;
}

function DebugOpenAiDraft({ debugPipeline }) {
  if (debugPipeline.source === "local-draft-parser") {
    return (
      <div className="debug-text-block debug-simulation-note">
        OpenAI not used - this is simulation.
      </div>
    );
  }

  return <DebugJsonBlock value={debugPipeline.rawOpenAiDraftJson} />;
}

function DebugRenderedRows({ renderedFields }) {
  const rows = [
    ["Customer name", renderedFields.customerCard.name.value, renderedFields.customerCard.name.source],
    ["Phone", renderedFields.customerCard.phone.value, renderedFields.customerCard.phone.source],
    ["Email", renderedFields.customerCard.email.value, renderedFields.customerCard.email.source],
    ["Service address", renderedFields.customerCard.serviceAddress.value, renderedFields.customerCard.serviceAddress.source],
    ["Job summary", renderedFields.jobSummary.value, renderedFields.jobSummary.source],
    ["Needs more info", renderedFields.needsMoreInfo.value, renderedFields.needsMoreInfo.source],
  ];

  return (
    <div className="debug-rendered-fields">
      {rows.map(([label, value, source]) => (
        <div className="debug-rendered-row" key={label}>
          <span className="debug-rendered-label">{label}</span>
          <span className="debug-rendered-value">{value || "None"}</span>
          <code>{source}</code>
        </div>
      ))}
      {renderedFields.quoteOptions.length > 0 && (
        <div className="debug-rendered-options">
          <span className="debug-rendered-label">Quote options</span>
          {renderedFields.quoteOptions.map((option) => (
            <div className="debug-rendered-option" key={option.label}>
              <strong>{option.label}</strong>
              <span>{option.price}</span>
              <p>{option.title}</p>
              <small>{option.description}</small>
              <code>{option.source}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function buildDebugExplanation(validation, renderedFields) {
  const blocking = validation?.blocking_errors || [];
  const followUps = validation?.follow_ups || [];
  const warnings = validation?.warnings || [];

  if (blocking.length > 0 || followUps.length > 0) {
    return {
      meaning: "The estimate is not ready for the customer yet. Validation found missing or unclear information.",
      suggestion: followUps[0] || blocking[0] || "Add the missing job details in TD1 and create the review again.",
      why: "TD2 should only confirm quotes when the address, contact method, work scope, and priced option are clear enough for a customer-facing estimate.",
    };
  }

  if (warnings.length > 0) {
    return {
      meaning: "The estimate can be generated, but Tree Dude should review one or more details.",
      suggestion: warnings[0],
      why: "Warnings do not block the quote, but they usually point to safety, access, address, or cleanup details worth checking before sending.",
    };
  }

  if (renderedFields.quoteOptions.length < 1) {
    return {
      meaning: "TD2 has no quote option to show.",
      suggestion: "Add at least one priced option in the notes, then create the review again.",
      why: "The customer needs a clear option and price before the estimate can be useful.",
    };
  }

  return {
    meaning: "The pipeline produced a customer-ready TD2 review.",
    suggestion: "Compare Raw TD1 Input with TD2 Rendered Fields. If TD2 looks wrong, the issue is probably in normalization or the TD2 display mapping.",
    why: "This shows whether the data changed during OpenAI drafting, cleanup, validation, or final TD2 rendering.",
  };
}

function DebugPipelinePanel({ debugPipeline, alphaJson, validation, renderedFields }) {
  const [isOpen, setIsOpen] = useState(false);
  if (!debugPipeline) return null;

  const explanation = buildDebugExplanation(validation, renderedFields);
  const rawText = debugPipeline.rawTd1Input?.customer_text || "";
  const corrections = (debugPipeline.cleanedCanonicalAlphaJson || alphaJson)?.normalization?.corrections_made || [];

  return (
    <section className="debug-pipeline-panel" aria-label="Debug Pipeline">
      <button className="btn-secondary debug-pipeline-toggle" type="button" onClick={() => setIsOpen((current) => !current)}>
        {isOpen ? "Hide Debug Pipeline" : "Show Debug Pipeline"}
      </button>
      {isOpen && (
        <div className="debug-pipeline-content">
          <div className="debug-explanation">
            <p><strong>What this means:</strong> {explanation.meaning}</p>
            <p><strong>Suggested fix:</strong> {explanation.suggestion}</p>
            <p><strong>Why:</strong> {explanation.why}</p>
          </div>

          <h3>Raw TD1 Input</h3>
          <p className="debug-field-note">This is exactly what TD1 sent as <code>customer_text</code>.</p>
          <DebugTextBlock text={rawText} corrections={corrections} />

          <h3>Raw OpenAI Draft JSON</h3>
          <p className="debug-field-note">This is the parsed OpenAI response before <code>normalizeToAlphaJsonV14()</code> cleaned it.</p>
          <DebugOpenAiDraft debugPipeline={debugPipeline} />

          <h3>Cleaned Canonical AlphaJSON</h3>
          <p className="debug-field-note">This is the AlphaJSON after <code>normalizeToAlphaJsonV14()</code>.</p>
          <DebugJsonBlock value={debugPipeline.cleanedCanonicalAlphaJson || alphaJson} />

          <h3>Validation Result</h3>
          <p className="debug-field-note">This decides whether TD2 can confirm the quote or needs more information.</p>
          <DebugJsonBlock value={debugPipeline.validationResult || validation} />

          <h3>TD2 Rendered Fields</h3>
          <p className="debug-field-note">This is what TD2 actually displays, with each field path shown beside its value.</p>
          <DebugRenderedRows renderedFields={renderedFields} />
        </div>
      )}
    </section>
  );
}

export default function JsonReview({ alphaJson, validation, debugPipeline = null, sourceNotes = "", intake = {}, mode = "review", onApprove, onEdit, busy = false }) {
  if (!alphaJson) return null;

  const options = alphaJson.service_options?.items || [];
  const structuredJobSummary = buildCustomerJobSummary(alphaJson);
  const jobNotes = structuredJobSummary || cleanJobNotesForReview(sourceNotes, alphaJson);
  const customerName = alphaJson.customer?.name || "Name not available";
  const customerPhone = alphaJson.customer?.phone_display || "Phone not available";
  const customerEmail = alphaJson.customer?.email || "Email not available";
  const jobAddress = alphaJson.job?.service_address?.display || normalizeServiceAddress(intake.address) || "Address missing";
  const canConfirm = Boolean(validation?.can_generate_pdf);
  const isFinalConfirm = mode === "confirm";
  const reviewIssues = validation?.follow_ups?.length
    ? validation.follow_ups
    : validation?.blocking_errors || [];
  const treeCountOverride = alphaJson.normalization?.field_evidence?.tree_count_override || "";
  const showTreeCountOverride = treeCountOverride && treeCountOverride !== "Auto";
  const title = isFinalConfirm ? "Confirm Quote" : "AI Review";
  const subtitle = isFinalConfirm ? "This creates the customer estimate link." : "Check details before confirming quote.";
  const optionNote = isFinalConfirm
    ? `Do not choose an option here. ${customerName === "Name not available" ? "The customer" : customerName} will choose one when opening the estimate.`
    : "Tree Dude reviews these options. The customer chooses one later.";
  const approveLabel = isFinalConfirm ? (busy ? "Confirming..." : "Confirm Quote") : "Confirm Quote";
  const editLabel = isFinalConfirm ? "Back" : "Edit Info";
  const warningItems = validation?.warnings || [];
  const renderedFields = {
    customerCard: {
      name: { value: customerName, source: "alphaJson.customer.name" },
      phone: { value: customerPhone, source: "alphaJson.customer.phone_display" },
      email: { value: customerEmail, source: "alphaJson.customer.email" },
      serviceAddress: { value: jobAddress, source: "alphaJson.job.service_address.display" },
    },
    jobSummary: { value: jobNotes, source: "buildCustomerJobSummary(alphaJson)" },
    quoteOptions: options.map((option, index) => ({
      label: option.label || `Option ${index + 1}`,
      price: option.price?.display || "Price missing",
      title: option.title || "Option details",
      description: option.description || "Add the work details for this option before informing the customer.",
      source: `service_options.items[${index}]`,
    })),
    needsMoreInfo: {
      value: [...(validation?.follow_ups || []), ...(validation?.blocking_errors || [])].join("; "),
      source: "validation.follow_ups + validation.blocking_errors",
    },
  };

  return (
    <section className="card">
      <h2>{title}</h2>
      <p className="text-muted">{subtitle}</p>
      {!isFinalConfirm && (
        <span className={`review-status ${canConfirm ? "review-status-ready" : "review-status-needs-info"}`}>
          {canConfirm ? "Review ready" : "Needs more info"}
        </span>
      )}
      {isFinalConfirm ? (
        <div className="summary-card final-summary-card">
          <h3>Summary</h3>
          <p><strong>{customerName}</strong></p>
          <p>{jobAddress}</p>
          <p>{jobNotes}</p>
        </div>
      ) : (
        <div className="review-grid">
          <div className="summary-card customer-summary-card">
            <h3>Customer</h3>
            <div className="customer-info-grid">
              <p>{customerName}</p>
              <p className="customer-info-right">{jobAddress}</p>
              <p>{customerPhone}</p>
              <p className="customer-info-right">{customerEmail}</p>
            </div>
          </div>
          <div className="summary-card review-job-notes-card">
            <h3>Job Notes</h3>
            <p className="job-summary-text">{jobNotes}</p>
            {showTreeCountOverride && (
              <p className="manual-override-note">
                Tree count set manually: {treeCountOverride}
              </p>
            )}
          </div>
        </div>
      )}
      <h3>{isFinalConfirm ? "Customer Options" : "Quote Options"}</h3>
      <div className="quote-options-grid">
        {options.length > 0 ? options.map((option, index) => (
          <article className="quote-option-card" key={option.label || index}>
            <div className="quote-option-header">
              <strong>{option.label || `Option ${index + 1}`}</strong>
              <span>{option.price?.display || "Price missing"}</span>
            </div>
            <h4>{option.title || "Option details"}</h4>
            <p>{option.description || "Add the work details for this option before informing the customer."}</p>
          </article>
        )) : (
          <article className="quote-option-card missing-option-card">
            <div className="quote-option-header">
              <strong>Option 1</strong>
              <span>Price missing</span>
            </div>
            <h4>Option needed</h4>
            <p>Add at least one option and one price before informing the customer.</p>
          </article>
        )}
      </div>
      <p className="text-muted review-option-note">{optionNote}</p>
      {!isFinalConfirm && (
        <DebugPipelinePanel
          debugPipeline={debugPipeline}
          alphaJson={alphaJson}
          validation={validation}
          renderedFields={renderedFields}
        />
      )}
      {reviewIssues.length > 0 && (
        <div className="summary-card needs-info-card">
          <h3>Needs More Info</h3>
          <ul>
            {reviewIssues.map((question) => <li key={question}>{question}</li>)}
          </ul>
        </div>
      )}
      {!isFinalConfirm && warningItems.length > 0 && (
        <div className="summary-card warning-card">
          <h3>Warnings</h3>
          <ul>
            {warningItems.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      )}
      {!canConfirm && (
        <p className="text-muted">Fix missing info before confirming quote.</p>
      )}
      <div className="toolbar td2-action-toolbar mt-2">
        <button className="btn-primary" onClick={onApprove} disabled={!canConfirm || busy}>
          {approveLabel}
        </button>
        <button className="btn-secondary" onClick={onEdit}>{editLabel}</button>
      </div>
    </section>
  );
}
