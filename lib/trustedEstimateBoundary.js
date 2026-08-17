import { getEstimate } from "./estimateStore.js";
import { emitCustomerPipelineDelivery, resolveCustomerPipeline } from "./customerPipeline.js";
import {
  assertCustomerEstimateViewReady,
  customerDeliveryBindingErrors,
} from "./customerEstimateView.js";
import { customerAccessRequired } from "./customerAccess.js";
import { getBlockingOverrideStatus, normalizeReviewOverrides } from "./reviewOverrides.js";
import { normalizeReviewerDecisionLog } from "./reviewerDecisionLog.js";
import { productionConfigurationErrors } from "./productionReadiness.js";

function asString(value) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

/**
 * Load and revalidate the server-owned estimate used by signing and notification.
 * Client AlphaJSON is accepted only as an identifier hint, never as evidence.
 */
export async function loadTrustedEstimateBoundary(documentId = "", { env = process.env } = {}) {
  const configurationErrors = productionConfigurationErrors(env);
  if (configurationErrors.length) {
    return {
      ok: false,
      status: 503,
      error: "Production delivery configuration is incomplete.",
      blocking_errors: configurationErrors.map(({ code }) => code),
      configurationErrors,
    };
  }
  const id = asString(documentId);
  if (!id) {
    return { ok: false, status: 400, error: "Missing estimate ID." };
  }

  const record = await getEstimate(id);
  const storedAlphaJson = record?.alphaJson;
  if (!record || !storedAlphaJson?.document?.number) {
    return { ok: false, status: 404, error: "Estimate was not found." };
  }
  if (asString(record.documentId) !== id || asString(storedAlphaJson.document.number) !== id) {
    return { ok: false, status: 409, error: "Stored estimate ID does not match the requested estimate." };
  }
  if (customerAccessRequired(env) && !asString(record.customerAccessVersion)) {
    return {
      ok: false,
      status: 409,
      error: "The estimate is missing its customer access capability and must be regenerated before delivery.",
      blocking_errors: ["CUSTOMER_ACCESS_PROVENANCE_MISSING"],
    };
  }

  const rawInput = storedAlphaJson.raw_input?.customer_text || "";
  const decisionLog = storedAlphaJson.review?.reviewer_decision_log ||
    storedAlphaJson.normalization?.business_decisions?.reviewer_decision_log ||
    [];
  const readinessDecisions = storedAlphaJson.review?.readiness_decisions ||
    storedAlphaJson.normalization?.business_decisions?.readiness_decisions ||
    [];
  const pipeline = resolveCustomerPipeline({
    alphaJson: storedAlphaJson,
    customer_text: rawInput,
    decisionLog: [
      ...normalizeReviewerDecisionLog(decisionLog),
      ...(Array.isArray(readinessDecisions) ? readinessDecisions : []),
    ],
  }, { documentId: id, env });
  const validation = pipeline?.validation;
  if (!validation?.alphaJson) {
    return { ok: false, status: 400, error: "Stored estimate could not be revalidated." };
  }

  const approvedBinding = storedAlphaJson.review?.approved_customer_delivery_binding || null;
  const bindingErrors = customerDeliveryBindingErrors(validation.alphaJson, approvedBinding);
  const bindingRequired = pipeline.pipeline?.active_pipeline !== "legacy";
  if ((bindingRequired && !approvedBinding) || bindingErrors.length) {
    const blockingErrors = approvedBinding
      ? bindingErrors
      : ["CUSTOMER_DELIVERY_BINDING_MISSING"];
    await emitCustomerPipelineDelivery({
      documentId: id,
      policy: pipeline.policy,
      validation,
      parity: pipeline.parity,
      surface: "trusted_boundary",
      outcome: "binding_blocked",
      falseReadyEscape: true,
      env,
    });
    return {
      ok: false,
      status: 409,
      error: "The approved customer document no longer matches the trusted estimate and must be regenerated.",
      blocking_errors: blockingErrors,
    };
  }

  try {
    assertCustomerEstimateViewReady(pipeline.customerView);
  } catch (error) {
    return {
      ok: false,
      status: 409,
      error: error.message,
      blocking_errors: ["CUSTOMER_ESTIMATE_VIEW_NOT_READY"],
    };
  }

  const storedPipeline = record.pipeline || storedAlphaJson.validation?.customer_pipeline || null;
  const currentPipeline = pipeline.pipeline || null;
  const currentPipelineNeedsProvenance = currentPipeline?.active_pipeline !== "legacy";
  const storedPipelineProvenanceMissing = Boolean(
    currentPipelineNeedsProvenance && (
      !storedPipeline ||
      !asString(storedPipeline.version) ||
      !asString(storedPipeline.active_pipeline) ||
      !asString(storedPipeline.active_mode) ||
      !asString(storedPipeline.semantic_hash)
    ),
  );
  const storedPipelineModeChanged = Boolean(
    storedPipeline?.active_pipeline &&
      storedPipeline.active_pipeline !== currentPipeline?.active_pipeline,
  );
  const storedPipelineCohortChanged = Boolean(
    storedPipeline?.active_mode &&
      storedPipeline.active_mode !== currentPipeline?.active_mode,
  );
  const storedPipelineHashChanged = Boolean(
    storedPipeline?.semantic_hash &&
      currentPipeline?.semantic_hash &&
      storedPipeline.semantic_hash !== currentPipeline.semantic_hash,
  );
  const pipelineChanged = Boolean(
    storedPipelineProvenanceMissing ||
    storedPipelineModeChanged ||
    storedPipelineCohortChanged ||
    storedPipelineHashChanged ||
    (storedPipeline?.version && currentPipeline?.version && storedPipeline.version !== currentPipeline.version),
  );
  if (pipelineChanged) {
    await emitCustomerPipelineDelivery({
      documentId: id,
      policy: pipeline.policy,
      validation,
      parity: pipeline.parity,
      surface: "trusted_boundary",
      outcome: "rollback_blocked",
      falseReadyEscape: true,
      env,
    });
    return {
      ok: false,
      status: 409,
      error: "The estimate was produced by a different customer pipeline and must be regenerated before delivery.",
      blocking_errors: ["CUSTOMER_PIPELINE_REVALIDATION_REQUIRED"],
      pipeline: currentPipeline,
      policy: pipeline.policy,
      parity: pipeline.parity,
    };
  }

  const overrides = normalizeReviewOverrides(storedAlphaJson.review?.overrides);
  const overrideStatus = getBlockingOverrideStatus(validation, overrides, validation.alphaJson);
  if (!validation.can_generate_pdf && !overrideStatus.canProceed) {
    await emitCustomerPipelineDelivery({
      documentId: id,
      policy: pipeline.policy,
      validation,
      parity: pipeline.parity,
      surface: "trusted_boundary",
      outcome: "review_required",
      falseReadyEscape: ["approved", "signed", "accepted_manually"].includes(record.status),
      decisions: validation.alphaJson.review?.readiness_decisions || validation.alphaJson.review?.reviewer_decision_log || [],
    });
    return {
      ok: false,
      status: 409,
      error: "The stored estimate is no longer ready for customer-facing use.",
      blocking_errors: overrideStatus.remainingBlockingErrors.length
        ? overrideStatus.remainingBlockingErrors
        : validation.blocking_errors,
    };
  }

  return {
    ok: true,
    record,
    alphaJson: validation.alphaJson,
    validation,
    pipeline: pipeline.pipeline,
    policy: pipeline.policy,
    parity: pipeline.parity,
    customerView: pipeline.customerView,
  };
}
