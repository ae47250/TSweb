// Converts messy free-form input into a validated AlphaJSON v1.4 estimate.
// Step 3 + 4 of the workflow: OpenAI structuring -> server-side validation.
import { generateText, Output } from "ai"
import { extractionSchema } from "@/lib/alpha-json/schema"
import { assembleEstimate } from "@/lib/alpha-json/assemble"

export const maxDuration = 60

const SYSTEM = `You are a data-structuring engine for Alpha Tree Service, a tree-removal company in Southeastern Indiana.
Convert the owner's messy, voice-style job notes into structured estimate data.

Rules:
- Extract only what is present. Do NOT invent prices, addresses, or names. Use null for anything not stated.
- Preserve real values exactly (phone numbers, addresses, prices).
- For each priced service option, produce a short title, a clear description, and a price.
  - Format price displays compactly: "$2,000" for fixed, "$2,000–$3,000" for ranges (en dash, no spaces, no "to").
  - Set price.is_unclear = true and price_type = "unknown" if you cannot confidently determine a price.
- The job service_address is where the work happens; keep it separate from the customer's mailing address.
- Put customer-facing timing/payment/cleanup info in notes.display_notes.
- Put internal crew instructions (gate codes, dogs, parking, hazards) in notes.crew_visit_notes.
- List service options cheapest first.`

export async function POST(req: Request) {
  try {
    const { text } = await req.json()
    if (!text || typeof text !== "string" || text.trim().length < 5) {
      return Response.json({ error: "Please provide the job notes." }, { status: 400 })
    }

    const { output } = await generateText({
      model: "openai/gpt-5.4-mini",
      output: Output.object({ schema: extractionSchema }),
      system: SYSTEM,
      prompt: `Structure the following job notes into AlphaJSON estimate data:\n\n"""${text}"""`,
    })

    const estimate = assembleEstimate(output, text)
    return Response.json({ estimate })
  } catch (err) {
    console.error("[v0] /api/structure error:", err)
    return Response.json({ error: "Failed to structure the estimate. Please try again." }, { status: 500 })
  }
}
