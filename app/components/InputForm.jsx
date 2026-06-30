"use client";

import { useState } from "react";
import { forwardRef } from "react";

const InputForm = forwardRef(function InputForm({ value, onChange, onSubmit, busy, editMessage = "" }, ref) {
  const [contact, setContact] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });

  function updateContact(field, nextValue) {
    setContact((current) => ({ ...current, [field]: nextValue }));
  }

  function submit(event) {
    event.preventDefault();
    const contactText = [
      contact.name ? `Customer name: ${contact.name}` : "",
      contact.phone ? `Customer phone: ${contact.phone}` : "",
      contact.email ? `Customer email: ${contact.email}` : "",
      contact.address ? `Service address: ${contact.address}` : "",
    ].filter(Boolean).join("\n");
    onSubmit([contactText, value].filter(Boolean).join("\n\n"));
  }

  return (
    <section className="card new-quote-card" data-testid="customer-notes-card">
      <h2>New Quote</h2>
      <p className="text-muted">
        Type what you know, even if it is messy, out of order, or full of typos. Alpha Tree will clean it up into a professional estimate.
      </p>
      {editMessage && <div className="alert" data-testid="edit-notes-message">{editMessage}</div>}
      <form onSubmit={submit}>
        <div className="compact-fields">
          <label htmlFor="customerName">
            Customer
            <input id="customerName" value={contact.name} onChange={(event) => updateContact("name", event.target.value)} placeholder="Maria Lopez" />
          </label>
          <label htmlFor="customerPhone">
            Phone
            <input id="customerPhone" value={contact.phone} onChange={(event) => updateContact("phone", event.target.value)} placeholder="812-555-0134" />
          </label>
          <label htmlFor="customerEmail">
            Email
            <input id="customerEmail" value={contact.email} onChange={(event) => updateContact("email", event.target.value)} placeholder="maria@example.com" />
          </label>
          <label htmlFor="serviceAddress">
            Service address
            <input id="serviceAddress" value={contact.address} onChange={(event) => updateContact("address", event.target.value)} placeholder="805 2nd Street, Madison, IN" />
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
          Put details in any order: trees, location, hazards, cleanup, hauling, stump grinding, access, customer requests, options, and prices.
          Include at least one option and one price if you know them. If they are missing, you&apos;ll be asked to add them on the next screen before sending.
        </p>
        <div className="example-notes">
          <strong>Quick examples</strong>
          <p>2 maples behind fence, tight access, haul brush, option A cut and stack 1800, option B haul and grind stumps 2750.</p>
          <p>Oak near garage, save firewood, cleanup maybe, price 2400 or 3100 with stump grinding.</p>
        </div>
        <button className="btn-primary" type="submit" disabled={busy || value.trim().length < 10}>
          {busy ? "Structuring..." : "Create Estimate for Review"}
        </button>
      </form>
    </section>
  );
});

export default InputForm;
