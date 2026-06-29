"use client";

export default function InputForm({ value, onChange, onSubmit, busy }) {
  return (
    <section className="card">
      <h2>Customer Notes</h2>
      <label htmlFor="customerText">Paste or type the messy job notes</label>
      <textarea
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
}
