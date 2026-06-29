import { readJson, json } from "../../../lib/api.js";
import { notifyContractor } from "../../../lib/notifications.js";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await readJson(request);
  const alphaJson = body.alphaJson || {};
  const selected = (alphaJson.service_options?.items || []).find((option) => option.label === body.selectedOption);
  const estimateUrl = new URL(`/e/${encodeURIComponent(body.documentId || alphaJson.document?.number || "")}`, request.url).toString();
  const result = await notifyContractor({
    documentId: body.documentId || alphaJson.document?.number,
    customerName: alphaJson.customer?.name,
    address: alphaJson.job?.service_address?.display,
    selectedOption: body.selectedOption,
    price: selected?.price?.display,
    signedAtDisplay: body.signedAtDisplay,
    estimateUrl,
  });
  return json(result);
}
