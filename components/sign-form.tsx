"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { AlphaEstimate, OptionLabel } from "@/lib/alpha-json/types"
import { SIGNATURE_MIN_LENGTH } from "@/lib/constants"
import { Check, Download, Loader2, TreePine } from "lucide-react"

export function SignForm({ estimate }: { estimate: AlphaEstimate }) {
  const alreadySigned = estimate.status === "signed" && estimate.signing?.signed_pdf_url
  const [selected, setSelected] = useState<OptionLabel | null>(
    (estimate.signing?.selected_option_label as OptionLabel) ?? null,
  )
  const [name, setName] = useState(estimate.signing?.signature_name ?? "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(estimate.signing?.signed_pdf_url ?? null)

  const signatureValid = name.trim().length >= SIGNATURE_MIN_LENGTH
  const canSubmit = selected !== null && signatureValid && !loading

  async function submit() {
    if (!selected) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: estimate.id, selectedOptionLabel: selected, signatureName: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to submit.")
      setSignedUrl(data.signedPdfUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  if (signedUrl) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 rounded-lg border-l-4 border-primary bg-accent p-4 text-sm font-medium text-accent-foreground">
          <Check className="size-4 text-primary" />
          {alreadySigned && !loading ? "This estimate was already signed." : "Thank you — your estimate is signed."}
        </div>
        <p className="text-sm text-muted-foreground">
          {estimate.company.owner_name} will call you to confirm and schedule the work. A copy of your signed estimate
          is below.
        </p>
        <Button
          className="w-full"
          render={
            <a href={signedUrl} target="_blank" rel="noopener noreferrer">
              <Download className="size-4" /> Download signed PDF
            </a>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">Choose your option</h2>
        <div className="mt-2 flex flex-col gap-2">
          {estimate.service_options.items.map((o) => {
            const isSel = o.label === selected
            return (
              <button
                key={o.label}
                type="button"
                onClick={() => setSelected(o.label)}
                aria-pressed={isSel}
                className={`flex items-start justify-between gap-3 rounded-lg border-2 p-3 text-left transition-colors ${
                  isSel ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                    {isSel && <Check className="size-4" />}
                    {o.label}: {o.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{o.description}</p>
                </div>
                <span className="whitespace-nowrap text-sm font-bold text-primary">{o.price.display}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <label htmlFor="sig" className="text-sm font-semibold text-foreground">
          Sign by typing your full name
        </label>
        <input
          id="sig"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="John Smith"
          className="mt-2 w-full rounded-md border border-input bg-background p-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
        {name.trim() && (
          <div className="mt-3 border-b border-foreground/40 pb-1">
            <span className="font-signature text-3xl leading-tight text-primary">{name}</span>
          </div>
        )}
        <p className="mt-3 border-l-2 border-chart-5 pl-3 text-xs leading-relaxed text-muted-foreground">
          By typing your name, you agree this constitutes your electronic signature and you authorize{" "}
          {estimate.company.name} to perform the selected work.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border-l-4 border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!signatureValid && name.trim().length > 0 && (
        <p className="text-xs text-destructive">Signature must be at least {SIGNATURE_MIN_LENGTH} characters.</p>
      )}

      <Button onClick={submit} disabled={!canSubmit} className="w-full">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <TreePine className="size-4" />}
        {loading ? "Submitting..." : "Submit signed estimate"}
      </Button>
      {!selected && <p className="text-center text-xs text-muted-foreground">Select an option to continue.</p>}
    </div>
  )
}
