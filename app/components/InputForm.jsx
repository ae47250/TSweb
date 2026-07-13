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

  const notesFilled = Boolean(value.trim());

  return (
    <section className="card new-quote-card" data-testid="customer-notes-card">
      {editMessage && <div className="alert" data-testid="edit-notes-message">{editMessage}</div>}
      <form onSubmit={submit}>
        <div className="job-notes-standalone">
          <p className="text-inbox-title">
            Paste or type everything here (in ANY order):<br />
            customer info, phone/email, address, work requested, options, prices, notes
          </p>
          <p className="job-notes-example">
            <span>Example:</span>
            <span className="job-notes-example-text">Remove 2 maples, John W. 22 Main street, Madison,  1234567890 wj234@gmail.com  option a remove only 1000, option b grind stumps and haul away 1900.</span>
          </p>
          <textarea
            ref={ref}
            id="customerText"
            className={`job-notes-textarea ${notesFilled ? "required-input required-input-filled" : "required-input"}`}
            rows={10}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Add customer info, number of trees, prices and service for each option."
          />
        </div>
        <div className="toolbar job-notes-actions">
          <button className="btn-primary btn-create-review" type="submit" disabled={busy || value.trim().length < 10}>
            {busy ? "Structuring..." : "Review Estimate"}
          </button>
          <button className="btn-secondary" type="button" onClick={onClear} disabled={busy}>
            Clear
          </button>
        </div>
        <p className="customer-info-title">Optionally fill in Customer Info below</p>
        <div className="contact-fields">
          <label htmlFor="customerName">
            Customer name
            <input id="customerName" value={contactValue.name} onChange={(event) => updateContact("name", event.target.value)} />
          </label>
          <label htmlFor="serviceAddress">
            Service address
            <input id="serviceAddress" value={contactValue.address} onChange={(event) => updateContact("address", event.target.value)} />
          </label>
          <div className="contact-choice-row">
            <label htmlFor="customerPhone">
              Customer phone
              <input id="customerPhone" value={contactValue.phone} onChange={(event) => updateContact("phone", event.target.value)} />
            </label>
            <span className="contact-or">or</span>
            <label htmlFor="customerEmail">
              Customer email
              <input id="customerEmail" value={contactValue.email} onChange={(event) => updateContact("email", event.target.value)} />
            </label>
          </div>
        </div>
      </form>
    </section>
  );
});

export default InputForm;
