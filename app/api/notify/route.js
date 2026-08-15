import { readJson, json } from "../../../lib/api.js";
import { emitCustomerPipelineDelivery } from "../../../lib/customerPipeline.js";
import { notifyContractor, notifyCustomerEstimate } from "../../../lib/notifications.js";
import { loadTrustedEstimateBoundary } from "../../../lib/trustedEstimateBoundary.js";
import { requireContractorSession } from "../../../lib/contractorAuth.js";
import { createCustomerAccessToken } from "../../../lib/customerAccess.js";
import { productionConfigurationErrors } from "../../../lib/productionReadiness.js";

export const runtime = "nodejs";

function currentCustomerEstimateUrl(request, documentId, record) {
  const url = new URL(`/e/${encodeURIComponent(documentId)}`, request.url);
  const token = createCustomerAccessToken(documentId, record.customerAccessVersion);
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

export async function POST(request) {
  try {
    const configurationErrors = productionConfigurationErrors();
    if (configurationErrors.length) {
      return json({ error: "Production delivery configuration is incomplete.", configurationErrors }, { status: 503 });
    }
    const auth = requireContractorSession(request, { csrf: true });
    if (!auth.ok) return auth.response;
    const body = await readJson(request);
    const documentId = body.documentId || body.alphaJson?.document?.number || "";
    const trusted = await loadTrustedEstimateBoundary(documentId);
    if (!trusted.ok) {
      return json({ error: trusted.error, blocking_errors: trusted.blocking_errors }, { status: trusted.status });
    }
    const { alphaJson, record } = trusted;
    const estimateUrl = currentCustomerEstimateUrl(request, documentId, record);

    if (body.recipient === "customer") {
      const result = await notifyCustomerEstimate({
        channel: body.channel,
        documentId,
        customerName: alphaJson.customer?.name,
        customerPhone: alphaJson.customer?.phone_display || alphaJson.customer?.phone_primary,
        customerEmail: alphaJson.customer?.email,
        estimateUrl,
      });
      await emitCustomerPipelineDelivery({
        documentId,
        policy: trusted.policy,
        validation: trusted.validation,
        parity: trusted.parity,
        surface: "customer_notification",
        decisions: alphaJson.review?.readiness_decisions || alphaJson.review?.reviewer_decision_log || [],
      });
      return json(result);
    }

    const selected = (alphaJson.service_options?.items || []).find((option) => option.label === body.selectedOption);
    if (!selected) {
      return json({ error: "Please select a valid option from the trusted estimate." }, { status: 400 });
    }
    const result = await notifyContractor({
      documentId,
      customerName: alphaJson.customer?.name,
      address: alphaJson.job?.service_address?.display,
      selectedOption: body.selectedOption,
      price: selected?.price?.display,
      signedAtDisplay: record.signedAtDisplay || record.acceptedAtDisplay || body.signedAtDisplay || "",
      estimateUrl,
    });
    await emitCustomerPipelineDelivery({
      documentId,
      policy: trusted.policy,
      validation: trusted.validation,
      parity: trusted.parity,
      surface: "contractor_notification",
      decisions: alphaJson.review?.readiness_decisions || alphaJson.review?.reviewer_decision_log || [],
    });
    return json(result);
  } catch (error) {
    return json({ error: error.message || "Notification failed." }, { status: 400 });
  }
}
