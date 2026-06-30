"use client";

import { useState } from "react";

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

function firstName(name = "customer") {
  return String(name).trim().split(/\s+/)[0] || "there";
}

export default function PdfGenerator({
  alphaJson,
  documentResult,
  onReviewQuote,
  onBackFront,
}) {
  const [activePreview, setActivePreview] = useState("");
  const [sendStatus, setSendStatus] = useState("");
  const [sendError, setSendError] = useState("");
  const [sendingChannel, setSendingChannel] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [manualOption, setManualOption] = useState("");
  const [approvalMethod, setApprovalMethod] = useState("Text reply");
  const [customerNote, setCustomerNote] = useState("");
  const [manualSignature, setManualSignature] = useState("");
  const [manualResult, setManualResult] = useState(null);
  const [manualError, setManualError] = useState("");
  const [manualBusy, setManualBusy] = useState(false);

  if (!alphaJson || !documentResult) return null;

  const options = alphaJson.service_options?.items || [];
  const customerName = alphaJson.customer?.name || "Customer";
  const customerPhone = alphaJson.customer?.phone_display || alphaJson.customer?.phone_primary || "";
  const customerEmail = alphaJson.customer?.email || "";
  const customerUrl = documentResult.customerEstimateUrl || `/e/${documentResult.documentId}`;
  const estimateFile = documentResult.full || documentResult.mobile;
  const estimateDownloadLabel = estimateFile?.format === "pdf" ? "Download Estimate" : "Download Estimate HTML";
  const smsMessage = `Hi ${firstName(customerName)}, your Alpha Tree Service estimate is ready. Review options and sign here: ${customerUrl}`;
  const emailSubject = `Alpha Tree Service Estimate - ${customerName}`;
  const emailBody = `Hi ${firstName(customerName)},\n\nYour Alpha Tree Service estimate is ready. Please review the options and sign electronically.\n\nView Your Alpha Tree Service Estimate:\n${customerUrl}`;

  async function copyText(text) {
    await navigator.clipboard?.writeText(text);
    setSendStatus("Link copied.");
  }

  function showPreview(type) {
    setActivePreview(type);
    setSendStatus("");
    setSendError("");
  }

  async function sendCustomerMessage(type) {
    setSendingChannel(type);
    setSendStatus("");
    setSendError("");
    setActivePreview("");
    try {
      const result = await postJson("/api/notify", {
        recipient: "customer",
        channel: type,
        documentId: documentResult.documentId,
        alphaJson,
        customerEstimateUrl: customerUrl,
      });
      const label = type === "sms" ? "SMS" : "Email";
      setSendStatus(result.mocked
        ? `${label} send recorded for ${customerName} in mock mode.`
        : `${label} sent to ${customerName}.`);
    } catch (err) {
      setSendError(err.message);
    } finally {
      setSendingChannel("");
    }
  }

  async function recordManualAcceptance() {
    setManualBusy(true);
    setManualError("");
    try {
      const result = await postJson("/api/manual-acceptance", {
        estimateId: documentResult.documentId,
        alphaJson,
        acceptedOption: manualOption,
        approvalMethod,
        customerNote,
        signatureName: manualSignature,
      });
      setManualResult(result);
      setShowManual(false);
      setSendStatus("");
      setSendError("");
    } catch (err) {
      setManualError(err.message);
    } finally {
      setManualBusy(false);
    }
  }

  if (manualResult) {
    const savedFile = manualResult.accepted;
    const savedLabel = savedFile?.format === "pdf" ? "Download Saved Estimate" : "Download Saved HTML";
    const completedLink = customerUrl;
    return (
      <section className="card">
        <h2>Acceptance has been saved</h2>
        <div className="result-card">
          <h3>{manualResult.manualAcceptance.customerName || customerName}</h3>
          <p>{manualResult.documentId}</p>
          <p>
            Saved option: <strong>{manualResult.manualAcceptance.selectedOptionLabel}</strong>
            {manualResult.manualAcceptance.selectedOptionPrice ? ` - ${manualResult.manualAcceptance.selectedOptionPrice}` : ""}
          </p>
          <p>Method: <strong>{manualResult.manualAcceptance.approvalMethod}</strong></p>
          <p>Accepted: <strong>{manualResult.manualAcceptance.acceptedAtDisplay}</strong></p>
          <p>Note: {manualResult.manualAcceptance.customerNote}</p>
          {manualResult.manualAcceptance.signatureName && <p>Name/signature: <strong>{manualResult.manualAcceptance.signatureName}</strong></p>}
        </div>

        <div className="action-card">
          <h3>Inform Customer</h3>
          <div className="button-row">
            <button className="btn-light-orange" type="button" disabled={!customerPhone || Boolean(sendingChannel)} onClick={() => sendCustomerMessage("sms")}>
              {sendingChannel === "sms" ? "Sending..." : "Send SMS"}
            </button>
            <button className="btn-light-orange" type="button" disabled={!customerEmail || Boolean(sendingChannel)} onClick={() => sendCustomerMessage("email")}>
              {sendingChannel === "email" ? "Sending..." : "Send Email"}
            </button>
          </div>
          {(!customerPhone || !customerEmail) && <p className="text-muted">Missing phone or email disables that send option.</p>}
          {sendStatus && <div className="alert alert-success">{sendStatus}</div>}
          {sendError && <div className="alert alert-error">{sendError}</div>}
        </div>

        <div className="utility-card">
          {savedFile && (
            <a className="btn-light-blue" href={savedFile.downloadUrl || savedFile.htmlDataUrl} download={savedFile.filename}>
              {savedLabel}
            </a>
          )}
          <button className="btn-light-blue" type="button" onClick={() => copyText(completedLink)}>
            Copy Link to Completed Estimate
          </button>
        </div>

        <div className="back-home-area">
          <button className="btn-blue" type="button" onClick={onBackFront}>Back to Front Page</button>
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Inform Customer</h2>
      <p className="text-muted">
        Estimate <strong>{documentResult.documentId}</strong> is confirmed. Choose how to inform the customer.
      </p>
      <div className="toolbar action-toolbar">
        <button className="btn-neutral" type="button" onClick={onReviewQuote}>Review Quote</button>
        <button className="btn-light-orange" type="button" disabled={!customerPhone} onClick={() => showPreview("sms")}>Send SMS</button>
        <button className="btn-light-orange" type="button" disabled={!customerEmail} onClick={() => showPreview("email")}>Send Email</button>
        {estimateFile && (
          <a className="btn-light-blue" href={estimateFile.downloadUrl || estimateFile.htmlDataUrl} download={estimateFile.filename}>
            {estimateDownloadLabel}
          </a>
        )}
        <button className="btn-light-blue" type="button" onClick={() => copyText(customerUrl)}>Copy Link to Estimate</button>
        <button className="btn-yellow" type="button" onClick={() => setShowManual((current) => !current)}>Record Manual Acceptance</button>
      </div>
      {(!customerPhone || !customerEmail) && (
        <p className="text-muted">
          {!customerPhone ? "SMS unavailable - missing phone. " : ""}
          {!customerEmail ? "Email unavailable - missing email." : ""}
        </p>
      )}
      {sendStatus && <div className="alert alert-success">{sendStatus}</div>}
      {sendError && <div className="alert alert-error">{sendError}</div>}

      {activePreview === "sms" && (
        <div className="preview-card">
          <h3>SMS Preview</h3>
          <p className="message-preview">{smsMessage}</p>
          <button className="btn-orange" type="button" disabled={Boolean(sendingChannel)} onClick={() => sendCustomerMessage("sms")}>
            {sendingChannel === "sms" ? "Sending..." : "Send Now"}
          </button>
          <p className="text-muted">Mock mode records the send without contacting Pingram. Live mode sends through Pingram.</p>
        </div>
      )}

      {activePreview === "email" && (
        <div className="preview-card">
          <h3>Email Preview</h3>
          <p><strong>Subject:</strong> {emailSubject}</p>
          <pre className="message-preview">{emailBody}</pre>
          <button className="btn-orange" type="button" disabled={Boolean(sendingChannel)} onClick={() => sendCustomerMessage("email")}>
            {sendingChannel === "email" ? "Sending..." : "Send Now"}
          </button>
          <p className="text-muted">Mock mode records the send without contacting Pingram. Live mode sends through Pingram.</p>
        </div>
      )}

      {showManual && (
        <section className="manual-acceptance">
          <h3>Record Manual Acceptance</h3>
          <p className="text-muted">Use this when the customer approved outside the app by phone call, text reply, email reply, in person, or similar.</p>
          {manualError && <div className="alert alert-error">{manualError}</div>}
          <label htmlFor="manualOption">Accepted option</label>
          <select id="manualOption" value={manualOption} onChange={(event) => setManualOption(event.target.value)}>
            <option value="">Choose option</option>
            {options.map((option) => (
              <option key={option.label} value={option.label}>{option.label}: {option.price?.display}</option>
            ))}
          </select>
          <label htmlFor="approvalMethod">Approval method</label>
          <select id="approvalMethod" value={approvalMethod} onChange={(event) => setApprovalMethod(event.target.value)}>
            <option>Phone call</option>
            <option>Text reply</option>
            <option>Email reply</option>
            <option>In person</option>
            <option>Other</option>
          </select>
          <label htmlFor="customerNote">Customer note/reply</label>
          <textarea id="customerNote" rows={3} value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} placeholder="Customer texted: Go ahead with Option B." />
          <label htmlFor="manualSignature">Typed name/signature if available</label>
          <input id="manualSignature" type="text" value={manualSignature} onChange={(event) => setManualSignature(event.target.value)} placeholder={customerName} />
          <button className="btn-primary" type="button" disabled={manualBusy || !manualOption || !customerNote.trim()} onClick={recordManualAcceptance}>
            {manualBusy ? "Saving..." : "Save Manual Acceptance"}
          </button>
        </section>
      )}
      <div className="back-home-area">
        <button className="btn-blue" type="button" onClick={onBackFront}>Back to Front Page</button>
      </div>
    </section>
  );
}
