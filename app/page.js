"use client";

import { useEffect, useRef, useState } from "react";
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

const emptyRecentCards = [
  {
    documentId: "Slot 1",
    customerName: "No recent quote yet",
    status: "Start with New Quote",
    lastActivityTime: "",
    isPlaceholder: true,
  },
  {
    documentId: "Slot 2",
    customerName: "Recent estimates will appear here",
    status: "Waiting for activity",
    lastActivityTime: "",
    isPlaceholder: true,
  },
  {
    documentId: "Slot 3",
    customerName: "Saved approvals will appear here",
    status: "Waiting for activity",
    lastActivityTime: "",
    isPlaceholder: true,
  },
];

const emptyQuoteContact = {
  name: "",
  phone: "",
  email: "",
  address: "",
};

function contactFromAlphaJson(alphaJson) {
  return {
    name: alphaJson?.customer?.name || "",
    phone: alphaJson?.customer?.phone_display || alphaJson?.customer?.phone_primary || "",
    email: alphaJson?.customer?.email || "",
    address: alphaJson?.job?.service_address?.display || "",
  };
}

function FrontPage({ cards, onNewQuote, onNewInvoice, onOpenEstimate, onManualAcceptance, onCopyLink }) {
  const [showRecentEstimates, setShowRecentEstimates] = useState(false);

  return (
    <section className="front-page">
      <div className="front-actions">
        <button className="front-action front-action-primary" type="button" onClick={onNewQuote}>New Estimate</button>
        <button className="front-action front-action-secondary" type="button" onClick={onManualAcceptance}>Record Manual Acceptance</button>
        <button className="front-action front-action-invoice" type="button" onClick={onNewInvoice}>New Invoice</button>
        <button className="front-action front-action-recent" type="button" onClick={() => setShowRecentEstimates((current) => !current)}>Recent Estimates</button>
      </div>

      {showRecentEstimates && (
        <section id="recent-estimates" className="card">
          <h2>Recent Estimates</h2>
          <div className="recent-list">
            {cards.slice(0, 3).map((card) => (
              <article className="recent-card" key={card.documentId}>
                <div>
                  <h3>{card.customerName}</h3>
                  <p>{card.documentId}</p>
                </div>
                <span className="status-pill">{card.status}</span>
                <p className="text-muted">{card.lastActivityTime || "No recent time"}</p>
                {!card.isPlaceholder && (
                  <div className="recent-actions">
                    <button className="btn-secondary btn-fit" type="button" onClick={() => onOpenEstimate(card)}>Open</button>
                    {card.status === "Signed Estimate Received" && (
                      card.signedDownloadUrl
                        ? <a className="btn-secondary btn-fit" href={card.signedDownloadUrl}>Download Signed Estimate</a>
                        : <button className="btn-secondary btn-fit" type="button" disabled>Download Signed Estimate</button>
                    )}
                    {card.status === "Manual Acceptance Recorded" && (
                      card.savedDownloadUrl
                        ? <a className="btn-secondary btn-fit" href={card.savedDownloadUrl}>Download Saved Estimate</a>
                        : <button className="btn-secondary btn-fit" type="button" disabled>Download Saved Estimate</button>
                    )}
                    {card.status !== "Signed Estimate Received" && card.status !== "Manual Acceptance Recorded" && (
                      <>
                        <button className="btn-secondary btn-fit" type="button" onClick={() => onCopyLink(card)}>Copy Link to Estimate</button>
                        <button className="btn-secondary btn-fit" type="button" onClick={onManualAcceptance}>Record Manual Acceptance</button>
                      </>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

export default function HomePage() {
  const [stage, setStage] = useState("front");
  const [recentCards, setRecentCards] = useState([]);
  const [customerText, setCustomerText] = useState("");
  const [quoteContact, setQuoteContact] = useState(emptyQuoteContact);
  const [submittedText, setSubmittedText] = useState("");
  const [alphaJson, setAlphaJson] = useState(null);
  const [validation, setValidation] = useState(null);
  const [documentResult, setDocumentResult] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const notesRef = useRef(null);

  async function refreshRecentCards() {
    try {
      const response = await fetch("/api/estimates");
      const data = await response.json();
      if (response.ok) setRecentCards(Array.isArray(data.items) ? data.items : []);
    } catch {
      setRecentCards([]);
    }
  }

  useEffect(() => {
    refreshRecentCards();
  }, []);

  function startNewQuote() {
    if (stage === "front") {
      setCustomerText("");
      setQuoteContact(emptyQuoteContact);
      setSubmittedText("");
      setAlphaJson(null);
      setValidation(null);
      setDocumentResult(null);
    }
    setStage("new");
    setNotice("");
    setError("");
    setEditMessage("");
  }

  function clearQuoteForm() {
    setCustomerText("");
    setQuoteContact(emptyQuoteContact);
    setSubmittedText("");
    setAlphaJson(null);
    setValidation(null);
    setDocumentResult(null);
    setNotice("");
    setError("");
    setEditMessage("");
  }

  async function createReview(fullText = customerText, intake = quoteContact) {
    setBusy(true);
    setError("");
    setNotice("");
    setEditMessage("");
    setSubmittedText(customerText);
    try {
      const openai = await postJson("/api/openai", { customer_text: fullText, intake });
      const validated = await postJson("/api/validate", { alphaJson: openai.alphaJson, customer_text: fullText, intake });
      setAlphaJson(validated.alphaJson);
      setValidation(validated);
      setDocumentResult(null);
      setStage("review");
    } catch (err) {
      setError(err.message);
      setEditMessage("Edit the notes above, add the missing information, then click Create Review again.");
      setStage("new");
    } finally {
      setBusy(false);
    }
  }

  function editNotes() {
    setDocumentResult(null);
    setStage("new");
    setEditMessage("Edit the notes above, add the missing information, then click Create Review again.");
    requestAnimationFrame(() => {
      notesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      notesRef.current?.focus();
    });
  }

  async function confirmQuote() {
    if (documentResult) {
      setStage("inform");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await postJson("/api/pdf", { alphaJson });
      setDocumentResult(result);
      setAlphaJson(result.alphaJson);
      setEditMessage("");
      setNotice("Quote confirmed. Choose how to inform the customer.");
      setStage("inform");
      refreshRecentCards();
    } catch (err) {
      setError(err.message);
      setEditMessage("Edit the notes above, add the missing information, then click Create Review again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyRecentLink(card) {
    await navigator.clipboard?.writeText(card.customerEstimateUrl || `/e/${card.documentId}`);
    setNotice("Link copied.");
  }

  async function openEstimate(card) {
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/estimates/${encodeURIComponent(card.documentId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Estimate not found.");
      const record = data.record;
      setAlphaJson(record.alphaJson);
      setDocumentResult({
        documentId: record.documentId,
        alphaJson: record.alphaJson,
        customerEstimateUrl: record.customerEstimateUrl || `/e/${encodeURIComponent(record.documentId)}`,
        full: record.documents?.full || record.accepted?.full || record.signed?.full,
        mobile: record.documents?.mobile || record.signed?.mobile,
      });
      setValidation({ can_generate_pdf: true, follow_ups: [] });
      const savedNotes = record.alphaJson?.raw_input?.customer_text || "";
      setSubmittedText(savedNotes);
      setCustomerText(savedNotes);
      setQuoteContact(contactFromAlphaJson(record.alphaJson));
      setStage("inform");
    } catch (err) {
      setError(err.message);
    }
  }

  function openManualFromFront() {
    if (documentResult) {
      setStage("inform");
      setNotice("Use Record Manual Acceptance on the quote panel.");
      return;
    }
    setNotice("Create or open an estimate before recording manual acceptance.");
  }

  const cards = [...recentCards, ...emptyRecentCards].slice(0, 3);

  return (
    <main>
      <section className="banner">
        <h1>Alpha Tree Service</h1>
        <p>Quotes and customer approvals.</p>
      </section>
      {notice && <div className="alert alert-success">{notice}</div>}
      {error && <ErrorAlert errors={[error]} />}

      {stage === "front" && (
        <FrontPage
          cards={cards}
          onNewQuote={startNewQuote}
          onNewInvoice={() => setNotice("New invoice workflow is not connected yet.")}
          onOpenEstimate={openEstimate}
          onManualAcceptance={openManualFromFront}
          onCopyLink={copyRecentLink}
        />
      )}

      {stage === "new" && (
        <div className="app-grid app-grid-initial">
          <div>
            <InputForm
              ref={notesRef}
              value={customerText}
              onChange={setCustomerText}
              contactValue={quoteContact}
              onContactChange={setQuoteContact}
              onSubmit={createReview}
              onClear={clearQuoteForm}
              busy={busy}
              editMessage={editMessage}
            />
          </div>
        </div>
      )}

      {stage === "review" && (
        <div className="app-grid app-grid-initial">
          <div>
            <JsonReview
              mode="review"
              alphaJson={alphaJson}
              validation={validation}
              sourceNotes={submittedText}
              onApprove={() => setStage("confirm")}
              onEdit={editNotes}
              busy={busy}
            />
          </div>
        </div>
      )}

      {stage === "confirm" && (
        <div className="app-grid app-grid-initial">
          <div>
            <JsonReview
              mode="confirm"
              alphaJson={alphaJson}
              validation={validation}
              sourceNotes={submittedText}
              onApprove={confirmQuote}
              onEdit={() => setStage("review")}
              busy={busy}
            />
          </div>
        </div>
      )}

      {stage === "inform" && (
        <div className="app-grid app-grid-initial">
          <div>
            <PdfGenerator
              alphaJson={alphaJson}
              documentResult={documentResult}
              onReviewQuote={() => setStage("confirm")}
              onBackFront={() => {
                setStage("front");
                refreshRecentCards();
              }}
            />
          </div>
        </div>
      )}
    </main>
  );
}
