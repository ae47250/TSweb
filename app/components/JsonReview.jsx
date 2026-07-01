"use client";

import { buildCustomerJobSummary, normalizeTreeServiceText } from "../../lib/normalizeAlphaJson.js";

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

export default function JsonReview({ alphaJson, validation, sourceNotes = "", mode = "review", onApprove, onEdit, busy = false }) {
  if (!alphaJson) return null;

  const options = alphaJson.service_options?.items || [];
  const structuredJobSummary = buildCustomerJobSummary(alphaJson);
  const jobNotes = structuredJobSummary || cleanJobNotesForReview(sourceNotes, alphaJson);
  const customerName = alphaJson.customer?.name || "Name not available";
  const customerPhone = alphaJson.customer?.phone_display || "Phone not available";
  const customerEmail = alphaJson.customer?.email || "Email not available";
  const jobAddress = alphaJson.job?.service_address?.display || "Address missing";
  const canConfirm = Boolean(validation?.can_generate_pdf);
  const isFinalConfirm = mode === "confirm";
  const reviewIssues = validation?.follow_ups?.length
    ? validation.follow_ups
    : validation?.blocking_errors || [];
  const title = isFinalConfirm ? "Confirm Quote" : "AI Review";
  const subtitle = isFinalConfirm ? "This creates the customer estimate link." : "Check details before confirming quote.";
  const optionNote = isFinalConfirm
    ? `Do not choose an option here. ${customerName === "Name not available" ? "The customer" : customerName} will choose one when opening the estimate.`
    : "Tree Dude reviews these options. The customer chooses one later.";
  const approveLabel = isFinalConfirm ? (busy ? "Confirming..." : "Confirm Quote") : "Confirm Quote";
  const editLabel = isFinalConfirm ? "Back" : "Edit Info";

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
            <p className="job-notes-guidance">
              <span>Include</span> as much information as possible about the job, scope of work, and prices.
            </p>
            <p className="job-notes-example">
              <span>Example:</span>
              <span className="job-notes-example-text">2 maples behind fence, tight access, haul brush, option A cut and stack 1800, option B haul and grind stumps 2750.</span>
            </p>
            <p className="job-summary-text">{jobNotes}</p>
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
      {reviewIssues.length > 0 && (
        <div className="summary-card needs-info-card">
          <h3>Needs More Info</h3>
          <ul>
            {reviewIssues.map((question) => <li key={question}>{question}</li>)}
          </ul>
        </div>
      )}
      {!canConfirm && (
        <p className="text-muted">Fix missing info before confirming quote.</p>
      )}
      <div className="toolbar mt-2">
        <button className="btn-primary" onClick={onApprove} disabled={!canConfirm || busy}>
          {approveLabel}
        </button>
        <button className="btn-secondary" onClick={onEdit}>{editLabel}</button>
      </div>
    </section>
  );
}
