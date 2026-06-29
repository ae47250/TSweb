"use client";

export default function JsonReview({ alphaJson, validation, onApprove, onEdit }) {
  if (!alphaJson) return null;

  const options = alphaJson.service_options?.items || [];

  return (
    <section className="card">
      <h2>Review</h2>
      <div className="review-grid">
        <div>
          <h3>Customer</h3>
          <p>{alphaJson.customer?.name || "Name not supplied"}</p>
          <p>{alphaJson.customer?.phone_display || "Phone missing"}</p>
        </div>
        <div>
          <h3>Job</h3>
          <p>{alphaJson.job?.service_address?.display || "Address missing"}</p>
          <p>{alphaJson.job?.description}</p>
        </div>
      </div>
      <h3>Options</h3>
      {options.map((option) => (
        <div className="option-row" key={option.label}>
          <strong>{option.label}</strong>
          <span>{option.title}</span>
          <span>{option.price?.display}</span>
        </div>
      ))}
      {validation?.follow_ups?.length > 0 && (
        <>
          <h3>Follow-up Questions</h3>
          <ul>
            {validation.follow_ups.map((question) => <li key={question}>{question}</li>)}
          </ul>
        </>
      )}
      <div className="toolbar mt-2">
        <button className="btn-primary" onClick={onApprove} disabled={!validation?.can_generate_pdf}>
          Approve and Generate Documents
        </button>
        <button className="btn-secondary" onClick={onEdit}>Edit Notes</button>
      </div>
    </section>
  );
}
