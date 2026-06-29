"use client";

import { useState } from "react";
import LegalDisclaimer from "./LegalDisclaimer.jsx";
import OptionSelector from "./OptionSelector.jsx";
import SignatureBlock from "./SignatureBlock.jsx";
import SubmissionButtons from "./SubmissionButtons.jsx";

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function PdfGenerator({
  alphaJson,
  documentResult,
  selectedOption,
  signature,
  checkboxAccepted,
  onSelectOption,
  onSignature,
  onCheckboxAccepted,
  onSubmit,
  submitting,
}) {
  const [manualOption, setManualOption] = useState("");
  const [approvalMethod, setApprovalMethod] = useState("SMS/text");
  const [customerNote, setCustomerNote] = useState("");
  const [manualSignature, setManualSignature] = useState("");
  const [manualResult, setManualResult] = useState(null);
  const [manualError, setManualError] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  if (!alphaJson || !documentResult) return null;
  const signatureValid = signature.trim().length >= 2 && signature.trim().length <= 50;
  const ready = Boolean(selectedOption && checkboxAccepted && signatureValid);
  const options = alphaJson.service_options?.items || [];
  const fullLabel = documentResult.full?.format === "pdf" ? "Download Full PDF" : "Download Full HTML";
  const mobileLabel = documentResult.mobile?.format === "pdf" ? "Download Mobile PDF" : "Download Mobile HTML";
  const signedLabel = documentResult.signed?.format === "pdf" ? "Download Signed PDF" : "Download Signed HTML";
  const acceptedFile = manualResult?.accepted;
  const customerUrl = documentResult.customerEstimateUrl || `/e/${documentResult.documentId}`;
  const smsPreview = `View your Alpha Tree Service estimate: ${customerUrl}`;
  const emailPreview = `Please review your Alpha Tree Service estimate: ${customerUrl}`;

  async function copyText(text) {
    await navigator.clipboard?.writeText(text);
  }

  async function recordManualAcceptance() {
    setManualBusy(true);
    setManualError("");
    try {
      const result = await postJson("/api/manual-acceptance", {
        estimateId: documentResult.documentId,
        alphaJson,
        acceptedOption: manualOption || selectedOption,
        approvalMethod,
        customerNote,
        signatureName: manualSignature,
      });
      setManualResult(result);
    } catch (err) {
      setManualError(err.message);
    } finally {
      setManualBusy(false);
    }
  }

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
        <button className="btn-secondary" type="button" onClick={() => copyText(customerUrl)}>
          Copy Customer Link
        </button>
        <button className="btn-secondary" type="button" onClick={() => copyText(smsPreview)}>
          Copy SMS Message
        </button>
        <a className="btn-secondary" href={`mailto:?subject=${encodeURIComponent("Alpha Tree Service Estimate")}&body=${encodeURIComponent(emailPreview)}`}>
          Preview Email to Customer
        </a>
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
      {documentResult.signedAtDisplay && (
        <p className="text-muted">Signed: {documentResult.signedAtDisplay}</p>
      )}
      <OptionSelector options={options} selectedOption={selectedOption} onSelect={onSelectOption} />
      <LegalDisclaimer />
      <label className="checkbox-line">
        <input
          type="checkbox"
          checked={checkboxAccepted}
          onChange={(event) => onCheckboxAccepted(event.target.checked)}
        />
        <span>I agree to receive and sign this estimate electronically, and I understand that typing my name below is my electronic signature.</span>
      </label>
      <SignatureBlock value={signature} onChange={onSignature} />
      <SubmissionButtons
        disabled={!ready}
        alphaJson={alphaJson}
        selectedOption={selectedOption}
        signature={signature}
        onSubmit={onSubmit}
        busy={submitting}
      />
      <section className="manual-acceptance">
        <h3>Record Manual Acceptance</h3>
        {manualError && <div className="alert alert-error">{manualError}</div>}
        {manualResult ? (
          <div className="accepted-summary">
            <p>Accepted: <strong>{manualResult.manualAcceptance.selectedOptionLabel}</strong>{manualResult.manualAcceptance.selectedOptionPrice ? `, ${manualResult.manualAcceptance.selectedOptionPrice}` : ""}</p>
            <p>Method: <strong>{manualResult.manualAcceptance.approvalMethod}</strong></p>
            <p>Accepted: <strong>{manualResult.manualAcceptance.acceptedAtDisplay}</strong></p>
            <p>Note: {manualResult.manualAcceptance.customerNote}</p>
            {manualResult.manualAcceptance.signatureName && <p>Name/signature: <strong>{manualResult.manualAcceptance.signatureName}</strong></p>}
            {acceptedFile && (
              <a className="btn-secondary btn-fit" href={acceptedFile.downloadUrl || acceptedFile.htmlDataUrl} download={acceptedFile.filename}>
                {acceptedFile.format === "pdf" ? "Download Accepted PDF" : "Download Accepted HTML"}
              </a>
            )}
          </div>
        ) : (
          <>
            <label htmlFor="manualOption">Accepted option</label>
            <select id="manualOption" value={manualOption || selectedOption} onChange={(event) => setManualOption(event.target.value)}>
              <option value="">Choose option</option>
              {options.map((option) => (
                <option key={option.label} value={option.label}>{option.label}: {option.price?.display}</option>
              ))}
            </select>
            <label htmlFor="approvalMethod">Approval method</label>
            <select id="approvalMethod" value={approvalMethod} onChange={(event) => setApprovalMethod(event.target.value)}>
              <option>SMS/text</option>
              <option>phone call/voice</option>
              <option>email</option>
              <option>in person</option>
              <option>other</option>
            </select>
            <label htmlFor="customerNote">Customer note/reply</label>
            <textarea id="customerNote" rows={3} value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} placeholder="Customer texted: Go ahead with Option B." />
            <label htmlFor="manualSignature">Typed name/signature if available</label>
            <input id="manualSignature" type="text" value={manualSignature} onChange={(event) => setManualSignature(event.target.value)} placeholder={alphaJson.customer?.name || "Customer name"} />
            <button className="btn-secondary" type="button" disabled={manualBusy || !(manualOption || selectedOption) || !customerNote.trim()} onClick={recordManualAcceptance}>
              {manualBusy ? "Recording..." : "Record Manual Acceptance"}
            </button>
          </>
        )}
      </section>
    </section>
  );
}
