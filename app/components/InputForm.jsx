"use client";

import { forwardRef } from "react";

const emptyContact = {
  name: "",
  phone: "",
  email: "",
  address: "",
  treeCountOverride: "Auto",
};

const InputForm = forwardRef(function InputForm({ value, onChange, onSubmit, onClear, busy, editMessage = "", contactValue = emptyContact, onContactChange }, ref) {
  function updateContact(field, nextValue) {
    onContactChange?.({ ...contactValue, [field]: nextValue });
  }

  function submit(event) {
    event.preventDefault();
    const contactText = [
      contactValue.name ? `Customer name: ${contactValue.name}` : "",
      contactValue.phone ? `Customer phone: ${contactValue.phone}` : "",
      contactValue.email ? `Customer email: ${contactValue.email}` : "",
      contactValue.address ? `Service address: ${contactValue.address}` : "",
    ].filter(Boolean).join("\n");
    onSubmit([contactText, value].filter(Boolean).join("\n\n"), contactValue);
  }

  const addressFilled = Boolean(contactValue.address.trim());
  const contactFilled = Boolean(contactValue.phone.trim() || contactValue.email.trim());
  const notesFilled = Boolean(value.trim());
  const requiredClass = (filled) => filled ? "required-input required-input-filled" : "required-input";

  return (
    <section className="card new-quote-card" data-testid="customer-notes-card">
      <h2>New Estimate</h2>
      <p className="new-estimate-guidance">
        Fill in the red fields and add Job Notes.
      </p>
      {editMessage && <div className="alert" data-testid="edit-notes-message">{editMessage}</div>}
      <form onSubmit={submit}>
        <div className="contact-fields">
          <label htmlFor="customerName">
            Customer name
            <input id="customerName" value={contactValue.name} onChange={(event) => updateContact("name", event.target.value)} />
          </label>
          <label htmlFor="serviceAddress">
            Service address
            <input className={requiredClass(addressFilled)} id="serviceAddress" value={contactValue.address} onChange={(event) => updateContact("address", event.target.value)} />
          </label>
          <div className="contact-choice-row">
            <label htmlFor="customerPhone">
              Customer phone
              <input className={requiredClass(contactFilled)} id="customerPhone" value={contactValue.phone} onChange={(event) => updateContact("phone", event.target.value)} />
            </label>
            <span className="contact-or">or</span>
            <label htmlFor="customerEmail">
              Customer email
              <input className={requiredClass(contactFilled)} id="customerEmail" value={contactValue.email} onChange={(event) => updateContact("email", event.target.value)} />
            </label>
          </div>
        </div>
        <div className="job-notes-card">
          <label htmlFor="customerText" className="job-notes-title">Job Notes</label>
          <p className="job-notes-guidance">
            <span>Include</span> as much information as possible about the job, scope of work, and prices.
          </p>
          <p className="job-notes-example">
            <span>Example:</span>
            <span className="job-notes-example-text">2 maples behind fence, tight access, haul brush, option A cut and stack 1800, option B haul and grind stumps 2750.</span>
          </p>
          <textarea
            ref={ref}
            id="customerText"
            className={`job-notes-textarea ${requiredClass(notesFilled)}`}
            rows={10}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Add the number of trees, prices, and customer options here."
          />
        </div>
        <div className="toolbar">
          <button className="btn-primary btn-create-review" type="submit" disabled={busy || value.trim().length < 10}>
            {busy ? "Structuring..." : "Review Estimate"}
          </button>
          <button className="btn-secondary" type="button" onClick={onClear} disabled={busy}>
            Clear
          </button>
        </div>
      </form>
    </section>
  );
});

export default InputForm;
