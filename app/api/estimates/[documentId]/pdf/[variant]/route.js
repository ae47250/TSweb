import { json } from "../../../../../../lib/api.js";
import { emitCustomerPipelineDelivery } from "../../../../../../lib/customerPipeline.js";
import { loadTrustedEstimateBoundary } from "../../../../../../lib/trustedEstimateBoundary.js";
import { requireContractorSession } from "../../../../../../lib/contractorAuth.js";
import {
  customerAccessTokenFromRequest,
  verifyCustomerAccessToken,
} from "../../../../../../lib/customerAccess.js";
import { isStrictDeliveryStage, productionConfigurationErrors } from "../../../../../../lib/productionReadiness.js";

export const runtime = "nodejs";

function requestedFile(record, variant) {
  if (variant === "signed") return record?.status === "signed" ? record?.signed?.full || null : null;
  if (variant === "accepted") return record?.status === "accepted_manually" ? record?.accepted?.full || null : null;
  if (variant === "mobile") {
    if (record?.status === "accepted_manually") return record?.accepted?.mobile || null;
    if (record?.status === "signed") return record?.signed?.mobile || null;
    return record?.documents?.mobile || null;
  }
  if (variant === "tree-dude") return record?.documents?.treeDude || record?.documents?.["tree-dude"] || null;
  if (variant === "full") return record?.documents?.full || null;
  return null;
}

function normalizeVariant(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "tree_dude") return "tree-dude";
  return new Set(["full", "mobile", "signed", "accepted", "tree-dude"]).has(normalized)
    ? normalized
    : "";
}

function decodeRouteValue(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return "";
  }
}

function safeFilename(documentId, variant, extension) {
  const safeId = documentId.replace(/[^a-zA-Z0-9._-]/g, "_") || "estimate";
  return `${safeId}-${variant}.${extension}`;
}

export async function GET(request, { params }) {
  const configurationErrors = productionConfigurationErrors();
  if (configurationErrors.length) {
    return json({ error: "Production delivery configuration is incomplete.", configurationErrors }, { status: 503 });
  }
  const { documentId, variant } = await params;
  const id = decodeRouteValue(documentId);
  const normalizedVariant = normalizeVariant(decodeRouteValue(variant));
  if (!id || !normalizedVariant) {
    return json({ error: "The requested estimate document variant is invalid." }, { status: 400 });
  }
  const trusted = await loadTrustedEstimateBoundary(id);
  if (!trusted.ok) {
    return json({
      error: "Review required before serving the stored customer document.",
      blocking_errors: trusted.blocking_errors || [],
      reviewRequired: true,
    }, { status: trusted.status || 409 });
  }

  const contractorAuth = requireContractorSession(request);
  const customerAuthorized = normalizedVariant !== "tree-dude" &&
    verifyCustomerAccessToken(
      customerAccessTokenFromRequest(request),
      id,
      trusted.record.customerAccessVersion,
    );
  if (!contractorAuth.ok && !customerAuthorized) {
    return json({ error: "Authentication or a valid customer link is required." }, { status: 401 });
  }

  const file = requestedFile(trusted.record, normalizedVariant);
  if (!file) return json({ error: "Stored document not found." }, { status: 404 });

  if (isStrictDeliveryStage() && (file.format !== "pdf" || !file.pdfBase64)) {
    return json({ error: "The stored PDF is unavailable and must be regenerated." }, { status: 503 });
  }

  await emitCustomerPipelineDelivery({
    documentId: id,
    policy: trusted.policy,
    validation: trusted.validation,
    parity: trusted.parity,
    surface: "stored_document_download",
    decisions: trusted.alphaJson.review?.readiness_decisions || trusted.alphaJson.review?.reviewer_decision_log || [],
  });

  if (file.pdfBase64) {
    return new Response(Buffer.from(file.pdfBase64, "base64"), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFilename(id, normalizedVariant, "pdf")}"`,
        "Cache-Control": "no-store",
      },
    });
  }
  if (file.html) {
    return new Response(file.html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFilename(id, normalizedVariant, "html")}"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return json({ error: "Stored document content is unavailable." }, { status: 404 });
}
