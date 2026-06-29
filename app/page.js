"use client";

import { useState } from "react";
import ErrorAlert from "./components/ErrorAlert.jsx";
import InputForm from "./components/InputForm.jsx";
import JsonReview from "./components/JsonReview.jsx";
import PdfGenerator from "./components/PdfGenerator.jsx";

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

export default function HomePage() {
  const [customerText, setCustomerText] = useState("");
  const [alphaJson, setAlphaJson] = useState(null);
  const [validation, setValidation] = useState(null);
  const [documentResult, setDocumentResult] = useState(null);
  const [selectedOption, setSelectedOption] = useState("");
  const [signature, setSignature] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function createReview() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const openai = await postJson("/api/openai", { customer_text: customerText });
      const validated = await postJson("/api/validate", { alphaJson: openai.alphaJson });
      setAlphaJson(validated.alphaJson);
      setValidation(validated);
      setDocumentResult(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function generateDocuments() {
    setBusy(true);
    setError("");
    try {
      const result = await postJson("/api/pdf", { alphaJson });
      setDocumentResult(result);
      setAlphaJson(result.alphaJson);
      setNotice("Documents generated. Customer must select one option and sign before submitting.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitToContractor() {
    setSubmitting(true);
    setError("");
    try {
      const upload = await postJson("/api/upload", { alphaJson, selectedOption, signature });
      const notify = await postJson("/api/notify", {
        documentId: upload.documentId,
        alphaJson,
        selectedOption,
        signature,
      });
      setNotice(`Submitted in mock-safe mode. SMS target: ${notify.intendedRecipients.phone}; email target: ${notify.intendedRecipients.email}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <section className="banner">
        <h1>Alpha Tree Service Estimate Builder</h1>
        <p>Messy notes to reviewed estimate to signed customer document.</p>
      </section>
      {notice && <div className="alert alert-success">{notice}</div>}
      {error && <ErrorAlert errors={[error]} />}
      <div className="app-grid">
        <div>
          <InputForm value={customerText} onChange={setCustomerText} onSubmit={createReview} busy={busy} />
          <JsonReview alphaJson={alphaJson} validation={validation} onApprove={generateDocuments} onEdit={() => setDocumentResult(null)} />
        </div>
        <div>
          <PdfGenerator
            alphaJson={alphaJson}
            documentResult={documentResult}
            selectedOption={selectedOption}
            signature={signature}
            onSelectOption={setSelectedOption}
            onSignature={setSignature}
            onSubmit={submitToContractor}
            submitting={submitting}
          />
          {alphaJson && (
            <section className="card">
              <h2>AlphaJSON</h2>
              <pre>{JSON.stringify(alphaJson, null, 2)}</pre>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
