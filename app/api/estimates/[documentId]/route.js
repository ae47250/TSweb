import { json } from "../../../../lib/api.js";
import { getEstimate } from "../../../../lib/estimateStore.js";

export const runtime = "nodejs";

export async function GET(_request, { params }) {
  const { documentId } = await params;
  const record = await getEstimate(decodeURIComponent(documentId));
  if (!record) return json({ error: "Estimate not found." }, { status: 404 });
  return json({ record });
}
