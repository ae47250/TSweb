"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { EstimateReview } from "@/components/estimate-review"
import type { AlphaEstimate } from "@/lib/alpha-json/types"
import { Check, Copy, Loader2, Sparkles, TreePine } from "lucide-react"

type Step = "input" | "review" | "sent"

const EXAMPLE = `Customer john smith 555-1234, mails to 123 main st anytown.
Job: 3 big oak trees at 805 2nd street, need em down asap, leaning toward house.
opt 1 just cut and haul $2000. opt 2 stump grind too 2800. opt 3 chip all debris 3200.
gate locked key under mat, dog in back yard.`

export default function BuilderPage() {
  const [step, setStep] = useState<Step>("input")
  const [text, setText] = useState("")
  const [estimate, setEstimate] = useState<AlphaEstimate | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signUrl, setSignUrl] = useState("")
  const [copied, setCopied] = useState(false)

  async function structure() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to structure estimate.")
      setEstimate(data.estimate)
      setStep("review")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  async function send() {
    if (!estimate) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send estimate.")
      setSignUrl(data.signUrl)
      setStep("sent")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setStep("input")
    setText("")
    setEstimate(null)
    setSignUrl("")
    setError(null)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(signUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="rounded-xl bg-primary p-6 text-primary-foreground">
        <div className="flex items-center gap-2">
          <TreePine className="size-6" />
          <h1 className="text-balance text-2xl font-semibold">Alpha Tree Service</h1>
        </div>
        <p className="mt-1 text-sm text-primary-foreground/80">
          Estimate Builder — turn rough notes into a professional, signable estimate.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border-l-4 border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {step === "input" && (
        <section className="flex flex-col gap-3">
          <label htmlFor="notes" className="text-sm font-semibold text-foreground">
            Paste the job notes
          </label>
          <textarea
            id="notes"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={9}
            placeholder="Customer name, phone, service address, the work needed, and each priced option..."
            className="w-full rounded-lg border border-input bg-card p-3 text-sm leading-relaxed text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
          <button
            type="button"
            onClick={() => setText(EXAMPLE)}
            className="self-start text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            Use example notes
          </button>
          <Button onClick={structure} disabled={loading || text.trim().length < 5} className="w-full">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {loading ? "Structuring..." : "Structure estimate"}
          </Button>
        </section>
      )}

      {step === "review" && estimate && (
        <section className="flex flex-col gap-4">
          <EstimateReview estimate={estimate} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" onClick={reset} className="sm:flex-1">
              Start over
            </Button>
            <Button onClick={send} disabled={loading || !estimate.validation.can_generate_pdf} className="sm:flex-1">
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              {loading ? "Creating link..." : "Approve & create signing link"}
            </Button>
          </div>
        </section>
      )}

      {step === "sent" && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 rounded-lg border-l-4 border-primary bg-accent p-4 text-sm font-medium text-accent-foreground">
            <Check className="size-4 text-primary" /> Signing link created. Send this to your customer.
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
            <input readOnly value={signUrl} className="w-full bg-transparent text-sm text-foreground outline-none" />
            <Button variant="secondary" size="sm" onClick={copyLink}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="secondary"
              className="sm:flex-1"
              render={
                <a href={signUrl} target="_blank" rel="noopener noreferrer">
                  Preview signing page
                </a>
              }
            />
            <Button onClick={reset} className="sm:flex-1">
              Build another
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            SMS/email delivery is stubbed until Pingram &amp; SendGrid keys are added — the link works now and the
            signed PDF is stored automatically on submission.
          </p>
        </section>
      )}
    </main>
  )
}
