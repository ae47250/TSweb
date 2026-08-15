import { json } from "../../../lib/api.js";
import { listEstimates } from "../../../lib/estimateStore.js";
import { loadTrustedEstimateBoundary } from "../../../lib/trustedEstimateBoundary.js";
import { requireContractorSession } from "../../../lib/contractorAuth.js";
import { productionConfigurationErrors } from "../../../lib/productionReadiness.js";

export const runtime = "nodejs";

export async function GET(request) {
  const configurationErrors = productionConfigurationErrors();
  if (configurationErrors.length) {
    return json({ error: "Production delivery configuration is incomplete.", configurationErrors }, { status: 503 });
  }
  const auth = requireContractorSession(request);
  if (!auth.ok) return auth.response;
  const items = await listEstimates();
  const checked = await Promise.all(items.slice(0, 3).map(async (item) => {
    const trusted = await loadTrustedEstimateBoundary(item.documentId);
    if (trusted.ok) return item;
    return {
      ...item,
      status: "Review Required",
      customerEstimateUrl: "",
      signedDownloadUrl: "",
      savedDownloadUrl: "",
      reviewRequired: true,
    };
  }));
  return json({ items: checked });
}
