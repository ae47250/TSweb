"use client";

import { useState } from "react";
import LegalDisclaimer from "../../components/LegalDisclaimer.jsx";
import OptionSelector from "../../components/OptionSelector.jsx";
import SignatureBlock from "../../components/SignatureBlock.jsx";

async function postJson(url, body, accessToken = "") {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function EstimateClient({ record }) {
  const [selectedOption, setSelectedOption] = useState(record.selectedOption || "");
  const [signature, setSignature] = useState(record.signatureName || "");
  const [checkboxAccepted, setCheckboxAccepted] = useState(record.checkboxAccepted || false);
  const [submitted, setSubmitted] = useState(record.status === "signed" || record.status === "accepted_manually");
  const [signedFile, setSignedFile] = useState(record.signedFile || null);
  const [signedAtDisplay, setSignedAtDisplay] = useState(record.signedAtDisplay || "");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const customerView = record.customerView;
  const signatureValid = signature.trim().length >= 2 && signature.trim().length <= 50;
  const ready = Boolean(selectedOption && checkboxAccepted && signatureValid);
  const selected = (customerView.options || []).find((option) => option.label === selectedOption);

  async function submitSignature() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const upload = await postJson("/api/upload", {
        documentId: record.documentId,
        selectedOption,
        signature,
        checkboxAccepted,
      }, record.accessToken);
      setSignedFile(upload.signed);
      setSignedAtDisplay(upload.signedAtDisplay);
      setSubmitted(true);
      setNotice("Your signed estimate has been received.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="estimate-page">
      <section className="banner">
        <h1>Alpha Tree Service Estimate</h1>
        <p>{customerView.document?.number}</p>
      </section>
      {notice && <div className="alert alert-success">{notice}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      <section className="card">
        <h2>Customer</h2>
        <div className="review-grid">
          <div>
            <h3>{customerView.customer?.name || "Customer"}</h3>
            <p>{customerView.customer?.phone}</p>
          </div>
          <div>
            <h3>Service Address</h3>
            <p>{customerView.serviceAddress}</p>
          </div>
        </div>
        <h3>Work Description</h3>
        <p>{customerView.workDescription}</p>
      </section>

      <section className="card">
        {submitted ? (
          <>
            <h2>{record.status === "accepted_manually" ? "Your accepted estimate has been received." : "Your signed estimate has been received."}</h2>
            <p>Selected option: <strong>{selectedOption}</strong>{selected?.priceDisplay ? `, ${selected.priceDisplay}` : ""}</p>
            {signature && <p>Signature: <strong>{signature}</strong></p>}
            {signedAtDisplay && <p>{record.status === "accepted_manually" ? "Accepted" : "Signed"}: <strong>{signedAtDisplay}</strong></p>}
            {signedFile && (
              <a className="btn-primary btn-fit" href={signedFile.downloadUrl || signedFile.htmlDataUrl} download={signedFile.filename}>
                {record.status === "accepted_manually"
                  ? (signedFile.format === "pdf" ? "Download Saved Estimate" : "Download Saved HTML")
                  : (signedFile.format === "pdf" ? "Download Signed Estimate" : "Download Signed HTML")}
              </a>
            )}
          </>
        ) : (
          <>
            <h2>Choose and Sign</h2>
            <OptionSelector options={customerView.options || []} selectedOption={selectedOption} onSelect={setSelectedOption} />
            <LegalDisclaimer />
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={checkboxAccepted}
                onChange={(event) => setCheckboxAccepted(event.target.checked)}
              />
              <span>I agree to receive and sign this estimate electronically, and I understand that typing my name below is my electronic signature.</span>
            </label>
            <SignatureBlock value={signature} onChange={setSignature} />
            <button className="btn-primary" type="button" disabled={!ready || busy} onClick={submitSignature}>
              {busy ? "Submitting..." : "Submit Signed Estimate"}
            </button>
            {!ready && <p className="text-muted">Please select one option, accept electronic signature consent, and type your signature before submitting.</p>}
          </>
        )}
      </section>
    </main>
  );
}
