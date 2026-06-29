// Create (persist) an approved estimate and return its shareable signing link.
import { saveEstimate } from "@/lib/store"
import { sendCustomerSms } from "@/lib/notify"
import type { AlphaEstimate } from "@/lib/alpha-json/types"

export async function POST(req: Request) {
  try {
    const { estimate } = (await req.json()) as { estimate: AlphaEstimate }
    if (!estimate?.id) {
      return Response.json({ error: "Missing estimate." }, { status: 400 })
    }
    if (!estimate.validation.can_generate_pdf) {
      return Response.json({ error: "Estimate has blocking errors and cannot be sent." }, { status: 400 })
    }

    const now = new Date().toISOString()
    estimate.status = "sent"
    estimate.updated_at = now
    await saveEstimate(estimate)

    const origin = new URL(req.url).origin
    const signUrl = `${origin}/sign/${estimate.id}`

    // Initial SMS to the customer (stubbed until PINGRAM_API_KEY is set).
    const sms = estimate.customer.phone_display
      ? await sendCustomerSms(estimate.customer.phone_display, signUrl, signUrl)
      : null

    return Response.json({ id: estimate.id, signUrl, sms })
  } catch (err) {
    console.error("[v0] /api/estimates error:", err)
    return Response.json({ error: "Failed to save estimate." }, { status: 500 })
  }
}
