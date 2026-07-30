"use client";

import { useEffect, useRef, useState } from "react";
import ErrorAlert from "./components/ErrorAlert.jsx";
import InputForm from "./components/InputForm.jsx";
import JsonReview from "./components/JsonReview.jsx";
import PdfGenerator from "./components/PdfGenerator.jsx";
import {
  ADDRESS_POLICY_VERSION,
  CONTACT_POLICY_VERSION,
  PRICE_POLICY_VERSION,
  TREE_SCOPE_POLICY_VERSION,
} from "../lib/decisionEnvelope.js";
import { normalizeEditedServiceAddress, normalizeTreeServiceText } from "../lib/normalizeAlphaJson.js";
import { createReviewerDecisionAction } from "../lib/reviewerDecisionLog.js";
import {
  REVIEWER_LEDGER_POLICY_VERSION,
  appendReviewerDecision,
  classifyTextEditAction,
  classifyValueEditAction,
  createReviewerDecision,
} from "../lib/reviewerDecisionLedger.js";

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

function stampLedgerDecision(alphaJson, {
  field,
  action,
  before,
  after,
  resolutionPolicyVersion,
  candidateIds,
  conflictId,
  reasonCode,
}) {
  const decision = createReviewerDecision({
    estimateId: alphaJson?.document?.number || "",
    field,
    action,
    before,
    after,
    candidateIds,
    conflictId,
    reasonCode,
    actorId: "business_user",
    extractionVersion: alphaJson?.schema_info?.schema_version || "unknown",
    resolutionPolicyVersion,
  });
  return appendReviewerDecision(alphaJson, decision);
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
        <section className="card front-future-card">
          <h2>To be added later</h2>
          <div className="front-action-row">
            <button className="front-action front-action-secondary" type="button" onClick={onManualAcceptance}>Record Manual Acceptance</button>
            <button className="front-action front-action-invoice" type="button" onClick={onNewInvoice}>New Invoice</button>
            <button className="front-action front-action-recent" type="button" onClick={() => setShowRecentEstimates((current) => !current)}>Recent Estimates</button>
          </div>
        </section>
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
  const [decisionLog, setDecisionLog] = useState([]);
  const [priceAlternativesConfirmed, setPriceAlternativesConfirmed] = useState(false);
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
      setDecisionLog([]);
      setPriceAlternativesConfirmed(false);
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
    setDecisionLog([]);
    setPriceAlternativesConfirmed(false);
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
      setDecisionLog([]);
      setPriceAlternativesConfirmed(false);
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
    setDecisionLog([]);
    setPriceAlternativesConfirmed(false);
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
      const result = await postJson("/api/pdf", { alphaJson, reviewOverrides, decisionLog });
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

  function recordDecisionAction(action) {
    try {
      const entry = createReviewerDecisionAction(action);
      setDecisionLog((log) => [...log, entry]);
      return entry;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }

  async function acceptTreeScopeSuggestion(exception) {
    if (!exception?.suggested?.value) return;
    const rejectedIds = exception.alternative?.id && exception.alternative.id !== exception.suggested.id
      ? [exception.alternative.id]
      : [];
    await applyTreeCountOverride(exception.suggested.value, {
      action: "accept_candidate",
      candidateIds: [exception.suggested.id].filter(Boolean),
      reasonCode: exception.reasonCode,
    });
    recordDecisionAction({
      field: exception.field,
      action: "selected_candidate",
      candidateId: exception.suggested.id,
      value: exception.suggested.value,
      note: "Reviewer selected suggested tree scope",
    });
    if (rejectedIds.length) {
      stampRejectedCandidates(exception.field, rejectedIds, TREE_SCOPE_POLICY_VERSION);
      recordDecisionAction({
        field: exception.field,
        action: "rejected_candidate",
        candidateId: exception.alternative.id,
        value: exception.alternative.value,
        note: "Reviewer rejected alternate tree scope",
      });
    }
  }

  async function keepBothTreeScope(exception) {
    if (!exception) return;
    const keepValue = exception.combinedValue || exception.alternative?.value || exception.earlier?.value;
    if (!keepValue) return;
    const candidateIds = [exception.alternative?.id, exception.suggested?.id].filter(Boolean);
    await applyTreeCountOverride(keepValue, {
      action: "resolve_conflict",
      candidateIds,
      conflictId: exception.field,
      reasonCode: exception.reasonCode,
    });
    if (exception.alternative?.id) {
      recordDecisionAction({
        field: exception.field,
        action: "selected_candidate",
        candidateId: exception.alternative.id,
        value: keepValue,
        note: "Reviewer kept earlier / both scope",
      });
    }
    if (exception.suggested?.id && exception.suggested.id !== exception.alternative?.id) {
      recordDecisionAction({
        field: exception.field,
        action: "rejected_candidate",
        candidateId: exception.suggested.id,
        value: exception.suggested.value,
        note: "Reviewer rejected suggested narrowing",
      });
    }
  }

  async function enterAlternateTreeScope(text) {
    const nextValue = String(text || "").replace(/\s+/g, " ").trim();
    if (!nextValue) return;
    await applyTreeCountOverride(nextValue, { action: "enter_new_value" });
    recordDecisionAction({
      field: "job.tree_details.tree_count",
      action: "entered_new_value",
      value: nextValue,
      note: "Reviewer entered a new value",
    });
  }

  function stampRejectedCandidates(field, candidateIds, resolutionPolicyVersion) {
    setAlphaJson((current) => {
      let next = structuredClone(current || {});
      for (const candidateId of candidateIds) {
        next = stampLedgerDecision(next, {
          field,
          action: "reject_candidate",
          before: candidateId,
          after: null,
          candidateIds: [candidateId],
          resolutionPolicyVersion,
        });
      }
      return next;
    });
  }

  function confirmPriceAlternatives(exception) {
    if (!exception) return;
    const candidateIds = (exception.candidates || []).map((candidate) => candidate.id).filter(Boolean);
    setAlphaJson((current) => stampLedgerDecision(structuredClone(current || {}), {
      field: exception.field,
      action: "accept_candidate",
      before: null,
      after: candidateIds,
      candidateIds,
      resolutionPolicyVersion: PRICE_POLICY_VERSION,
    }));
    for (const candidate of exception.candidates || []) {
      recordDecisionAction({
        field: exception.field,
        action: "selected_candidate",
        candidateId: candidate.id,
        value: candidate.display,
        note: "Reviewer selected candidate price option",
      });
    }
    setPriceAlternativesConfirmed(true);
    setNotice("Estimate options confirmed.");
  }

  function editPriceAlternatives() {
    setNotice("Edit the option prices or descriptions below, then confirm when ready.");
  }

  async function markBusinessChange(field) {
    const ledgerField = field || "job.tree_details.tree_count";
    const currentValue = alphaJson?.job?.tree_details?.tree_count || "";
    let nextAlphaJson = stampLedgerDecision(structuredClone(alphaJson || {}), {
      field: ledgerField,
      action: "business_scope_change",
      before: currentValue,
      after: currentValue,
      resolutionPolicyVersion: TREE_SCOPE_POLICY_VERSION,
    });
    recordDecisionAction({
      field: ledgerField,
      action: "marked_business_change",
      note: "Reviewer marked this as a business change",
    });
    try {
      await validateEditedAlphaJson(nextAlphaJson, quoteContact, "Marked as a business change.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function applyTreeCountOverride(treeCountOverride, ledgerMeta = {}) {
    setBusy(true);
    setError("");
    try {
      const before = alphaJson?.job?.tree_details?.tree_count || "";
      const after = treeCountOverride === "Unknown" ? "" : treeCountOverride;
      const nextContact = { ...quoteContact, treeCountOverride };
      let nextAlphaJson = structuredClone(alphaJson || {});
      nextAlphaJson = stampLedgerDecision(nextAlphaJson, {
        field: "job.tree_details.tree_count",
        action: ledgerMeta.action || classifyValueEditAction({
          before,
          after,
          wasUnclear: treeCountOverride === "Unknown",
        }),
        before,
        after: treeCountOverride,
        candidateIds: ledgerMeta.candidateIds,
        conflictId: ledgerMeta.conflictId,
        reasonCode: ledgerMeta.reasonCode,
        resolutionPolicyVersion: TREE_SCOPE_POLICY_VERSION,
      });
      const validated = await postJson("/api/validate", {
        alphaJson: nextAlphaJson,
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
      let nextAlphaJson = structuredClone(alphaJson || {});
      nextAlphaJson.customer = nextAlphaJson.customer || {};
      nextAlphaJson.job = nextAlphaJson.job || {};
      nextAlphaJson.job.service_address = nextAlphaJson.job.service_address || {};
      const nextContact = { ...quoteContact };
      let ledgerField = "";
      let before = null;
      let after = nextValue;
      let resolutionPolicyVersion = CONTACT_POLICY_VERSION;

      if (field === "phone") {
        ledgerField = "customer.phone_display";
        before = nextAlphaJson.customer.phone_display || "";
        nextAlphaJson.customer.phone_display = nextValue;
        nextAlphaJson.customer.phone_primary = nextValue;
        nextContact.phone = nextValue;
      } else if (field === "email") {
        ledgerField = "customer.email";
        before = nextAlphaJson.customer.email || "";
        after = nextValue.toLowerCase();
        nextAlphaJson.customer.email = after;
        nextContact.email = after;
      } else if (field === "address") {
        ledgerField = "job.service_address.display";
        before = nextAlphaJson.job.service_address?.display || "";
        const normalizedAddress = normalizeEditedServiceAddress(nextValue) || nextValue;
        after = normalizedAddress;
        resolutionPolicyVersion = ADDRESS_POLICY_VERSION;
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

      if (ledgerField) {
        nextAlphaJson = stampLedgerDecision(nextAlphaJson, {
          field: ledgerField,
          action: classifyValueEditAction({ before, after }),
          before,
          after,
          resolutionPolicyVersion,
        });
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
      let nextAlphaJson = structuredClone(alphaJson || {});
      nextAlphaJson.job = nextAlphaJson.job || {};
      const before = nextAlphaJson.job.description || "";
      nextAlphaJson.job.description = nextDescription;
      nextAlphaJson = stampLedgerDecision(nextAlphaJson, {
        field: "job.description",
        action: classifyTextEditAction({ before, after: nextDescription }),
        before,
        after: nextDescription,
        resolutionPolicyVersion: TREE_SCOPE_POLICY_VERSION,
      });
      await validateEditedAlphaJson(nextAlphaJson, quoteContact, "Job description updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function optionTitleIsGeneric(title = "") {
    return /^(?:option\s+[A-E1-5]?|option details?|tree work|tree service work|service option(?:\s+[A-E1-5])?|work scope unclear|scope unclear)$/i
      .test(String(title || "").trim());
  }

  function titleFromConfirmedScope(description = "") {
    const text = normalizeTreeServiceText(description);
    if (!text) return "";
    const firstSentence = text.split(/[.;]/).map((part) => part.trim()).find(Boolean) || text;
    return firstSentence.length > 80 ? `${firstSentence.slice(0, 77).trim()}...` : firstSentence;
  }

  async function applyOptionDescriptionEdit(optionIndex, description, { updateGenericTitle = false } = {}) {
    const nextDescription = normalizeTreeServiceText(description);
    if (!nextDescription) return;

    setBusy(true);
    setError("");
    try {
      let nextAlphaJson = structuredClone(alphaJson || {});
      const items = Array.isArray(nextAlphaJson.service_options?.items)
        ? nextAlphaJson.service_options.items
        : [];
      if (!items[optionIndex]) return;

      const before = items[optionIndex].description || "";
      const nextOption = {
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
      if (updateGenericTitle && optionTitleIsGeneric(nextOption.title)) {
        nextOption.title = titleFromConfirmedScope(nextDescription);
      }
      items[optionIndex] = nextOption;

      nextAlphaJson = stampLedgerDecision(nextAlphaJson, {
        field: `service_options.items[${optionIndex}].description`,
        action: classifyTextEditAction({ before, after: nextDescription }),
        before,
        after: nextDescription,
        resolutionPolicyVersion: TREE_SCOPE_POLICY_VERSION,
      });

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
      let nextAlphaJson = structuredClone(alphaJson || {});
      const items = Array.isArray(nextAlphaJson.service_options?.items)
        ? nextAlphaJson.service_options.items
        : [];
      if (!items[optionIndex]) return;

      const beforePrice = items[optionIndex].price || {};
      const before = {
        amount: beforePrice.amount ?? null,
        display: beforePrice.display || "",
      };
      const after = {
        amount: normalizedPrice.amount,
        display: normalizedPrice.display,
      };

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

      nextAlphaJson = stampLedgerDecision(nextAlphaJson, {
        field: `service_options.items[${optionIndex}].price`,
        action: classifyValueEditAction({
          before,
          after,
          wasUnclear: Boolean(beforePrice.is_unclear),
        }),
        before,
        after,
        resolutionPolicyVersion: PRICE_POLICY_VERSION,
      });

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
      let nextAlphaJson = structuredClone(alphaJson || {});
      nextAlphaJson.service_options = nextAlphaJson.service_options || {};
      const items = Array.isArray(nextAlphaJson.service_options.items)
        ? nextAlphaJson.service_options.items
        : [];
      const newIndex = items.length;
      const after = {
        label: `Option ${String.fromCharCode(65 + newIndex)}`,
        title: nextDescription,
        description: nextDescription,
        price: {
          display: normalizedPrice.display,
          amount: normalizedPrice.amount,
          price_type: "fixed",
          is_unclear: false,
          status: "firm",
        },
      };
      nextAlphaJson.service_options.items = [...items, after];

      nextAlphaJson = stampLedgerDecision(nextAlphaJson, {
        field: `service_options.items[${newIndex}]`,
        action: "enter_new_value",
        before: null,
        after,
        resolutionPolicyVersion: REVIEWER_LEDGER_POLICY_VERSION,
      });

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
      setDecisionLog([]);
      setPriceAlternativesConfirmed(false);
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
  const usesPurpleBackground = stage === "front" || stage === "new";

  return (
    <main className={usesPurpleBackground ? "app-stage-purple" : ""}>
      <section className="banner">
        <h1>Alpha Tree</h1>
        <p><a className="banner-branch-url" href="https://tsweb-git-master-version100-ea47243.vercel.app">https://tsweb-git-master-version100-ea47243.vercel.app</a> <span className="banner-title-text">Production version with more parsers/normalizers</span></p>
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
              priceAlternativesConfirmed={priceAlternativesConfirmed}
              onReviewOverridesChange={setReviewOverrides}
              onTreeCountOverrideChange={applyTreeCountOverride}
              onOptionDescriptionChange={applyOptionDescriptionEdit}
              onOptionPriceChange={applyOptionPriceEdit}
              onAddOption={applyAddOption}
              onCustomerFieldChange={applyCustomerFieldEdit}
              onJobDescriptionChange={applyJobDescriptionEdit}
              onAcceptTreeScopeSuggestion={acceptTreeScopeSuggestion}
              onKeepBothTreeScope={keepBothTreeScope}
              onEnterTreeScope={enterAlternateTreeScope}
              onConfirmPriceAlternatives={confirmPriceAlternatives}
              onEditPriceAlternatives={editPriceAlternatives}
              onMarkBusinessChange={markBusinessChange}
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
