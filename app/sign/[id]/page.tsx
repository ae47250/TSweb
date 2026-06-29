import { notFound } from "next/navigation"
import { getEstimate } from "@/lib/store"
import { SignForm } from "@/components/sign-form"
import { MapPin, TreePine } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function SignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const estimate = await getEstimate(id)
  if (!estimate) notFound()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="rounded-xl bg-primary p-6 text-primary-foreground">
        <div className="flex items-center gap-2">
          <TreePine className="size-6" />
          <h1 className="text-balance text-2xl font-semibold">{estimate.company.name}</h1>
        </div>
        <p className="mt-1 text-sm text-primary-foreground/80">
          {estimate.document.title} • {estimate.document.number} • {estimate.document.date_display}
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-5">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
          <MapPin className="size-4" /> Service Address
        </p>
        <p className="mt-1 text-sm text-foreground">{estimate.job.service_address.display || "—"}</p>

        <p className="mt-4 text-xs font-semibold uppercase text-muted-foreground">Job</p>
        <p className="mt-1 text-sm leading-relaxed text-foreground">{estimate.job.description}</p>

        {estimate.notes.display_notes && (
          <>
            <p className="mt-4 text-xs font-semibold uppercase text-muted-foreground">Notes</p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">{estimate.notes.display_notes}</p>
          </>
        )}
      </section>

      <SignForm estimate={estimate} />

      <footer className="pb-4 text-center text-xs text-muted-foreground">
        {estimate.company.name} • {estimate.company.region} • {estimate.company.owner_phone}
      </footer>
    </main>
  )
}
