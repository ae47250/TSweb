import { getEstimate } from "@/lib/store"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const estimate = await getEstimate(id)
  if (!estimate) {
    return Response.json({ error: "Estimate not found." }, { status: 404 })
  }
  return Response.json({ estimate })
}
