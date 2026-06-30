import { readJson, json } from "../../../lib/api.js";
import { notifyContractor, notifyCustomerEstimate } from "../../../lib/notifications.js";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await readJson(request);
    const alphaJson = body.alphaJson || {};
    const documentId = body.documentId || alphaJson.document?.number || "";
    const estimateUrl = body.customerEstimateUrl
      ? new URL(body.customerEstimateUrl, request.url).toString()
      : new URL(`/e/${encodeURIComponent(documentId)}`, request.url).toString();

    if (body.recipient === "customer") {
      const result = await notifyCustomerEstimate({
        channel: body.channel,
        documentId,
        customerName: alphaJson.customer?.name,
        customerPhone: alphaJson.customer?.phone_display || alphaJson.customer?.phone_primary,
        customerEmail: alphaJson.customer?.email,
        estimateUrl,
      });
      return json(result);
    }

    const selected = (alphaJson.service_options?.items || []).find((option) => option.label === body.selectedOption);
    const result = await notifyContractor({
      documentId,
      customerName: alphaJson.customer?.name,
      address: alphaJson.job?.service_address?.display,
      selectedOption: body.selectedOption,
      price: selected?.price?.display,
      signedAtDisplay: body.signedAtDisplay,
      estimateUrl,
    });
    return json(result);
  } catch (error) {
    return json({ error: error.message || "Notification failed." }, { status: 400 });
  }
}
