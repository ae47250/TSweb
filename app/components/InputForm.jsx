"use client";

import { forwardRef } from "react";

const emptyContact = {
  name: "",
  phone: "",
  email: "",
  address: "",
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

  return (
    <section className="card new-quote-card" data-testid="customer-notes-card">
      <h2>New Quote</h2>
      <p className="text-muted">
        Enter what you know. The review screen will flag missing details.
      </p>
      {editMessage && <div className="alert" data-testid="edit-notes-message">{editMessage}</div>}
      <form onSubmit={submit}>
        <div className="compact-fields">
          <label htmlFor="customerName">
            Customer name
            <input id="customerName" value={contactValue.name} onChange={(event) => updateContact("name", event.target.value)} placeholder="Maria Lopez" />
          </label>
          <label htmlFor="customerPhone">
            Customer phone
            <input id="customerPhone" value={contactValue.phone} onChange={(event) => updateContact("phone", event.target.value)} placeholder="812-555-0134" />
          </label>
          <label htmlFor="customerEmail">
            Customer email
            <input id="customerEmail" value={contactValue.email} onChange={(event) => updateContact("email", event.target.value)} placeholder="maria@example.com" />
          </label>
          <label htmlFor="serviceAddress">
            Service address
            <input id="serviceAddress" value={contactValue.address} onChange={(event) => updateContact("address", event.target.value)} placeholder="805 2nd Street, Madison, IN" />
          </label>
        </div>
        <label htmlFor="customerText">Job notes</label>
        <textarea
          ref={ref}
          id="customerText"
          className="job-notes-textarea"
          rows={10}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Write it however you would say it. Example: 2 maples behind fence, tight access, haul brush, option A cut and stack 1800, option B haul and grind stumps 2750."
        />
        <p className="text-muted">
          Include tree count, location, cleanup, hauling, stump grinding, access issues, and prices/options.
        </p>
        <div className="example-notes">
          <strong>Quick examples</strong>
          <p>2 maples behind fence, tight access, haul brush, option A cut and stack 1800, option B haul and grind stumps 2750.</p>
          <p>Oak near garage, save firewood, cleanup maybe, price 2400 or 3100 with stump grinding.</p>
        </div>
        <div className="toolbar">
          <button className="btn-primary" type="submit" disabled={busy || value.trim().length < 10}>
            {busy ? "Structuring..." : "Create Review"}
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
