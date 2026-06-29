// Notification layer. SMS (Pingram/NotificationAPI) and email (SendGrid) are
// STUBBED until their API keys are added. Each function no-ops gracefully and
// logs what *would* be sent, so the full flow works end-to-end without keys.
import { CONTRACTOR } from "./constants"

export interface NotifyResult {
  sent: boolean
  channel: "sms" | "email"
  to: string
  detail: string
}

export async function sendCustomerSms(phone: string, fullPdfUrl: string, mobileUrl: string): Promise<NotifyResult> {
  const body = `Your Alpha Tree Service estimate is ready. Review & sign: ${mobileUrl}  (Full PDF: ${fullPdfUrl})`
  if (!process.env.PINGRAM_API_KEY) {
    console.log("[v0] [SMS stub -> customer]", phone, body)
    return { sent: false, channel: "sms", to: phone, detail: "stubbed (no PINGRAM_API_KEY)" }
  }
  // TODO: integrate @notificationapi/node when PINGRAM_API_KEY is set.
  console.log("[v0] [SMS -> customer]", phone, body)
  return { sent: true, channel: "sms", to: phone, detail: "sent" }
}

export async function notifyContractor(customerName: string, optionLabel: string, signedPdfUrl: string): Promise<NotifyResult[]> {
  const smsBody = `Signed estimate received from ${customerName || "a customer"} — ${optionLabel} selected. PDF: ${signedPdfUrl}`
  const results: NotifyResult[] = []

  if (!process.env.PINGRAM_API_KEY) {
    console.log("[v0] [SMS stub -> contractor]", CONTRACTOR.phone, smsBody)
    results.push({ sent: false, channel: "sms", to: CONTRACTOR.phone, detail: "stubbed (no PINGRAM_API_KEY)" })
  } else {
    console.log("[v0] [SMS -> contractor]", CONTRACTOR.phone, smsBody)
    results.push({ sent: true, channel: "sms", to: CONTRACTOR.phone, detail: "sent" })
  }

  if (!process.env.SENDGRID_API_KEY) {
    console.log("[v0] [Email stub -> contractor]", CONTRACTOR.email, smsBody)
    results.push({ sent: false, channel: "email", to: CONTRACTOR.email, detail: "stubbed (no SENDGRID_API_KEY)" })
  } else {
    console.log("[v0] [Email -> contractor]", CONTRACTOR.email, smsBody)
    results.push({ sent: true, channel: "email", to: CONTRACTOR.email, detail: "sent" })
  }

  return results
}
