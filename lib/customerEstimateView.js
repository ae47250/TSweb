import { createHash } from "node:crypto";
import { buildCustomerJobSummary } from "./normalizeAlphaJson.js";

export const CUSTOMER_ESTIMATE_VIEW_VERSION = "customer-estimate-view-v1";
export const CUSTOMER_DELIVERY_BINDING_VERSION = "customer-delivery-binding-v1";

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function stableHash(value) {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
}

export function buildCustomerEstimateView(alphaJson = {}) {
  const options = asArray(alphaJson.service_options?.items).map((option) => ({
    label: asString(option.label),
    title: asString(option.title),
    description: asString(option.description),
    priceDisplay: asString(option.price?.display),
  }));
  const facts = {
    documentNumber: asString(alphaJson.document?.number),
    documentDate: asString(alphaJson.document?.date_display),
    customerName: asString(alphaJson.customer?.name) || "Customer",
    customerPhone: asString(alphaJson.customer?.phone_display || alphaJson.customer?.phone_primary),
    serviceAddress: asString(alphaJson.job?.service_address?.display),
    treeCount: asString(alphaJson.job?.tree_details?.tree_count),
    optionPrices: options.map((option) => ({ label: option.label, priceDisplay: option.priceDisplay })),
  };
  const wording = {
    documentTitle: asString(alphaJson.document?.title),
    workDescription: asString(alphaJson.job?.description) || buildCustomerJobSummary(alphaJson),
    notes: asString(alphaJson.notes?.display_notes) || "No additional customer-visible notes.",
    options: options.map(({ label, title, description }) => ({ label, title, description })),
  };
  const trusted = Boolean(
    alphaJson.normalization?.fact_resolution_locked === true &&
      alphaJson.normalization?.customer_wording?.locked_after_facts === true,
  );

  return {
    version: CUSTOMER_ESTIMATE_VIEW_VERSION,
    trusted,
    document: {
      number: facts.documentNumber,
      title: wording.documentTitle,
      dateDisplay: facts.documentDate,
      semanticHash: asString(alphaJson.validation?.estimate_semantic_hash),
    },
    customer: {
      name: facts.customerName,
      phone: facts.customerPhone,
    },
    serviceAddress: facts.serviceAddress,
    treeCount: facts.treeCount,
    workDescription: wording.workDescription,
    notes: wording.notes,
    options,
    binding: {
      version: CUSTOMER_DELIVERY_BINDING_VERSION,
      factsHash: stableHash(facts),
      wordingHash: stableHash(wording),
      optionsHash: stableHash(options),
      semanticHash: asString(alphaJson.validation?.estimate_semantic_hash),
      resolutionPolicyVersion: asString(alphaJson.validation?.customer_pipeline?.version),
    },
  };
}

export function customerDeliveryBindingErrors(alphaJson = {}, approvedBinding = null) {
  if (!approvedBinding) return [];
  const current = buildCustomerEstimateView(alphaJson).binding;
  const fields = ["factsHash", "wordingHash", "optionsHash", "semanticHash", "resolutionPolicyVersion"];
  return fields
    .filter((field) => asString(approvedBinding[field]) !== asString(current[field]))
    .map((field) => `CUSTOMER_DELIVERY_BINDING_CHANGED:${field}`);
}

export function assertCustomerEstimateViewReady(view = {}) {
  if (view?.version !== CUSTOMER_ESTIMATE_VIEW_VERSION) {
    throw new Error("Customer estimate view is missing or has an unsupported version.");
  }
  if (!view.trusted) {
    throw new Error("Customer estimate facts and wording are not locked after trusted resolution.");
  }
  if (!view.document?.number || !view.serviceAddress || !view.options?.length) {
    throw new Error("Customer estimate view is missing required customer delivery facts.");
  }
  return view;
}
