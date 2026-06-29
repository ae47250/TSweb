"use client";

import LegalDisclaimer from "./LegalDisclaimer.jsx";
import OptionSelector from "./OptionSelector.jsx";
import SignatureBlock from "./SignatureBlock.jsx";
import SubmissionButtons from "./SubmissionButtons.jsx";

export default function PdfGenerator({
  alphaJson,
  documentResult,
  selectedOption,
  signature,
  onSelectOption,
  onSignature,
  onSubmit,
  submitting,
}) {
  if (!alphaJson || !documentResult) return null;
  const signatureValid = signature.trim().length >= 2 && signature.trim().length <= 50;
  const ready = Boolean(selectedOption && signatureValid);

  return (
    <section className="card">
      <h2>Customer Document</h2>
      <p>
        Document ID: <strong>{documentResult.documentId}</strong>{" "}
        <span className="mock-pill">mock-safe</span>
      </p>
      <div className="toolbar">
        <a className="btn-secondary" href={documentResult.full.htmlDataUrl} download={`${documentResult.documentId}-full.html`}>
          Download Full HTML
        </a>
        <a className="btn-secondary" href={documentResult.mobile.htmlDataUrl} download={`${documentResult.documentId}-mobile.html`}>
          Download Mobile HTML
        </a>
      </div>
      <OptionSelector options={alphaJson.service_options?.items || []} selectedOption={selectedOption} onSelect={onSelectOption} />
      <LegalDisclaimer />
      <SignatureBlock value={signature} onChange={onSignature} />
      <SubmissionButtons
        disabled={!ready}
        alphaJson={alphaJson}
        selectedOption={selectedOption}
        signature={signature}
        onSubmit={onSubmit}
        busy={submitting}
      />
    </section>
  );
}
