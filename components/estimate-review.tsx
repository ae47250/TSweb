"use client"

import type { AlphaEstimate } from "@/lib/alpha-json/types"
import { AlertTriangle, CheckCircle2, MapPin, Phone, User } from "lucide-react"

export function EstimateReview({ estimate }: { estimate: AlphaEstimate }) {
  const v = estimate.validation
  const hasBlocking = v.blocking_errors.length > 0

  return (
    <div className="flex flex-col gap-4">
      {hasBlocking ? (
        <div className="rounded-lg border-l-4 border-destructive bg-destructive/10 p-4">
          <div className="flex items-center gap-2 font-semibold text-destructive">
            <AlertTriangle className="size-4" /> Needs attention before sending
          </div>
          <ul className="mt-2 list-disc pl-5 text-sm text-foreground">
            {v.blocking_errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          {v.tree_dude_follow_ups.length > 0 && (
            <div className="mt-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Follow-up questions:</span>
              <ul className="mt-1 list-disc pl-5">
                {v.tree_dude_follow_ups.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border-l-4 border-primary bg-accent p-4 text-sm font-medium text-accent-foreground">
          <CheckCircle2 className="size-4 text-primary" /> Estimate is valid and ready to send.
        </div>
      )}

      {v.warnings.map((w, i) => (
        <div key={i} className="rounded-lg border-l-4 border-chart-5 bg-secondary p-3 text-sm text-secondary-foreground">
          {w}
        </div>
      ))}

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field icon={<User className="size-4" />} label="Customer" value={estimate.customer.display_name || "—"} />
          <Field icon={<Phone className="size-4" />} label="Phone" value={estimate.customer.phone_display || "—"} />
          <Field
            icon={<MapPin className="size-4" />}
            label="Service Address"
            value={estimate.job.service_address.display || "—"}
            className="sm:col-span-2"
          />
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Job</p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">{estimate.job.description}</p>
          {estimate.job.condition_details && (
            <p className="mt-1 text-sm text-muted-foreground">{estimate.job.condition_details}</p>
          )}
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Service Options</p>
          <div className="mt-2 flex flex-col gap-2">
            {estimate.service_options.items.map((o) => (
              <div key={o.label} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                <div>
                  <p className="text-sm font-semibold text-primary">
                    {o.label}: {o.title}
                  </p>
                  <p className="text-sm text-muted-foreground">{o.description}</p>
                </div>
                <span className="whitespace-nowrap text-sm font-bold text-primary">{o.price.display}</span>
              </div>
            ))}
          </div>
        </div>

        {estimate.notes.display_notes && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Notes</p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">{estimate.notes.display_notes}</p>
          </div>
        )}

        {estimate.notes.crew_visit_notes && (
          <div className="mt-3 rounded-md bg-secondary p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Internal crew notes (not shown to customer)</p>
            <p className="mt-1 text-sm text-secondary-foreground">{estimate.notes.crew_visit_notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({
  icon,
  label,
  value,
  className = "",
}: {
  icon: React.ReactNode
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={className}>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  )
}
