// Persists estimate records as JSON in Vercel Blob (public store).
// Each estimate lives at estimates/<id>.json; signed PDFs at signed/<id>-<filename>.pdf.
import { put, list } from "@vercel/blob"
import type { AlphaEstimate } from "./alpha-json/types"

const ESTIMATE_PREFIX = "estimates/"

function keyFor(id: string) {
  return `${ESTIMATE_PREFIX}${id}.json`
}

export async function saveEstimate(estimate: AlphaEstimate): Promise<void> {
  await put(keyFor(estimate.id), JSON.stringify(estimate), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  })
}

export async function getEstimate(id: string): Promise<AlphaEstimate | null> {
  // Find the blob for this id, then fetch its JSON contents.
  const { blobs } = await list({ prefix: keyFor(id) })
  const match = blobs.find((b) => b.pathname === keyFor(id))
  if (!match) return null
  const res = await fetch(match.url, { cache: "no-store" })
  if (!res.ok) return null
  return (await res.json()) as AlphaEstimate
}

export async function saveSignedPdf(id: string, filename: string, bytes: Uint8Array): Promise<string> {
  const blob = await put(`signed/${id}-${filename}.pdf`, Buffer.from(bytes), {
    access: "public",
    contentType: "application/pdf",
    addRandomSuffix: true,
  })
  return blob.url
}
