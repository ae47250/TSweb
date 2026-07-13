"use client";

import { useEffect, useState } from "react";
import { buildCustomerJobSummary, normalizeEditedServiceAddress, normalizeServiceAddress, normalizeTreeServiceText } from "../../lib/normalizeAlphaJson.js";
import { LOCAL_INDIANA_TOWNS } from "../../lib/localTowns.js";
import { getBlockingOverrideStatus, normalizeReviewOverrides } from "../../lib/reviewOverrides.js";

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const localTownDisplayPattern = LOCAL_INDIANA_TOWNS
  .slice()
  .sort((a, b) => b.length - a.length)
  .map((town) => escapeRegExp(town).replace(/\s+/g, "\\s+"))
  .join("|");

function splitServiceAddressDisplay(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return { street: "Address missing", cityState: "" };
  if (/^Address missing$/i.test(text)) return { street: text, cityState: "" };

  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) {
    return { street: parts[0], cityState: parts.slice(1).join(", ") };
  }

  const townMatch = text.match(new RegExp(`^(.*?)\\s+(${localTownDisplayPattern})(?:\\s+(Indiana|IN))?$`, "i"));
  if (townMatch?.[1]) {
    return {
      street: townMatch[1].trim(),
      cityState: [townMatch[2], townMatch[3]].filter(Boolean).join(" "),
    };
  }

  return { street: text, cityState: "" };
}

const REQUIRED_PHONE_DIGITS = 10;
const PHONE_DIGIT_WARNING = `Phone number must be ${REQUIRED_PHONE_DIGITS} digits including area code.`;

function phoneDigitCount(value) {
  return String(value || "").replace(/\D/g, "").length;
}

function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function optionRenderKey(option, index) {
  return `${option?.id || option?.option_id || option?.label || "option"}-${index}`;
}

const warningPattern = /\b(aggressive\s+dogs?|dogs?|warning|hazard|power\s*lines?|wires?|unsafe|locked\s+gate|gate\s+code|access|poison\s+ivy|bees?|wasps?)\b/i;
const treePattern = /\b(trees?|limbs?|branches?|stumps?|oak|pine|maple|ash|elm|cedar|sycamore|trim|remove|removal|cut|drop|haul|cleanup|grind)\b/i;

function splitNoteParts(text) {
  return normalizeTreeServiceText(text)
    .split(/(?<=[.!?])\s+|;\s+|,\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function extractWarningParts(text) {
  return splitNoteParts(text).filter((part) => warningPattern.test(part));
}

function orderJobWarningsLast(text) {
  const normalized = normalizeTreeServiceText(text);
  const parts = splitNoteParts(normalized);

  if (parts.length < 2) return normalized;

  const jobParts = parts.filter((part) => !warningPattern.test(part));
  const warningParts = parts.filter((part) => warningPattern.test(part));

  if (!warningParts.length || !jobParts.some((part) => treePattern.test(part))) return normalized;

  return [...jobParts, ...warningParts.map((part) => /^warning:/i.test(part) ? part : `Warning: ${part}`)]
    .join(". ")
    .replace(/\s+\./g, ".")
    .replace(/\.+/g, ".")
    .trim();
}

function cleanJobNotesForReview(sourceNotes, alphaJson) {
  let text = String(sourceNotes || alphaJson.job?.description || "").trim();
  const customer = alphaJson.customer || {};
  const address = alphaJson.job?.service_address?.display || "";
  const removals = [
    customer.name,
    customer.phone_display,
    customer.phone_primary,
    customer.email,
    address,
  ].filter(Boolean);

  for (const value of removals) {
    text = text.replace(new RegExp(escapeRegExp(value), "gi"), " ");
  }

  text = text
    .replace(/\bCustomer\s+name\s*:\s*/gi, " ")
    .replace(/\bCustomer\s+phone\s*:\s*/gi, " ")
    .replace(/\bCustomer\s+email\s*:\s*/gi, " ")
    .replace(/\bService\s+address\s*:\s*/gi, " ")
    .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-./\s]?\d{3}[-./\s]?\d{4}\b/g, " ")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, " ");
  const warningParts = extractWarningParts(text);

  const optionIndex = text.search(/\bOption\s*(?:[A-E]|[1-5])\b/i);
  if (optionIndex > -1) text = text.slice(0, optionIndex);

  const priceIndex = text.search(/\$?\s*[0-9][0-9,]*(?:\.\d{2})?\b/);
  if (priceIndex > -1) text = text.slice(0, priceIndex);

  text = text
    .replace(/\b(?:for|at|price|cost|would be|is)\s*$/i, "")
    .replace(/[,:;.\s-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const cleanedText = normalizeTreeServiceText(text);
  const extraWarnings = warningParts.filter((part) => !cleanedText.toLowerCase().includes(normalizeTreeServiceText(part).toLowerCase()));
  const notesWithWarnings = [cleanedText, ...extraWarnings].filter(Boolean).join(". ");
  return orderJobWarningsLast(notesWithWarnings || alphaJson.job?.description || "No job notes supplied.");
}

function formatDebugJson(value) {
  return JSON.stringify(value ?? null, null, 2);
}

function DebugJsonBlock({ value }) {
  return <pre className="debug-json-block">{formatDebugJson(value)}</pre>;
}

function highlightDebugCorrections(text, corrections = []) {
  const sourceText = String(text || "");
  const originals = [...new Set(corrections.map((item) => String(item?.original || "").trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length);

  if (!originals.length) return sourceText;

  const pattern = new RegExp(`(${originals.map(escapeRegExp).join("|")})`, "gi");
  return sourceText.split(pattern).map((part, index) => (
    originals.some((original) => original.toLowerCase() === part.toLowerCase())
      ? <strong className="debug-typo-highlight" key={`${part}-${index}`}>{part}</strong>
      : part
  ));
}

function DebugTextBlock({ text, corrections = [] }) {
  return <div className="debug-text-block">{highlightDebugCorrections(text, corrections)}</div>;
}

function DebugOpenAiDraft({ debugPipeline }) {
  if (debugPipeline.source === "local-draft-parser") {
    return (
      <div className="debug-text-block debug-simulation-note">
        OpenAI not used - this is simulation.
      </div>
    );
  }

  return <DebugJsonBlock value={debugPipeline.rawOpenAiDraftJson} />;
}

function DebugStageSummary({ stages = [] }) {
  if (!stages.length) return null;

  return (
    <div className="debug-stage-summary" aria-label="Debug pipeline stages">
      {stages.map((stage) => (
        <div className="debug-stage-card" key={stage.label}>
          <span className="debug-stage-label">{stage.label}</span>
          <strong>{stage.status}</strong>
          <p>{stage.meaning}</p>
        </div>
      ))}
    </div>
  );
}

function DebugRenderedRows({ renderedFields }) {
  const rows = [
    ["Customer name", renderedFields.customerCard.name.value, renderedFields.customerCard.name.source],
    ["Phone", renderedFields.customerCard.phone.value, renderedFields.customerCard.phone.source],
    ["Email", renderedFields.customerCard.email.value, renderedFields.customerCard.email.source],
    ["Service address", renderedFields.customerCard.serviceAddress.value, renderedFields.customerCard.serviceAddress.source],
    ["Job summary", renderedFields.jobSummary.value, renderedFields.jobSummary.source],
    ["Needs more info", renderedFields.needsMoreInfo.value, renderedFields.needsMoreInfo.source],
  ];

  return (
    <div className="debug-rendered-fields">
      {rows.map(([label, value, source]) => (
        <div className="debug-rendered-row" key={label}>
          <span className="debug-rendered-label">{label}</span>
          <span className="debug-rendered-value">{value || "None"}</span>
          <code>{source}</code>
        </div>
      ))}
      {renderedFields.quoteOptions.length > 0 && (
        <div className="debug-rendered-options">
          <span className="debug-rendered-label">Estimate options</span>
          {renderedFields.quoteOptions.map((option, index) => (
            <div className="debug-rendered-option" key={optionRenderKey(option, index)}>
              <strong>{option.label}</strong>
              <span>{option.price}</span>
              <p>{option.title}</p>
              <small>{option.description}</small>
              <code>{option.source}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function buildDebugExplanation(validation, renderedFields) {
  const blocking = validation?.blocking_errors || [];
  const followUps = validation?.follow_ups || [];
  const warnings = validation?.warnings || [];

  if (blocking.length > 0 || followUps.length > 0) {
    return {
      meaning: "The estimate is not ready for the customer yet. Validation found missing or unclear information.",
      suggestion: followUps[0] || blocking[0] || "Add the missing job details in TD1 and create the review again.",
      why: "TD2 should only confirm estimates when the address, contact method, work scope, and priced option are clear enough for a customer-facing estimate.",
    };
  }

  if (warnings.length > 0) {
    return {
      meaning: "The estimate can be generated, but one or more details should be reviewed.",
      suggestion: warnings[0],
      why: "Warnings do not block the estimate, but they usually point to safety, access, address, or cleanup details worth checking before sending.",
    };
  }

  if (renderedFields.quoteOptions.length < 1) {
    return {
      meaning: "TD2 has no estimate option to show.",
      suggestion: "Add at least one priced option in the notes, then create the review again.",
      why: "The customer needs a clear option and price before the estimate can be useful.",
    };
  }

  return {
    meaning: "The pipeline produced a customer-ready TD2 review.",
    suggestion: "Compare Raw TD1 Input with TD2 Rendered Fields. If TD2 looks wrong, the issue is probably in normalization or the TD2 display mapping.",
    why: "This shows whether the data changed during OpenAI drafting, cleanup, validation, or final TD2 rendering.",
  };
}

function DebugPipelinePanel({ debugPipeline, alphaJson, validation, renderedFields }) {
  const [isOpen, setIsOpen] = useState(true);
  if (!debugPipeline) return null;

  const explanation = buildDebugExplanation(validation, renderedFields);
  const rawText = debugPipeline.rawTd1Input?.customer_text || "";
  const corrections = (debugPipeline.cleanedCanonicalAlphaJson || alphaJson)?.normalization?.corrections_made || [];

  return (
    <section className="debug-pipeline-panel" aria-label="Debug Pipeline">
      <button className="btn-secondary debug-pipeline-toggle" type="button" onClick={() => setIsOpen((current) => !current)}>
        {isOpen ? "Hide Debug Pipeline" : "Show Debug Pipeline"}
      </button>
      {isOpen && (
        <div className="debug-pipeline-content">
          <div className="debug-explanation">
            <p><strong>What this means:</strong> {explanation.meaning}</p>
            <p><strong>Suggested fix:</strong> {explanation.suggestion}</p>
            <p><strong>Why:</strong> {explanation.why}</p>
          </div>
          <DebugStageSummary stages={debugPipeline.stages || []} />

          <h3>Raw TD1 Input</h3>
          <p className="debug-field-note">This is exactly what TD1 sent as <code>customer_text</code>.</p>
          <DebugTextBlock text={rawText} corrections={corrections} />

          <h3>Raw OpenAI Draft JSON</h3>
          <p className="debug-field-note">This is the parsed OpenAI response before <code>normalizeToAlphaJsonV14()</code> cleaned it.</p>
          <DebugOpenAiDraft debugPipeline={debugPipeline} />

          <h3>TD2 Normalization Output</h3>
          <p className="debug-field-note">This is the cleaned AlphaJSON after <code>normalizeToAlphaJsonV14()</code>. TD2 reads from this, not directly from the raw note.</p>
          <DebugJsonBlock value={debugPipeline.cleanedCanonicalAlphaJson || alphaJson} />

          <h3>TD2 Validation Result</h3>
          <p className="debug-field-note">This decides whether TD2 can confirm the estimate or needs more information.</p>
          <DebugJsonBlock value={debugPipeline.validationResult || validation} />

          <h3>TD2 Rendered Fields</h3>
          <p className="debug-field-note">This is what TD2 actually displays, with each field path shown beside its value.</p>
          <DebugRenderedRows renderedFields={renderedFields} />
        </div>
      )}
    </section>
  );
}

function OverrideWarningCard({ status, overrides, warningItems = [], onChange }) {
  const hasOverrideControls = status.needsAddressOverride
    || status.needsContactOverride
    || status.needsPhoneOverride
    || status.needsEmailOverride
    || status.needsScopeOverride;
  if (!hasOverrideControls && warningItems.length < 1) return null;

  function toggle(key) {
    onChange?.({ ...overrides, [key]: !overrides[key] });
  }

  const contactWarning = status.contactWarning;
  const contactCheckText = contactOverrideText(contactWarning);
  const contactAccepted = contactWarning ? Boolean(overrides[contactWarning.key]) : false;

  return (
    <section className="summary-card override-warning-card">
      <h3>Internal Warning</h3>
      {hasOverrideControls && (
        <div className="override-warning-actions">
          {status.needsAddressOverride && (
            <div className="override-warning-item">
              <label className="override-check-row">
                <input
                  type="checkbox"
                  checked={Boolean(overrides.missingAddress)}
                  onChange={() => toggle("missingAddress")}
                />
                <span>Create Estimate without exact address</span>
              </label>
            </div>
          )}
          {contactWarning && (
            <div className="override-warning-item">
              <label className="override-check-row">
                <input
                  type="checkbox"
                  checked={contactAccepted}
                  onChange={() => toggle(contactWarning.key)}
                />
                <span>{contactCheckText}</span>
              </label>
            </div>
          )}
          {status.needsScopeOverride && (
            <div className="override-warning-item">
              <label className="override-check-row">
                <input
                  type="checkbox"
                  checked={Boolean(overrides.unclearScopeWithPrice)}
                  onChange={() => toggle("unclearScopeWithPrice")}
                />
                <span>Create Estimate with unclear work scope</span>
              </label>
              <p className="override-warning-note">
                Prices are clear, but work scope needs Tree Dude approval.
              </p>
            </div>
          )}
        </div>
      )}
      {warningItems.length > 0 && (
        <div className="warning-card">
          <ul>
            {warningItems.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

function contactOverrideText(contactWarning) {
  return {
    missingPhone: "Create Estimate without phone number",
    missingEmail: "Create Estimate without email",
    missingContact: "Create Estimate without phone number or email",
  }[contactWarning?.key];
}

function ContactOverrideCheckbox({ status, overrides, onChange }) {
  const contactWarning = status?.contactWarning;
  const contactCheckText = contactOverrideText(contactWarning);
  if (!contactWarning || !contactCheckText) return null;

  return (
    <div className="override-warning-item">
      <label className="override-check-row">
        <input
          type="checkbox"
          checked={Boolean(overrides[contactWarning.key])}
          onChange={() => onChange?.({ ...overrides, [contactWarning.key]: !overrides[contactWarning.key] })}
        />
        <span>{contactCheckText}</span>
      </label>
    </div>
  );
}

function AddressOverrideCheckbox({ status, overrides, onChange }) {
  if (!status?.needsAddressOverride) return null;

  return (
    <div className="override-warning-item">
      <label className="override-check-row">
        <input
          type="checkbox"
          checked={Boolean(overrides.missingAddress)}
          onChange={() => onChange?.({ ...overrides, missingAddress: !overrides.missingAddress })}
        />
        <span>Create Estimate without exact address</span>
      </label>
    </div>
  );
}

function CustomerOverrideCheckbox({ overrideKey, label, overrides = {}, onChange }) {
  if (!overrideKey || !label) return null;

  return (
    <div className="override-warning-item">
      <label className="override-check-row">
        <input
          type="checkbox"
          checked={Boolean(overrides[overrideKey])}
          onChange={() => onChange?.({ ...overrides, [overrideKey]: !overrides[overrideKey] })}
        />
        <span>{label}</span>
      </label>
    </div>
  );
}

function inlineContactOverrideStatus(status) {
  if (!status.needsContactOverride && !status.needsPhoneOverride && !status.needsEmailOverride) return null;
  return {
    ...status,
    needsAddressOverride: false,
    needsScopeOverride: false,
  };
}

function inlineMissingPhoneOverrideStatus(status) {
  if (status.contactWarning?.key !== "missingPhone") return null;
  return {
    ...status,
    needsAddressOverride: false,
    needsContactOverride: false,
    needsPhoneOverride: true,
    needsEmailOverride: false,
    needsScopeOverride: false,
  };
}

function inlineAddressOverrideStatus(status) {
  if (!status.needsAddressOverride) return null;
  return {
    ...status,
    needsContactOverride: false,
    needsPhoneOverride: false,
    needsEmailOverride: false,
    needsScopeOverride: false,
    contactWarning: null,
  };
}

function withoutInlineOverrideStatus(status, { contact = false, address = false } = {}) {
  return {
    ...status,
    needsAddressOverride: address ? false : status.needsAddressOverride,
    needsContactOverride: contact ? false : status.needsContactOverride,
    needsPhoneOverride: contact ? false : status.needsPhoneOverride,
    needsEmailOverride: contact ? false : status.needsEmailOverride,
    contactWarning: contact ? null : status.contactWarning,
  };
}

const TREE_COUNT_BLOCK_RE = /Tree count is marked unknown|Tree count is unclear|Missing tree count or clear scope/i;
const REVIEW_OVERRIDE_BLOCK_RE = /^(Missing service address|Service address looks unclear|Missing customer phone or email)\./i;
const REVIEW_OVERRIDE_FOLLOW_UP_RE = /(exact service address|customer phone|phone number|customer email|email address)/i;
const TREE_COUNT_CHOICES = [
  { value: "1 tree", label: "1 tree" },
  { value: "2 trees", label: "2 trees" },
  { value: "3 trees", label: "3 trees" },
  { value: "4 trees", label: "4 trees" },
  { value: "5+ trees", label: "5+ trees" },
  { value: "Still unclear but OK to proceed", label: "Still unclear but OK to proceed" },
];
const SCOPE_OVERRIDE_BLOCK_RE = /^(Unclear work scope: remove, trim, or another service|Property responsibility or work scope is unclear|Work scope unclear; confirm what this price covers)\.?/i;
const SCOPE_OVERRIDE_FOLLOW_UP_RE = /(Should this job be removal, trimming, or another specific service|Clarify the work scope and who is responsible|Confirm whether the stump price covers stump work only or the full job)/i;

function isReviewOverrideIssue(issue, status = {}) {
  const text = String(issue || "").trim();
  if (status.needsScopeOverride && (SCOPE_OVERRIDE_BLOCK_RE.test(text) || SCOPE_OVERRIDE_FOLLOW_UP_RE.test(text))) return true;
  return REVIEW_OVERRIDE_BLOCK_RE.test(text) || REVIEW_OVERRIDE_FOLLOW_UP_RE.test(text);
}

function isOverrideRelatedWarning(warning, status = {}) {
  const text = String(warning || "").trim();
  if (status.needsAddressOverride && /\bservice\s+address|address\b/i.test(text)) return true;
  if (
    (status.needsContactOverride || status.needsPhoneOverride || status.needsEmailOverride) &&
    /\b(contact|phone|email|sms)\b/i.test(text)
  ) {
    return true;
  }
  if (
    status.needsScopeOverride &&
    /\b(work\s+scope|scope|property\s+responsibility|option\s+descriptions?)\b/i.test(text)
  ) {
    return true;
  }
  return false;
}

function TreeCountResolutionCard({ validation, busy = false, onApply }) {
  const [selectedCount, setSelectedCount] = useState("");
  const hasTreeCountBlock = (validation?.blocking_errors || []).some((error) => TREE_COUNT_BLOCK_RE.test(error));
  if (!hasTreeCountBlock || !onApply) return null;

  function handleSelect(event) {
    const nextCount = event.target.value;
    setSelectedCount(nextCount);
    if (!nextCount) return;
    onApply(nextCount);
  }

  return (
    <section className="summary-card override-warning-card">
      <h3>Tree Count Is Unclear</h3>
      <p>The notes do not make the number of trees clear. Select the count to continue.</p>
      <div className="tree-count-override-row">
        <label htmlFor="td2TreeCountOverride">
          Tree count
          <select
            id="td2TreeCountOverride"
            value={selectedCount}
            disabled={busy}
            onChange={handleSelect}
          >
            <option value="">Select count</option>
            {TREE_COUNT_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>{choice.label}</option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

function ManualTreeCountOverrideControl({ treeCountOverride, busy = false, onApply }) {
  const [changeOpen, setChangeOpen] = useState(false);
  const [selectedCount, setSelectedCount] = useState("");

  useEffect(() => {
    setChangeOpen(false);
    setSelectedCount("");
  }, [treeCountOverride]);

  if (!treeCountOverride || treeCountOverride === "Auto") return null;

  function handleToggle(event) {
    const checked = event.target.checked;
    setChangeOpen(checked);
    if (!checked) setSelectedCount("");
  }

  function handleSelect(event) {
    const nextCount = event.target.value;
    setSelectedCount(nextCount);
    if (!nextCount) return;
    setChangeOpen(false);
    setSelectedCount("");
    onApply?.(nextCount);
  }

  return (
    <div className="manual-tree-count-control">
      <p className="manual-override-note">
        Tree count set manually: {treeCountOverride}
      </p>
      {onApply && (
        <label className="manual-tree-count-change">
          <input
            type="checkbox"
            checked={changeOpen}
            disabled={busy}
            onChange={handleToggle}
          />
          <span>Change Tree Count</span>
        </label>
      )}
      {changeOpen && onApply && (
        <label className="manual-tree-count-picker" htmlFor="td2ManualTreeCountOverride">
          Tree count
          <select
            id="td2ManualTreeCountOverride"
            value={selectedCount}
            disabled={busy}
            onChange={handleSelect}
          >
            <option value="">Select count</option>
            {TREE_COUNT_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>{choice.label}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

function normalizeDisplayText(value) {
  return normalizeTreeServiceText(value).toLowerCase();
}

function formatOptionDisplayText(value) {
  const text = normalizeTreeServiceText(value || "").trim();
  return text.replace(/^([a-z])/, (letter) => letter.toUpperCase());
}

function optionTextHasBaseWork(value) {
  return /\b(remove|removal|take\s+down|cut\s+down|drop|trim)\b/i.test(value || "");
}

function optionTextHasTreeDetail(value) {
  return /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+\+?)\s+(?:[a-z]+\s+){0,3}(?:trees?|oaks?|pines?|maples?|elms?|ashes?|cedars?|sycamores?|hickories?|locusts?|birches?|spruces?|walnuts?|cherries?)\b|\b(oaks?|pines?|maples?|elms?|ashes?|cedars?|sycamores?|hickories?|locusts?|birches?|spruces?|walnuts?|cherries?)\s+trees?\b/i.test(value || "");
}

function optionTextHasAddOn(value) {
  return /\b(haul(?:\s+away|\s+off)?|cleanup|clean\s+up|stump\s+(?:grind|grinding)|grind\s+(?:stumps?|the\s+stump)|leave\s+wood|stack\s+wood)\b/i.test(value || "");
}

function optionTitleDetailScore(value) {
  const text = normalizeDisplayText(value || "");
  if (!text) return 0;
  let score = 0;
  if (optionTextHasBaseWork(text)) score += 2;
  if (optionTextHasTreeDetail(text)) score += 3;
  if (optionTextHasAddOn(text)) score += 2;
  if (/\bonly\b/i.test(text)) score += 1;
  return score;
}

function optionAdvisoryBaseTitle(value) {
  return normalizeTreeServiceText(value || "")
    .split(/(?<=[.!?])\s+|;\s+|\n+/)
    .map((part) => part.trim())
    .find((part) => optionTextHasBaseWork(part) && optionTextHasTreeDetail(part)) || "";
}

function optionDisplayTitle(option = {}, advisoryText = "") {
  const title = normalizeTreeServiceText(option.title || "").trim();
  const description = normalizeTreeServiceText(option.description || "").trim();
  const advisoryBase = optionAdvisoryBaseTitle(advisoryText);
  if (!title) return description || "Option details";
  if (!description || normalizeDisplayText(description) === normalizeDisplayText(title)) {
    if (advisoryBase && optionTitleDetailScore(advisoryBase) > optionTitleDetailScore(title)) {
      return /\bonly\b/i.test(title) && !/\bonly\b/i.test(advisoryBase)
        ? normalizeTreeServiceText(`${advisoryBase} only`)
        : advisoryBase;
    }
    return title;
  }

  const titleLower = normalizeDisplayText(title);
  const descriptionLower = normalizeDisplayText(description);
  if (descriptionLower.includes(titleLower)) return description;
  if (titleLower.includes(descriptionLower)) return title;
  if (optionTextHasBaseWork(title) && optionTextHasTreeDetail(title) && optionTextHasAddOn(description) && !optionTextHasAddOn(title)) {
    return normalizeTreeServiceText(`${title} and ${description}`);
  }
  const bestParsedTitle = optionTitleDetailScore(description) > optionTitleDetailScore(title) ? description : title;
  if (advisoryBase && optionTitleDetailScore(advisoryBase) > optionTitleDetailScore(bestParsedTitle)) {
    if (/\bonly\b/i.test(`${title} ${description}`) && !/\bonly\b/i.test(advisoryBase)) {
      return normalizeTreeServiceText(`${advisoryBase} only`);
    }
    if (optionTextHasAddOn(`${title} ${description}`) && !optionTextHasAddOn(advisoryBase)) {
      return normalizeTreeServiceText(`${advisoryBase} and ${optionTextHasAddOn(description) ? description : title}`);
    }
    return advisoryBase;
  }
  return bestParsedTitle;
}

function optionDescriptionAddsDetail(option = {}, advisoryText = "") {
  const title = normalizeDisplayText(optionDisplayTitle(option, advisoryText));
  const description = normalizeDisplayText(option.description || "");
  return Boolean(description && description !== title);
}

function optionNeedsDescriptionReview(option = {}) {
  return Boolean(option.review_flags?.scope_unclear || option.scope_unclear);
}

function optionNeedsPriceReview(option = {}) {
  return Boolean(!option.price?.display || option.price?.is_unclear);
}

function hasBlockingError(validation, pattern) {
  return (validation?.blocking_errors || []).some((error) => pattern.test(String(error || "")));
}

function InlineFieldEditor({
  label,
  value = "",
  placeholder = "",
  helper = "",
  helperPosition = "below",
  error = "",
  busy = false,
  fieldClassName = "",
  editorClassName = "td2-inline-editor-warning",
  multiline = false,
  type = "text",
  minWidthCh = null,
  onChange,
  onDraftChange,
}) {
  const [draft, setDraft] = useState(value || "");

  useEffect(() => {
    setDraft(value || "");
  }, [value]);

  function applyChange(rawValue = draft) {
    const nextValue = String(rawValue || "").trim();
    if (nextValue && nextValue !== String(value || "").trim()) {
      onChange?.(nextValue);
    }
  }

  const widthText = String(draft || placeholder || "");
  const dynamicWidthStyle = minWidthCh
    ? { width: `${Math.max(minWidthCh, widthText.length + 2)}ch` }
    : undefined;

  const commonProps = {
    className: `td2-inline-editor ${editorClassName}`.trim(),
    disabled: busy,
    onBlur: (event) => applyChange(event.currentTarget.value),
    onChange: (event) => {
      setDraft(event.target.value);
      onDraftChange?.(event.target.value);
    },
    onKeyDown: (event) => {
      if (!multiline && event.key === "Enter") {
        event.preventDefault();
        applyChange(event.currentTarget.value);
      }
    },
    placeholder,
    spellCheck: "true",
    style: dynamicWidthStyle,
    value: draft,
  };

  return (
    <label className={`td2-inline-field ${fieldClassName}`.trim()}>
      {helper && helperPosition === "label" ? (
        <span className="td2-inline-label-row">
          <span>{label}</span>
          <span className="td2-inline-help">{helper}</span>
        </span>
      ) : (
        <span>{label}</span>
      )}
      {helper && helperPosition === "above" && <span className="td2-inline-help">{helper}</span>}
      {multiline ? (
        <textarea {...commonProps} rows={3} />
      ) : (
        <input {...commonProps} type={type} />
      )}
      {error && <span className="td2-inline-field-error">{error}</span>}
      {helper && !["above", "label"].includes(helperPosition) && <span className="td2-inline-help">{helper}</span>}
    </label>
  );
}

function CustomerSummaryField({
  label,
  field,
  value = "",
  placeholder = "",
  type = "text",
  busy = false,
  className = "",
  missing = false,
  overrideAccepted = false,
  overrideKey = "",
  overrideLabel = "",
  warnWhenMissing = true,
  reviewOverrides = {},
  onChange,
  onReviewOverridesChange,
}) {
  const [draftText, setDraftText] = useState(value || "");

  useEffect(() => {
    setDraftText(value || "");
  }, [value]);

  const draftMissing = !String(draftText || "").trim();
  const fieldMissing = missing || draftMissing;
  const fieldEditor = (
    <InlineFieldEditor
      label={label}
      value={value}
      placeholder={overrideAccepted ? "" : placeholder}
      type={type}
      minWidthCh={44}
      busy={busy}
      fieldClassName={`td2-customer-inline-field ${className}`.trim()}
      editorClassName={warnWhenMissing && fieldMissing && !overrideAccepted ? "td2-inline-editor-warning" : "td2-inline-editor-quiet"}
      onDraftChange={setDraftText}
      onChange={(nextValue) => onChange?.(field, nextValue)}
    />
  );

  if (!fieldMissing || !overrideKey) return fieldEditor;

  return (
    <div className="td2-customer-field-with-override">
      {fieldEditor}
      <CustomerOverrideCheckbox
        overrideKey={overrideKey}
        label={overrideLabel}
        overrides={reviewOverrides}
        onChange={onReviewOverridesChange}
      />
    </div>
  );
}

function CustomerPhoneSummaryField({
  value = "",
  needsPhone = false,
  phoneOverrideAccepted = false,
  contactOverrideStatus = null,
  reviewOverrides = {},
  busy = false,
  onChange,
  onReviewOverridesChange,
}) {
  const [phoneWarning, setPhoneWarning] = useState("");
  const [draftPhoneText, setDraftPhoneText] = useState(value || "");
  const [draftPhoneIsValid, setDraftPhoneIsValid] = useState(phoneDigitCount(value) === REQUIRED_PHONE_DIGITS);

  useEffect(() => {
    const hasPhoneText = Boolean(String(value || "").trim());
    const isValidPhone = phoneDigitCount(value) === REQUIRED_PHONE_DIGITS;
    setDraftPhoneText(value || "");
    setDraftPhoneIsValid(isValidPhone);
    setPhoneWarning(!phoneOverrideAccepted && hasPhoneText && !isValidPhone ? PHONE_DIGIT_WARNING : "");
  }, [needsPhone, phoneOverrideAccepted, value]);

  function handlePhoneChange(nextValue) {
    const hasPhoneText = Boolean(String(nextValue || "").trim());
    if (!hasPhoneText) {
      setPhoneWarning("");
      return;
    }
    if (phoneDigitCount(nextValue) !== REQUIRED_PHONE_DIGITS) {
      if (phoneOverrideAccepted) {
        setPhoneWarning("");
        return;
      }
      setPhoneWarning(PHONE_DIGIT_WARNING);
      return;
    }
    setPhoneWarning("");
    setDraftPhoneIsValid(true);
    onChange?.("phone", nextValue);
  }

  function handlePhoneDraftChange(nextValue) {
    setDraftPhoneText(nextValue);
    const nextDigits = phoneDigits(nextValue);
    const currentDigits = phoneDigits(value);
    const hasPhoneText = Boolean(String(nextValue || "").trim());
    const isValid = nextDigits.length === REQUIRED_PHONE_DIGITS;
    setDraftPhoneIsValid(isValid);
    if (phoneOverrideAccepted) {
      setPhoneWarning("");
      return;
    }
    if (!hasPhoneText) {
      setPhoneWarning("");
      if (currentDigits.length === REQUIRED_PHONE_DIGITS) {
        onChange?.("phone", "");
      }
      return;
    }
    setPhoneWarning(isValid ? "" : PHONE_DIGIT_WARNING);
    if (!isValid && currentDigits.length === REQUIRED_PHONE_DIGITS) {
      onChange?.("phone", "");
      return;
    }
    if (isValid && nextDigits !== currentDigits) {
      onChange?.("phone", nextValue);
    }
  }

  const phoneNeedsAttention = !String(draftPhoneText || "").trim() || !draftPhoneIsValid;
  const showPhoneOverride = phoneNeedsAttention && contactOverrideStatus;
  const phoneField = (
    <InlineFieldEditor
      label="Phone"
      value={value}
      placeholder={phoneOverrideAccepted ? "" : phoneNeedsAttention ? "Phone number needed to SMS Estimate to Customer" : "Phone not available"}
      type="tel"
      minWidthCh={44}
      error={phoneOverrideAccepted ? "" : phoneWarning}
      fieldClassName={`td2-customer-inline-field ${value ? "customer-phone-line customer-phone-available" : "customer-phone-line"}`}
      editorClassName={!phoneOverrideAccepted && phoneNeedsAttention ? "td2-inline-editor-warning" : "td2-inline-editor-quiet"}
      busy={busy}
      onDraftChange={handlePhoneDraftChange}
      onChange={handlePhoneChange}
    />
  );

  if (!showPhoneOverride) return phoneField;

  return (
    <div className="td2-customer-field-with-override">
      {phoneField}
      <ContactOverrideCheckbox
        status={contactOverrideStatus}
        overrides={reviewOverrides}
        onChange={onReviewOverridesChange}
      />
    </div>
  );
}

function RequiredInfoEditor({
  alphaJson,
  validation,
  addressOverrideStatus = null,
  contactOverrideStatus = null,
  showPhoneEditor = true,
  reviewOverrides,
  busy = false,
  onCustomerFieldChange,
  onJobDescriptionChange,
  onReviewOverridesChange,
}) {
  const [phoneWarning, setPhoneWarning] = useState("");
  const customer = alphaJson.customer || {};
  const job = alphaJson.job || {};
  const phone = customer.phone_display || customer.phone_primary || "";
  const serviceAddress = job.service_address?.display || "";
  const jobDescription = job.description || "";
  const needsAddress = hasBlockingError(validation, /Missing service address|Service address looks unclear/i);
  const needsPhone = showPhoneEditor && hasBlockingError(validation, /Missing customer phone or email/i) && !phone;
  const phoneOverrideAccepted = Boolean(reviewOverrides?.missingPhone || reviewOverrides?.missingContact);
  const needsJobDescription = hasBlockingError(validation, /Missing job description/i);

  useEffect(() => {
    if (!needsPhone || phoneOverrideAccepted) setPhoneWarning("");
  }, [needsPhone, phoneOverrideAccepted]);

  if (!needsAddress && !needsPhone && !needsJobDescription) return null;

  function handlePhoneChange(value) {
    if (phoneDigitCount(value) !== REQUIRED_PHONE_DIGITS) {
      if (phoneOverrideAccepted) {
        setPhoneWarning("");
        return;
      }
      setPhoneWarning(PHONE_DIGIT_WARNING);
      return;
    }
    setPhoneWarning("");
    onCustomerFieldChange?.("phone", value);
  }

  function handlePhoneDraftChange(value) {
    if (phoneOverrideAccepted) {
      setPhoneWarning("");
      return;
    }
    if (!String(value || "").trim()) {
      setPhoneWarning("");
      return;
    }
    setPhoneWarning(phoneDigitCount(value) === REQUIRED_PHONE_DIGITS ? "" : PHONE_DIGIT_WARNING);
  }

  return (
    <section className="summary-card td2-required-info-card">
      <h3>Fill In Required Info</h3>
      <div className="td2-inline-field-grid">
        {needsPhone && (
          <div className="td2-required-field-with-override td2-phone-required-row">
            <InlineFieldEditor
              label="Customer phone"
              value={phone}
              placeholder="Enter area code & phone #"
              helper="Phone number is needed to SMS Estimate to Customer"
              helperPosition="label"
              error={phoneOverrideAccepted ? "" : phoneWarning}
              fieldClassName="td2-phone-inline-field"
              busy={busy}
              onDraftChange={handlePhoneDraftChange}
              onChange={handlePhoneChange}
            />
            {contactOverrideStatus && (
              <ContactOverrideCheckbox
                status={contactOverrideStatus}
                overrides={reviewOverrides}
                onChange={onReviewOverridesChange}
              />
            )}
          </div>
        )}
        {needsAddress && (
          <div className="td2-required-field-with-override td2-address-required-row">
            <InlineFieldEditor
              label="Service address"
              value={serviceAddress}
              placeholder="Enter Service Address or override-->"
              busy={busy}
              onChange={(value) => onCustomerFieldChange?.("address", value)}
            />
            {addressOverrideStatus && (
              <AddressOverrideCheckbox
                status={addressOverrideStatus}
                overrides={reviewOverrides}
                onChange={onReviewOverridesChange}
              />
            )}
          </div>
        )}
        {needsJobDescription && (
          <InlineFieldEditor
            label="Job description"
            value={jobDescription}
            placeholder="Remove one oak tree near driveway"
            busy={busy}
            multiline
            onChange={onJobDescriptionChange}
          />
        )}
      </div>
    </section>
  );
}

function OptionDescriptionEditor({ option, index, busy = false, onChange }) {
  const [value, setValue] = useState(option.description || "");

  useEffect(() => {
    setValue(option.description || "");
  }, [option.description]);

  function applyChange() {
    const nextValue = value.trim();
    if (nextValue && nextValue !== (option.description || "").trim()) {
      onChange?.(index, nextValue);
    }
  }

  return (
    <textarea
      aria-label={`${option.label || `Option ${index + 1}`} description`}
      className="option-description-editor option-description-editor-warning"
      disabled={busy}
      onBlur={applyChange}
      onChange={(event) => setValue(event.target.value)}
      spellCheck="true"
      value={value}
    />
  );
}

function OptionPriceEditor({ option, index, busy = false, onChange }) {
  const [value, setValue] = useState(option.price?.display || "");
  const initialPrice = option.price?.initial_display || "";
  const priceEditedByTd = Boolean(option.price?.edited_by_td || (initialPrice && initialPrice !== option.price?.display));

  useEffect(() => {
    setValue(option.price?.display || "");
  }, [option.price?.display]);

  function applyChange() {
    const nextValue = value.trim();
    if (nextValue && nextValue !== String(option.price?.display || "").trim()) {
      onChange?.(index, nextValue);
    }
  }

  return (
    <label className="option-price-editor">
      <span className="option-price-control">
        <span className={`option-price-label${priceEditedByTd ? " option-price-label-changed" : ""}`}>Price</span>
        <input
          aria-label={`${option.label || `Option ${index + 1}`} price`}
          className={`td2-inline-editor option-price-input${optionNeedsPriceReview(option) ? " td2-inline-editor-warning" : ""}`}
          disabled={busy}
          onBlur={applyChange}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applyChange();
            }
          }}
          placeholder="$1,500"
          value={value}
        />
      </span>
      {priceEditedByTd && <span className="option-price-change-note">Price was changed or added</span>}
    </label>
  );
}

function MissingOptionEditor({ jobNotes = "", busy = false, onApply }) {
  const initialDescription = /No job notes supplied/i.test(jobNotes) ? "" : jobNotes;
  const [description, setDescription] = useState(initialDescription);
  const [price, setPrice] = useState("");

  useEffect(() => {
    setDescription(initialDescription);
  }, [initialDescription]);

  function applyOption() {
    if (!description.trim() || !price.trim()) return;
    onApply?.({ description: description.trim(), price: price.trim() });
  }

  return (
    <article className="quote-option-card quote-option-card-warning missing-option-card">
      <div className="quote-option-header">
        <strong>Option A</strong>
        <span>Price missing</span>
      </div>
      <label className="td2-inline-field">
        <span>Option details</span>
        <textarea
          className="td2-inline-editor td2-inline-editor-warning"
          disabled={busy}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Remove tree and leave wood"
          rows={3}
          spellCheck="true"
          value={description}
        />
      </label>
      <label className="td2-inline-field">
        <span>Price</span>
        <input
          className="td2-inline-editor td2-inline-editor-warning"
          disabled={busy}
          onChange={(event) => setPrice(event.target.value)}
          placeholder="$1,500"
          value={price}
        />
      </label>
      <button className="btn-orange override-ack-button" type="button" disabled={busy || !description.trim() || !price.trim()} onClick={applyOption}>
        Add option
      </button>
    </article>
  );
}

export default function JsonReview({
  alphaJson,
  validation,
  debugPipeline = null,
  sourceNotes = "",
  intake = {},
  mode = "review",
  reviewOverrides = {},
  onReviewOverridesChange,
  onTreeCountOverrideChange,
  onOptionDescriptionChange,
  onOptionPriceChange,
  onAddOption,
  onCustomerFieldChange,
  onJobDescriptionChange,
  onApprove,
  onEdit,
  busy = false,
}) {
  if (!alphaJson) return null;

  const normalizedOverrides = normalizeReviewOverrides(reviewOverrides);
  const options = alphaJson.service_options?.items || [];
  const structuredJobSummary = buildCustomerJobSummary(alphaJson);
  const jobNotes = structuredJobSummary || cleanJobNotesForReview(sourceNotes, alphaJson);
  const customerNameValue = alphaJson.customer?.name || "";
  const customerName = customerNameValue || "Name not available";
  const customerPhoneValue = alphaJson.customer?.phone_display || alphaJson.customer?.phone_primary || "";
  const customerPhone = customerPhoneValue || "Phone not available";
  const customerPhoneAvailable = Boolean(String(customerPhoneValue).trim());
  const customerEmailValue = alphaJson.customer?.email || "";
  const customerEmail = customerEmailValue || "Email not available";
  const rawJobAddress = alphaJson.job?.service_address?.display || normalizeServiceAddress(intake.address) || "";
  const jobAddress = rawJobAddress ? normalizeEditedServiceAddress(rawJobAddress) || rawJobAddress : "Address missing";
  const customerAddressValue = rawJobAddress ? normalizeEditedServiceAddress(rawJobAddress) || rawJobAddress : "";
  const customerAddressLines = splitServiceAddressDisplay(jobAddress);
  const overrideStatus = getBlockingOverrideStatus(validation, normalizedOverrides, alphaJson);
  const phoneOverrideAccepted = Boolean(normalizedOverrides.missingPhone || normalizedOverrides.missingContact);
  const customerPhoneRequired = !customerPhoneAvailable && !phoneOverrideAccepted;
  const canConfirmWithOverrides = overrideStatus.canProceed && !customerPhoneRequired;
  const needsOverrideAck = overrideStatus.needsAddressOverride
    || overrideStatus.needsContactOverride
    || overrideStatus.needsPhoneOverride
    || overrideStatus.needsEmailOverride
    || overrideStatus.needsScopeOverride;
  const isFinalConfirm = mode === "confirm";
  const reviewIssueSource = validation?.follow_ups?.length
    ? validation.follow_ups
    : validation?.blocking_errors || [];
  const reviewIssues = reviewIssueSource.filter((issue) => !isReviewOverrideIssue(issue, overrideStatus));
  const treeCountOverride = alphaJson.normalization?.field_evidence?.tree_count_override || "";
  const showTreeCountOverride = treeCountOverride && treeCountOverride !== "Auto";
  const title = isFinalConfirm ? "Confirm Estimate" : "NEW ESTIMATE";
  const optionNote = isFinalConfirm
    ? `Do not choose an option here. ${customerName === "Name not available" ? "The customer" : customerName} will choose one when opening the estimate.`
    : "Review these options. The customer chooses one later.";
  const approveLabel = isFinalConfirm ? (busy ? "Confirming..." : "Confirm Estimate") : "Confirm Estimate";
  const editLabel = isFinalConfirm ? "Back" : "Edit Info";
  const warningItems = (validation?.warnings || []).filter((warning) => !isOverrideRelatedWarning(warning, overrideStatus));
  const needsInlinePhoneEditor = !customerPhoneAvailable;
  const needsInlineAddressEditor = hasBlockingError(validation, /Missing service address|Service address looks unclear/i);
  const fallbackPhoneOverrideStatus = {
    ...overrideStatus,
    needsAddressOverride: false,
    needsContactOverride: false,
    needsPhoneOverride: true,
    needsEmailOverride: false,
    needsScopeOverride: false,
    contactWarning: { key: "missingPhone" },
  };
  const customerPhoneOverrideStatus = inlineContactOverrideStatus(overrideStatus)
    || inlineMissingPhoneOverrideStatus(overrideStatus)
    || fallbackPhoneOverrideStatus;
  const contactOverrideStatus = needsInlinePhoneEditor ? customerPhoneOverrideStatus : null;
  const addressOverrideStatus = needsInlineAddressEditor ? inlineAddressOverrideStatus(overrideStatus) : null;
  const lowerOverrideStatus = (contactOverrideStatus || addressOverrideStatus)
    ? withoutInlineOverrideStatus(overrideStatus, {
        contact: Boolean(contactOverrideStatus),
        address: Boolean(addressOverrideStatus),
      })
    : overrideStatus;
  const hasRequiredInlineFixes = !isFinalConfirm && (
    hasBlockingError(validation, /Missing service address|Service address looks unclear|Missing customer phone or email|Missing job description/i) ||
    options.some(optionNeedsPriceReview) ||
    (options.length < 1 && hasBlockingError(validation, /Missing priced service option/i))
  );
  const renderedFields = {
    customerCard: {
      name: { value: customerName, source: "alphaJson.customer.name" },
      phone: { value: customerPhone, source: "alphaJson.customer.phone_display" },
      email: { value: customerEmail, source: "alphaJson.customer.email" },
      serviceAddress: { value: jobAddress, source: "alphaJson.job.service_address.display" },
    },
    jobSummary: { value: jobNotes, source: "buildCustomerJobSummary(alphaJson)" },
    quoteOptions: options.map((option, index) => ({
      label: option.label || `Option ${index + 1}`,
      price: option.price?.display || "Price missing",
      title: formatOptionDisplayText(optionDisplayTitle(option, jobNotes)),
      description: optionDescriptionAddsDetail(option, jobNotes) ? formatOptionDisplayText(option.description) : "",
      source: `service_options.items[${index}]`,
    })),
    needsMoreInfo: {
      value: [...(validation?.follow_ups || []), ...(validation?.blocking_errors || [])].join("; "),
      source: "validation.follow_ups + validation.blocking_errors",
    },
  };

  return (
    <section className="card">
      <h2>{title}</h2>
      {!isFinalConfirm && (
        <span className={`review-status review-status-action-font ${canConfirmWithOverrides ? "review-status-ready" : "review-status-needs-info"}`}>
          {canConfirmWithOverrides ? "Estimate Can Be Confirmed Below" : "More info is needed to complete Estimate"}
        </span>
      )}
      {isFinalConfirm ? (
        <div className="summary-card final-summary-card">
          <h3>Summary</h3>
          <p><strong>{customerName}</strong></p>
          <p>{jobAddress}</p>
          <p>{jobNotes}</p>
        </div>
      ) : (
        <div className="review-grid">
          <div className="summary-card customer-summary-card">
            <h3>Customer</h3>
            <div className="customer-info-grid">
              <CustomerSummaryField
                label="Name"
                field="name"
                value={customerNameValue}
                placeholder="Name not available"
                className="customer-name-line"
                missing={!customerNameValue}
                overrideAccepted={Boolean(normalizedOverrides?.missingName)}
                overrideKey="missingName"
                overrideLabel="Create Estimate without customer name"
                reviewOverrides={normalizedOverrides}
                busy={busy}
                onChange={onCustomerFieldChange}
                onReviewOverridesChange={onReviewOverridesChange}
              />
              <CustomerSummaryField
                label="Address"
                field="address"
                value={customerAddressValue}
                placeholder="Address missing"
                className="customer-address-line"
                missing={!customerAddressValue}
                overrideAccepted={Boolean(normalizedOverrides?.missingAddress)}
                overrideKey="missingAddress"
                overrideLabel="Create Estimate without exact address"
                reviewOverrides={normalizedOverrides}
                busy={busy}
                onChange={onCustomerFieldChange}
                onReviewOverridesChange={onReviewOverridesChange}
              />
              <CustomerSummaryField
                label="Email"
                field="email"
                value={customerEmailValue}
                placeholder="E-mail needed to email Estimate to customer"
                type="email"
                className="customer-email-line"
                warnWhenMissing={false}
                busy={busy}
                onChange={onCustomerFieldChange}
              />
              <CustomerPhoneSummaryField
                value={customerPhoneValue}
                needsPhone={needsInlinePhoneEditor}
                phoneOverrideAccepted={Boolean(normalizedOverrides?.missingPhone || normalizedOverrides?.missingContact)}
                contactOverrideStatus={customerPhoneOverrideStatus}
                reviewOverrides={normalizedOverrides}
                busy={busy}
                onChange={onCustomerFieldChange}
                onReviewOverridesChange={onReviewOverridesChange}
              />
            </div>
          </div>
          <div className="summary-card review-job-notes-card">
            <h3>Job Notes</h3>
            <p className="job-summary-text">{jobNotes}</p>
            {showTreeCountOverride && (
              <ManualTreeCountOverrideControl
                treeCountOverride={treeCountOverride}
                busy={busy}
                onApply={onTreeCountOverrideChange}
              />
            )}
          </div>
        </div>
      )}
      {!isFinalConfirm && (
        <RequiredInfoEditor
          alphaJson={alphaJson}
          validation={validation}
          addressOverrideStatus={addressOverrideStatus}
          contactOverrideStatus={null}
          showPhoneEditor={false}
          reviewOverrides={normalizedOverrides}
          busy={busy}
          onCustomerFieldChange={onCustomerFieldChange}
          onJobDescriptionChange={onJobDescriptionChange}
          onReviewOverridesChange={onReviewOverridesChange}
        />
      )}
      <h3>Customer Options</h3>
      <div className="quote-options-grid">
        {options.length > 0 ? options.map((option, index) => (
          <article
            className={`quote-option-card${optionNeedsDescriptionReview(option) ? " quote-option-card-warning" : ""}`}
            key={optionRenderKey(option, index)}
          >
            <div className="quote-option-header">
              <strong>{option.label || `Option ${index + 1}`}</strong>
              {!isFinalConfirm && onOptionPriceChange ? (
                <OptionPriceEditor
                  busy={busy}
                  index={index}
                  option={option}
                  onChange={onOptionPriceChange}
                />
              ) : (
                <span>{option.price?.display || "Price missing"}</span>
              )}
            </div>
            <h4>{formatOptionDisplayText(optionDisplayTitle(option, jobNotes)) || "Option details"}</h4>
            {!isFinalConfirm && optionNeedsDescriptionReview(option) && onOptionDescriptionChange ? (
              <OptionDescriptionEditor
                busy={busy}
                index={index}
                option={option}
                onChange={onOptionDescriptionChange}
              />
            ) : optionDescriptionAddsDetail(option) ? (
              <p>{formatOptionDisplayText(option.description) || "Add the work details for this option before informing the customer."}</p>
            ) : null}
          </article>
        )) : (
          !isFinalConfirm && onAddOption ? (
            <MissingOptionEditor
              busy={busy}
              jobNotes={jobNotes}
              onApply={onAddOption}
            />
          ) : (
            <article className="quote-option-card missing-option-card">
              <div className="quote-option-header">
                <strong>Option 1</strong>
                <span>Price missing</span>
              </div>
              <h4>Option needed</h4>
              <p>Add at least one option and one price before informing the customer.</p>
            </article>
          )
        )}
      </div>
      <p className="text-muted review-option-note">{optionNote}</p>
      {!isFinalConfirm && (
        <DebugPipelinePanel
          debugPipeline={debugPipeline}
          alphaJson={alphaJson}
          validation={validation}
          renderedFields={renderedFields}
        />
      )}
      {!isFinalConfirm && (
        <OverrideWarningCard
          status={lowerOverrideStatus}
          overrides={normalizedOverrides}
          warningItems={warningItems}
          onChange={onReviewOverridesChange}
        />
      )}
      {!isFinalConfirm && (
        <TreeCountResolutionCard
          validation={validation}
          busy={busy}
          onApply={onTreeCountOverrideChange}
        />
      )}
      {reviewIssues.length > 0 && !hasRequiredInlineFixes && (
        <div className="summary-card needs-info-card">
          <h3>Needs More Info</h3>
          <ul>
            {reviewIssues.map((question) => <li key={question}>{question}</li>)}
          </ul>
        </div>
      )}
      {!canConfirmWithOverrides && (
        <p className="text-muted">
          {needsOverrideAck
            ? "Check the internal warning override or fix missing info before confirming estimate."
            : "Fix missing info before confirming estimate."}
        </p>
      )}
      <div className="toolbar td2-action-toolbar mt-2">
        <button className="btn-primary" onClick={onApprove} disabled={!canConfirmWithOverrides || busy}>
          {approveLabel}
        </button>
        <button className="btn-secondary" onClick={onEdit}>{editLabel}</button>
      </div>
    </section>
  );
}
