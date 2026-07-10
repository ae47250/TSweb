"use client";

import { useEffect, useRef, useState } from "react";
import ErrorAlert from "./components/ErrorAlert.jsx";
import InputForm from "./components/InputForm.jsx";
import JsonReview from "./components/JsonReview.jsx";
import PdfGenerator from "./components/PdfGenerator.jsx";
import { normalizeEditedServiceAddress, normalizeTreeServiceText } from "../lib/normalizeAlphaJson.js";

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

const REQUIRED_PHONE_DIGITS = 10;
const PHONE_DIGIT_WARNING = `Phone number must be ${REQUIRED_PHONE_DIGITS} digits including area code.`;

function phoneDigitCount(value) {
  return String(value || "").replace(/\D/g, "").length;
}

const emptyRecentCards = [
  {
    documentId: "Slot 1",
    customerName: "No recent estimate yet",
    status: "Start with New Estimate",
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
  treeCountOverride: "Auto",
};

const emptyReviewOverrides = {
  missingAddress: false,
  missingPhone: false,
  missingEmail: false,
  missingContact: false,
  unclearScopeWithPrice: false,
};

function contactFromAlphaJson(alphaJson) {
  return {
    name: alphaJson?.customer?.name || "",
    phone: alphaJson?.customer?.phone_display || alphaJson?.customer?.phone_primary || "",
    email: alphaJson?.customer?.email || "",
    address: alphaJson?.job?.service_address?.display || "",
    treeCountOverride: "Auto",
  };
}

function normalizeEditedPrice(value) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  if (!digits) return { display: "", amount: null };
  const amount = Number(digits);
  return {
    display: `$${amount.toLocaleString("en-US")}`,
    amount,
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
  const [debugPipeline, setDebugPipeline] = useState(null);
  const [reviewOverrides, setReviewOverrides] = useState(emptyReviewOverrides);
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
      setDebugPipeline(null);
      setReviewOverrides(emptyReviewOverrides);
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
    setDebugPipeline(null);
    setReviewOverrides(emptyReviewOverrides);
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
      setDebugPipeline(openai.debugPipeline || null);
      setReviewOverrides(emptyReviewOverrides);
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
    setReviewOverrides(emptyReviewOverrides);
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
      const result = await postJson("/api/pdf", { alphaJson, reviewOverrides });
      setDocumentResult(result);
      setAlphaJson(result.alphaJson);
      setEditMessage("");
      setNotice("Estimate confirmed. Choose how to inform the customer.");
      setStage("inform");
      refreshRecentCards();
    } catch (err) {
      setError(err.message);
      setEditMessage("Edit the notes above, add the missing information, then click Create Review again.");
    } finally {
      setBusy(false);
    }
  }

  async function applyTreeCountOverride(treeCountOverride) {
    setBusy(true);
    setError("");
    try {
      const nextContact = { ...quoteContact, treeCountOverride };
      const validated = await postJson("/api/validate", {
        alphaJson,
        customer_text: submittedText,
        intake: nextContact,
      });
      setQuoteContact(nextContact);
      setAlphaJson(validated.alphaJson);
      setValidation(validated);
      setNotice("Tree count selection applied.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function validateEditedAlphaJson(nextAlphaJson, nextContact = quoteContact, successMessage = "Review updated.") {
    const validated = await postJson("/api/validate", {
      alphaJson: nextAlphaJson,
      customer_text: submittedText,
      intake: nextContact,
    });
    setAlphaJson(validated.alphaJson);
    setValidation(validated);
    setNotice(successMessage);
    setDocumentResult(null);
    return validated;
  }

  async function applyCustomerFieldEdit(field, value) {
    const nextValue = String(value || "").replace(/\s+/g, " ").trim();
    if (!nextValue) return;
    if (field === "phone" && phoneDigitCount(nextValue) !== REQUIRED_PHONE_DIGITS) {
      setError(PHONE_DIGIT_WARNING);
      return;
    }

    setBusy(true);
    setError("");
    try {
      const nextAlphaJson = structuredClone(alphaJson || {});
      nextAlphaJson.customer = nextAlphaJson.customer || {};
      nextAlphaJson.job = nextAlphaJson.job || {};
      nextAlphaJson.job.service_address = nextAlphaJson.job.service_address || {};
      const nextContact = { ...quoteContact };

      if (field === "phone") {
        nextAlphaJson.customer.phone_display = nextValue;
        nextAlphaJson.customer.phone_primary = nextValue;
        nextContact.phone = nextValue;
      } else if (field === "email") {
        nextAlphaJson.customer.email = nextValue.toLowerCase();
        nextContact.email = nextValue.toLowerCase();
      } else if (field === "address") {
        const normalizedAddress = normalizeEditedServiceAddress(nextValue) || nextValue;
        nextAlphaJson.job.service_address = {
          ...(nextAlphaJson.job.service_address || {}),
          display: normalizedAddress,
          review_flags: {
            ...(nextAlphaJson.job.service_address?.review_flags || {}),
            service_address_edited_by_td: true,
            service_address_edited_by_td_value: normalizedAddress,
          },
        };
        nextContact.address = normalizedAddress;
      }

      setQuoteContact(nextContact);
      await validateEditedAlphaJson(nextAlphaJson, nextContact, "Required info updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function applyJobDescriptionEdit(description) {
    const nextDescription = String(description || "").replace(/\s+/g, " ").trim();
    if (!nextDescription) return;

    setBusy(true);
    setError("");
    try {
      const nextAlphaJson = structuredClone(alphaJson || {});
      nextAlphaJson.job = nextAlphaJson.job || {};
      nextAlphaJson.job.description = nextDescription;
      await validateEditedAlphaJson(nextAlphaJson, quoteContact, "Job description updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function applyOptionDescriptionEdit(optionIndex, description) {
    const nextDescription = normalizeTreeServiceText(description);
    if (!nextDescription) return;

    setBusy(true);
    setError("");
    try {
      const nextAlphaJson = structuredClone(alphaJson || {});
      const items = Array.isArray(nextAlphaJson.service_options?.items)
        ? nextAlphaJson.service_options.items
        : [];
      if (!items[optionIndex]) return;

      items[optionIndex] = {
        ...items[optionIndex],
        description: nextDescription,
        scope_unclear: false,
        review_flags: {
          ...(items[optionIndex].review_flags || {}),
          scope_unclear: false,
          scope_warning: "",
          description_edited_by_td: true,
          description_edited_by_td_value: nextDescription,
        },
      };

      await validateEditedAlphaJson(nextAlphaJson, quoteContact, "Option description updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function applyOptionPriceEdit(optionIndex, priceText) {
    const normalizedPrice = normalizeEditedPrice(priceText);
    if (!normalizedPrice.display) return;

    setBusy(true);
    setError("");
    try {
      const nextAlphaJson = structuredClone(alphaJson || {});
      const items = Array.isArray(nextAlphaJson.service_options?.items)
        ? nextAlphaJson.service_options.items
        : [];
      if (!items[optionIndex]) return;

      items[optionIndex] = {
        ...items[optionIndex],
        price: {
          ...(items[optionIndex].price || {}),
          initial_display: items[optionIndex].price?.initial_display || items[optionIndex].price?.display || "",
          display: normalizedPrice.display,
          amount: normalizedPrice.amount,
          price_type: items[optionIndex].price?.price_type || "fixed",
          is_unclear: false,
          status: "firm",
          edited_by_td: true,
        },
      };

      await validateEditedAlphaJson(nextAlphaJson, quoteContact, "Option price updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function applyAddOption({ description, price }) {
    const nextDescription = String(description || "").replace(/\s+/g, " ").trim();
    const normalizedPrice = normalizeEditedPrice(price);
    if (!nextDescription || !normalizedPrice.display) return;

    setBusy(true);
    setError("");
    try {
      const nextAlphaJson = structuredClone(alphaJson || {});
      nextAlphaJson.service_options = nextAlphaJson.service_options || {};
      const items = Array.isArray(nextAlphaJson.service_options.items)
        ? nextAlphaJson.service_options.items
        : [];
      nextAlphaJson.service_options.items = [
        ...items,
        {
          label: `Option ${String.fromCharCode(65 + items.length)}`,
          title: nextDescription,
          description: nextDescription,
          price: {
            display: normalizedPrice.display,
            amount: normalizedPrice.amount,
            price_type: "fixed",
            is_unclear: false,
            status: "firm",
          },
        },
      ];

      await validateEditedAlphaJson(nextAlphaJson, quoteContact, "Option added.");
    } catch (err) {
      setError(err.message);
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
        treeDude: record.documents?.treeDude || record.documents?.["tree-dude"],
      });
      setValidation({ can_generate_pdf: true, follow_ups: [] });
      setDebugPipeline(null);
      setReviewOverrides(emptyReviewOverrides);
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
      setNotice("Use Record Manual Acceptance on the estimate panel.");
      return;
    }
    setNotice("Create or open an estimate before recording manual acceptance.");
  }

  const cards = [...recentCards, ...emptyRecentCards].slice(0, 3);

  return (
    <main>
      <section className="banner">
        <h1>Alpha Tree</h1>
        <p>New Estimate to send to Customer</p>
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
              debugPipeline={debugPipeline}
              reviewOverrides={reviewOverrides}
              onReviewOverridesChange={setReviewOverrides}
              onTreeCountOverrideChange={applyTreeCountOverride}
              onOptionDescriptionChange={applyOptionDescriptionEdit}
              onOptionPriceChange={applyOptionPriceEdit}
              onAddOption={applyAddOption}
              onCustomerFieldChange={applyCustomerFieldEdit}
              onJobDescriptionChange={applyJobDescriptionEdit}
              intake={quoteContact}
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
              debugPipeline={debugPipeline}
              reviewOverrides={reviewOverrides}
              intake={quoteContact}
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
