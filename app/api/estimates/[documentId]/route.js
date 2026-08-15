import { json } from "../../../../lib/api.js";
import { getEstimate } from "../../../../lib/estimateStore.js";
import { loadTrustedEstimateBoundary } from "../../../../lib/trustedEstimateBoundary.js";
import { requireContractorSession } from "../../../../lib/contractorAuth.js";
import { productionConfigurationErrors } from "../../../../lib/productionReadiness.js";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const configurationErrors = productionConfigurationErrors();
  if (configurationErrors.length) {
    return json({ error: "Production delivery configuration is incomplete.", configurationErrors }, { status: 503 });
  }
  const auth = requireContractorSession(request);
  if (!auth.ok) return auth.response;
  const { documentId } = await params;
  const id = decodeURIComponent(documentId);
  const record = await getEstimate(id);
  if (!record) return json({ error: "Estimate not found." }, { status: 404 });

  const trusted = await loadTrustedEstimateBoundary(id);
  if (trusted.ok) return json({ record: { ...record, alphaJson: trusted.alphaJson, validation: trusted.validation } });

  // Internal review may inspect a blocked estimate so it can be remediated, but
  // it must not receive customer-facing delivery artifacts from that record.
  const reviewRecord = { ...record };
  delete reviewRecord.documents;
  delete reviewRecord.signed;
  delete reviewRecord.accepted;
  delete reviewRecord.customerEstimateUrl;
  delete reviewRecord.customerAccessVersion;
  delete reviewRecord.pdf_url_full;
  delete reviewRecord.pdf_url_mobile;
  delete reviewRecord.pdf_url_signed;
  delete reviewRecord.pdf_url_accepted;
  delete reviewRecord.pdf_url_tree_dude;
  return json({
    record: reviewRecord,
    reviewRequired: true,
    blocking_errors: trusted.blocking_errors || [],
    error: trusted.error,
  });
}
