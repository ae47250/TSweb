// Server-side signed-estimate PDF using @react-pdf/renderer (no headless browser).
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer"
import type { AlphaEstimate } from "@/lib/alpha-json/types"

const GREEN = "#1f4229"
const GREEN_MID = "#3f7045"
const BORDER = "#dddddd"
const MUTED = "#666666"

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#222222", lineHeight: 1.4 },
  banner: { backgroundColor: GREEN, color: "#ffffff", padding: 14, borderRadius: 6, marginBottom: 14 },
  bannerTitle: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  bannerSub: { fontSize: 9, color: "#dCE7dC", marginTop: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  col: { flexDirection: "column", maxWidth: "48%" },
  label: { fontSize: 8, color: MUTED, textTransform: "uppercase", marginBottom: 2 },
  value: { fontSize: 10, marginBottom: 6 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: GREEN, marginTop: 8, marginBottom: 6 },
  optionCard: { borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 8, marginBottom: 6 },
  optionSelected: { borderWidth: 2, borderColor: GREEN_MID, backgroundColor: "#eef6ed" },
  optionHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  optionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: GREEN },
  optionPrice: { fontSize: 11, fontFamily: "Helvetica-Bold", color: GREEN },
  selectedBadge: { fontSize: 8, color: GREEN_MID, fontFamily: "Helvetica-Bold", marginTop: 2 },
  notes: { fontSize: 9, color: "#333333" },
  sigBlock: { marginTop: 16, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 12 },
  sigName: { fontFamily: "Times-Italic", fontSize: 24, color: GREEN, borderBottomWidth: 1, borderBottomColor: "#333333", paddingBottom: 4, marginBottom: 4 },
  disclaimer: { fontSize: 7.5, color: MUTED, marginTop: 8, borderLeftWidth: 2, borderLeftColor: "#f1ce55", paddingLeft: 6 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: MUTED, textAlign: "center", borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 6 },
})

function EstimateDoc({ e }: { e: AlphaEstimate }) {
  const selected = e.signing?.selected_option_label
  return (
    <Document title={`Estimate ${e.document.number}`} author={e.company.name}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>{e.company.name}</Text>
          <Text style={styles.bannerSub}>
            {e.company.region} • {e.company.owner_name} • {e.company.owner_phone}
          </Text>
        </View>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Document</Text>
            <Text style={styles.value}>
              {e.document.title} ({e.document.number})
            </Text>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{e.document.date_display}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Customer</Text>
            <Text style={styles.value}>{e.customer.display_name || "—"}</Text>
            {e.customer.phone_display ? (
              <>
                <Text style={styles.label}>Phone</Text>
                <Text style={styles.value}>{e.customer.phone_display}</Text>
              </>
            ) : null}
          </View>
        </View>

        <Text style={styles.label}>Service Address</Text>
        <Text style={styles.value}>{e.job.service_address.display || "—"}</Text>

        <Text style={styles.sectionTitle}>Job</Text>
        <Text style={styles.value}>{e.job.description}</Text>
        {e.job.condition_details ? <Text style={styles.notes}>{e.job.condition_details}</Text> : null}

        <Text style={styles.sectionTitle}>Service Options</Text>
        {e.service_options.items.map((o) => {
          const isSel = o.label === selected
          return (
            <View key={o.label} style={isSel ? [styles.optionCard, styles.optionSelected] : styles.optionCard}>
              <View style={styles.optionHead}>
                <Text style={styles.optionTitle}>
                  {o.label}: {o.title}
                </Text>
                <Text style={styles.optionPrice}>{o.price.display}</Text>
              </View>
              <Text style={styles.notes}>{o.description}</Text>
              {isSel ? <Text style={styles.selectedBadge}>✓ Selected by customer</Text> : null}
            </View>
          )
        })}

        {e.notes.display_notes ? (
          <>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notes}>{e.notes.display_notes}</Text>
          </>
        ) : null}

        {e.signing ? (
          <View style={styles.sigBlock}>
            <Text style={styles.label}>Customer Signature</Text>
            <Text style={styles.sigName}>{e.signing.signature_name}</Text>
            <Text style={styles.notes}>
              Selected {e.signing.selected_option_label} • Signed{" "}
              {new Date(e.signing.signature_date).toLocaleString("en-US")}
            </Text>
            <Text style={styles.disclaimer}>
              By typing their name above, the customer agrees this constitutes their electronic signature and
              authorizes {e.company.name} to perform the selected work.
            </Text>
          </View>
        ) : null}

        <Text style={styles.footer} fixed>
          {e.company.name} • {e.company.region} • {e.company.owner_phone}
        </Text>
      </Page>
    </Document>
  )
}

export async function renderEstimatePdf(e: AlphaEstimate): Promise<Uint8Array> {
  const buffer = await renderToBuffer(<EstimateDoc e={e} />)
  return new Uint8Array(buffer)
}
