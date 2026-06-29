"use client";

import { forwardRef } from "react";

const InputForm = forwardRef(function InputForm({ value, onChange, onSubmit, busy, editMessage = "" }, ref) {
  return (
    <section className="card" data-testid="customer-notes-card">
      <h2>Customer Notes</h2>
      {editMessage && <div className="alert" data-testid="edit-notes-message">{editMessage}</div>}
      <label htmlFor="customerText">Paste or type the messy job notes</label>
      <textarea
        ref={ref}
        id="customerText"
        rows={12}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Example: John Smith 555-123-4567, 805 2nd St, remove 3 oak trees. Option 1 haul debris $2000; option 2 stump grind $2800..."
      />
      <button className="btn-primary" onClick={onSubmit} disabled={busy || value.trim().length < 10}>
        {busy ? "Structuring..." : "Create AlphaJSON Review"}
      </button>
    </section>
  );
});

export default InputForm;
