"use client";

import { useState } from "react";
import LegalDisclaimer from "../../components/LegalDisclaimer.jsx";
import OptionSelector from "../../components/OptionSelector.jsx";
import SignatureBlock from "../../components/SignatureBlock.jsx";

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

export default function EstimateClient({ record }) {
  const [selectedOption, setSelectedOption] = useState(record.selected_option || "");
  const [signature, setSignature] = useState(record.signature_name || "");
  const [submitted, setSubmitted] = useState(record.status === "signed");
  const [signedFile, setSignedFile] = useState(record.signed?.full || null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const alphaJson = record.alphaJson;
  const signatureValid = signature.trim().length >= 2 && signature.trim().length <= 50;
  const ready = Boolean(selectedOption && signatureValid);
  const selected = (alphaJson.service_options?.items || []).find((option) => option.label === selectedOption);

  async function submitSignature() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const upload = await postJson("/api/upload", { alphaJson, selectedOption, signature });
      const notify = await postJson("/api/notify", {
        documentId: upload.documentId,
        alphaJson,
        selectedOption,
        signature,
      });
      setSignedFile(upload.signed);
      setSubmitted(true);
      setNotice(`Submitted in mock-safe mode. No real SMS or email was sent. SMS target: ${notify.intendedRecipients.phone}; email target: ${notify.intendedRecipients.email}.`);
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
        <p>{alphaJson.document?.number}</p>
      </section>
      {notice && <div className="alert alert-success">{notice}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      <section className="card">
        <h2>Customer</h2>
        <div className="review-grid">
          <div>
            <h3>{alphaJson.customer?.name || "Customer"}</h3>
            <p>{alphaJson.customer?.phone_display}</p>
          </div>
          <div>
            <h3>Service Address</h3>
            <p>{alphaJson.job?.service_address?.display}</p>
          </div>
        </div>
        <h3>Work Description</h3>
        <p>{alphaJson.job?.description}</p>
      </section>

      <section className="card">
        {submitted ? (
          <>
            <h2>Signed Estimate Confirmed</h2>
            <p>Selected option: <strong>{selectedOption}</strong>{selected?.price?.display ? `, ${selected.price.display}` : ""}</p>
            <p>Signature: <strong>{signature}</strong></p>
            {signedFile && (
              <a className="btn-primary btn-fit" href={signedFile.downloadUrl || signedFile.htmlDataUrl} download={signedFile.filename}>
                {signedFile.format === "pdf" ? "Download Signed PDF" : "Download Signed HTML"}
              </a>
            )}
          </>
        ) : (
          <>
            <h2>Choose and Sign</h2>
            <OptionSelector options={alphaJson.service_options?.items || []} selectedOption={selectedOption} onSelect={setSelectedOption} />
            <LegalDisclaimer />
            <SignatureBlock value={signature} onChange={setSignature} />
            <button className="btn-primary" type="button" disabled={!ready || busy} onClick={submitSignature}>
              {busy ? "Submitting..." : "Submit Signed Estimate"}
            </button>
            {!ready && <p className="text-muted">Please select one option and type your signature before submitting.</p>}
            <p className="text-muted">Mock mode: no real SMS or email was sent.</p>
          </>
        )}
      </section>
    </main>
  );
}
