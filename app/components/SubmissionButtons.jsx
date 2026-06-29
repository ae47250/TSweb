"use client";

import { TREE_DUDE_EMAIL } from "../../config/constants.js";

export default function SubmissionButtons({ disabled, alphaJson, selectedOption, signature, onSubmit, busy }) {
  const subject = encodeURIComponent(`Signed Estimate ${alphaJson?.document?.number || ""}`);
  const body = encodeURIComponent(`Selected option: ${selectedOption}\nSignature: ${signature}`);

  return (
    <div className="button-row">
      <a
        className="btn-secondary"
        aria-disabled={disabled}
        href={disabled ? undefined : `mailto:${TREE_DUDE_EMAIL}?subject=${subject}&body=${body}`}
        onClick={(event) => {
          if (disabled) event.preventDefault();
        }}
      >
        Preview Email to Tree Dude
      </a>
      <button className="btn-primary" type="button" disabled={disabled || busy} onClick={onSubmit}>
        {busy ? "Submitting..." : "Submit to Contractor"}
      </button>
      <p className="text-muted full-row">Mock mode: no real SMS or email was sent.</p>
      {disabled && <p className="text-muted">Please select an option and sign.</p>}
    </div>
  );
}
