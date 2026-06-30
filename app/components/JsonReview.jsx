"use client";

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, " ")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, " ");

  const optionIndex = text.search(/\bOption\s*(?:[A-E]|[1-5])\b/i);
  if (optionIndex > -1) text = text.slice(0, optionIndex);

  const priceIndex = text.search(/\$?\s*[0-9][0-9,]*(?:\.\d{2})?\b/);
  if (priceIndex > -1) text = text.slice(0, priceIndex);

  text = text
    .replace(/\b(?:for|at|price|cost|would be|is)\s*$/i, "")
    .replace(/[,:;.\s-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return text || alphaJson.job?.description || "No job notes supplied.";
}

export default function JsonReview({ alphaJson, validation, sourceNotes = "", onApprove, onEdit, busy = false }) {
  if (!alphaJson) return null;

  const options = alphaJson.service_options?.items || [];
  const jobNotes = cleanJobNotesForReview(sourceNotes, alphaJson);

  return (
    <section className="card">
      <h2>Confirm Quote</h2>
      <p className="text-muted">Review the organized estimate before choosing how to inform the customer.</p>
      <div className="review-grid">
        <div className="summary-card">
          <h3>Customer</h3>
          <p>{alphaJson.customer?.name || "Name not available"}</p>
          <p>{alphaJson.customer?.phone_display || "Phone not available"}</p>
          <p>{alphaJson.customer?.email || "Email not available"}</p>
        </div>
        <div className="summary-card">
          <h3>Job Address</h3>
          <p>{alphaJson.job?.service_address?.display || "Address missing"}</p>
        </div>
      </div>
      <h3>Job Notes</h3>
      <div className="notes-card">{jobNotes}</div>
      <h3>Customer Options</h3>
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
      <p className="text-muted">All customer options must be listed here. The customer chooses one later.</p>
      {validation?.follow_ups?.length > 0 && (
        <>
          <h3>Follow-up Questions</h3>
          <p className="text-muted">Add the missing details before informing the customer.</p>
          <ul>
            {validation.follow_ups.map((question) => <li key={question}>{question}</li>)}
          </ul>
        </>
      )}
      <div className="toolbar mt-2">
        <button className="btn-primary" onClick={onApprove} disabled={!validation?.can_generate_pdf || busy}>
          {busy ? "Confirming..." : "Confirm Quote and Inform Customer"}
        </button>
        <button className="btn-secondary" onClick={onEdit}>Go Back to Edit Notes and Add Missing Details</button>
      </div>
    </section>
  );
}
