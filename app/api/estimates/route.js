import { json } from "../../../lib/api.js";
import { listEstimates } from "../../../lib/estimateStore.js";

export const runtime = "nodejs";

export async function GET() {
  const items = await listEstimates();
  return json({ items: items.slice(0, 3) });
}
