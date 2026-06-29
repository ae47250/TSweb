"use client";

export default function SignatureBlock({ value, onChange, minLength = 2, maxLength = 50 }) {
  const valid = value.trim().length >= minLength && value.trim().length <= maxLength;

  return (
    <section className="signature-block">
      <label htmlFor="signature">Customer signature, type your name</label>
      <input
        id="signature"
        type="text"
        maxLength={maxLength + 5}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="John Smith"
      />
      <div className="signature-display">{value}</div>
      <p className="text-muted">
        Signature must be {minLength}-{maxLength} characters. Current status: {valid ? "valid" : "not valid"}.
      </p>
    </section>
  );
}
