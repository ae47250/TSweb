// Customer submission: validate option + signature, generate the signed PDF,
// store it in Blob, notify the contractor, and persist the signed record.
import { getEstimate, saveEstimate, saveSignedPdf } from "@/lib/store"
import { renderEstimatePdf } from "@/lib/pdf/estimate-pdf"
import { notifyContractor } from "@/lib/notify"
import { SIGNATURE_MIN_LENGTH } from "@/lib/constants"
import type { OptionLabel } from "@/lib/alpha-json/types"

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { id, selectedOptionLabel, signatureName } = (await req.json()) as {
      id: string
      selectedOptionLabel: OptionLabel
      signatureName: string
    }

    const estimate = await getEstimate(id)
    if (!estimate) return Response.json({ error: "Estimate not found." }, { status: 404 })

    const name = (signatureName || "").trim()
    if (name.length < SIGNATURE_MIN_LENGTH) {
      return Response.json({ error: `Signature must be at least ${SIGNATURE_MIN_LENGTH} characters.` }, { status: 400 })
    }

    const option = estimate.service_options.items.find((o) => o.label === selectedOptionLabel)
    if (!option) return Response.json({ error: "Please select a valid option." }, { status: 400 })

    const now = new Date().toISOString()
    estimate.signing = {
      selected_option_label: selectedOptionLabel,
      signature_name: name,
      signature_date: now,
      signed_pdf_url: null,
    }
    estimate.status = "signed"
    estimate.updated_at = now

    const pdfBytes = await renderEstimatePdf(estimate)
    const url = await saveSignedPdf(id, estimate.document.output_filename_base, pdfBytes)
    estimate.signing.signed_pdf_url = url

    await saveEstimate(estimate)
    const notifications = await notifyContractor(estimate.customer.name, selectedOptionLabel, url)

    return Response.json({ signedPdfUrl: url, notifications })
  } catch (err) {
    console.error("[v0] /api/sign error:", err)
    return Response.json({ error: "Failed to submit signed estimate." }, { status: 500 })
  }
}
