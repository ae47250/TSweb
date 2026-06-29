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
  const fullLabel = documentResult.full?.format === "pdf" ? "Download Full PDF" : "Download Full HTML";
  const mobileLabel = documentResult.mobile?.format === "pdf" ? "Download Mobile PDF" : "Download Mobile HTML";
  const signedLabel = documentResult.signed?.format === "pdf" ? "Download Signed PDF" : "Download Signed HTML";

  return (
    <section className="card">
      <h2>Customer Document</h2>
      <p>
        Document ID: <strong>{documentResult.documentId}</strong>{" "}
        <span className="mock-pill">mock-safe</span>
      </p>
      {documentResult.customerEstimateUrl && (
        <p>
          Customer link:{" "}
          <a className="btn-link" href={documentResult.customerEstimateUrl}>
            View Customer Estimate
          </a>
        </p>
      )}
      <div className="toolbar">
        <a className="btn-secondary" href={documentResult.full.downloadUrl || documentResult.full.htmlDataUrl} download={documentResult.full.filename}>
          {fullLabel}
        </a>
        <a className="btn-secondary" href={documentResult.mobile.downloadUrl || documentResult.mobile.htmlDataUrl} download={documentResult.mobile.filename}>
          {mobileLabel}
        </a>
        {documentResult.signed && (
          <a className="btn-secondary" href={documentResult.signed.downloadUrl || documentResult.signed.htmlDataUrl} download={documentResult.signed.filename}>
            {signedLabel}
          </a>
        )}
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
