"use client";

import { useState } from "react";

/**
 * Read-only badge for duplicate / conflicting phone candidates.
 */
export function PhoneDuplicateBadge({ exception }) {
  if (!exception) return null;
  const count = exception.candidateCount || exception.candidates?.length || 0;
  const label = exception.equivalent
    ? `${count} equivalent occurrences found`
    : `${count} phone candidates found`;

  return (
    <div className="decision-exception-badge" aria-label="Phone decision metadata">
      <p className="decision-exception-meta">{label}</p>
      <details className="decision-exception-evidence">
        <summary>View evidence</summary>
        <ul>
          {(exception.candidates || []).map((candidate) => (
            <li key={candidate.id || candidate.quote}>
              <span>{candidate.value || candidate.quote}</span>
              {candidate.quote && candidate.quote !== candidate.value && (
                <small>{candidate.quote}</small>
              )}
              {candidate.source && <small>Source: {candidate.source.replaceAll("_", " ")}</small>}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/**
 * Correction card for tree-count / scope conflicts.
 */
export function TreeScopeCorrectionCard({
  exception,
  busy = false,
  onAccept,
  onKeepBoth,
  onEnterScope,
  onMarkBusinessChange,
}) {
  const [enteringScope, setEnteringScope] = useState(false);
  const [scopeText, setScopeText] = useState("");
  const [businessChangeMarked, setBusinessChangeMarked] = useState(false);

  if (!exception) return null;

  function handleEnterScope(event) {
    event.preventDefault();
    const next = String(scopeText || "").replace(/\s+/g, " ").trim();
    if (!next || !onEnterScope) return;
    onEnterScope(next);
    setEnteringScope(false);
    setScopeText("");
  }

  function handleBusinessChange() {
    if (businessChangeMarked || !onMarkBusinessChange) return;
    setBusinessChangeMarked(true);
    onMarkBusinessChange(exception.field);
  }

  return (
    <section className="summary-card override-warning-card decision-exception-card" aria-label="Trees to remove">
      <h3>Trees to remove</h3>
      <p className="decision-exception-flag">Possible correction detected</p>
      {exception.earlier?.quote && (
        <div className="decision-exception-quote">
          <strong>Earlier note:</strong>
          <p>&ldquo;{exception.earlier.quote}&rdquo;</p>
        </div>
      )}
      {exception.later?.quote && exception.later.quote !== exception.earlier?.quote && (
        <div className="decision-exception-quote">
          <strong>Later note:</strong>
          <p>&ldquo;{exception.later.quote}&rdquo;</p>
        </div>
      )}
      <p className="decision-exception-suggestion">
        <strong>Suggested resolution:</strong>{" "}
        Use only {exception.suggested?.value || "the later note"}
      </p>
      <div className="decision-exception-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={() => onAccept?.(exception)}
        >
          Accept suggestion
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => onKeepBoth?.(exception)}
        >
          {exception.keepBothLabel || "Keep earlier scope"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => setEnteringScope((open) => !open)}
        >
          Enter another scope
        </button>
      </div>
      {enteringScope && (
        <form className="decision-exception-enter-scope" onSubmit={handleEnterScope}>
          <label htmlFor="treeScopeAlternate">
            Another scope
            <input
              id="treeScopeAlternate"
              type="text"
              value={scopeText}
              disabled={busy}
              onChange={(event) => setScopeText(event.target.value)}
              placeholder="e.g. Remove the rear oak only"
            />
          </label>
          <button type="submit" className="btn-primary" disabled={busy || !scopeText.trim()}>
            Apply scope
          </button>
        </form>
      )}
      <label className="decision-exception-business-change">
        <input
          type="checkbox"
          checked={businessChangeMarked}
          disabled={busy || businessChangeMarked}
          onChange={handleBusinessChange}
        />
        <span>Mark this as a business change</span>
      </label>
    </section>
  );
}

/**
 * Price alternatives card when multiple explicit amounts need confirmation.
 */
export function PriceAlternativesCard({
  exception,
  confirmed = false,
  busy = false,
  onConfirmBoth,
  onEditOptions,
}) {
  if (!exception) return null;

  if (confirmed) {
    return (
      <section className="summary-card decision-exception-card decision-exception-confirmed" aria-label="Estimate options confirmed">
        <h3>Estimate options</h3>
        <p className="decision-exception-meta">Both options confirmed</p>
      </section>
    );
  }

  const options = exception.candidates || [];

  return (
    <section className="summary-card override-warning-card decision-exception-card" aria-label="Estimate options">
      <h3>Estimate options</h3>
      <div className="decision-exception-price-list">
        {options.map((option, index) => (
          <article key={option.id || index} className="decision-exception-price-item">
            <strong>Option {index + 1} — {option.display || "Price missing"}</strong>
            {option.description ? <p>{option.description}</p> : null}
          </article>
        ))}
      </div>
      {exception.needsConfirmation && (
        <p className="override-warning-note">
          Both amounts are explicit, but the first scope pairing requires confirmation.
        </p>
      )}
      <div className="decision-exception-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={() => onConfirmBoth?.(exception)}
        >
          Confirm both options
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => onEditOptions?.(exception)}
        >
          Edit options
        </button>
      </div>
    </section>
  );
}
