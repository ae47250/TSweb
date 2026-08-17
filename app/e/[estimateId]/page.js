import { loadTrustedEstimateBoundary } from "../../../lib/trustedEstimateBoundary.js";
import EstimateClient from "./EstimateClient.jsx";
import { verifyCustomerAccessToken } from "../../../lib/customerAccess.js";

export const dynamic = "force-dynamic";

function decodeEstimateId(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return "";
  }
}

export default async function CustomerEstimatePage({ params, searchParams }) {
  const { estimateId } = await params;
  const { token = "" } = await searchParams;
  const decodedEstimateId = decodeEstimateId(estimateId);
  if (!decodedEstimateId) {
    return (
      <main className="estimate-page">
        <section className="card">
          <h1>Estimate Not Available</h1>
          <p>This estimate link is unavailable or has expired. Please contact Tree Dude for a current copy.</p>
        </section>
      </main>
    );
  }
  const trusted = await loadTrustedEstimateBoundary(decodedEstimateId);

  if (!trusted.ok && trusted.status === 404) {
    return (
      <main className="estimate-page">
        <section className="card">
          <h1>Estimate Not Available</h1>
          <p>This estimate link is unavailable or has expired. Please contact Tree Dude for a current copy.</p>
        </section>
      </main>
    );
  }

  if (!trusted.ok) {
    return (
      <main className="estimate-page">
        <section className="card">
          <h1>Review Required</h1>
          <p>This estimate is temporarily unavailable while Tree Dude reviews a changed or unresolved detail.</p>
          <p className="text-muted">Customer documents remain hidden until the stored estimate passes validation again.</p>
        </section>
      </main>
    );
  }

  if (!verifyCustomerAccessToken(
    token,
    trusted.record.documentId,
    trusted.record.customerAccessVersion,
  )) {
    return (
      <main className="estimate-page">
        <section className="card">
          <h1>Estimate Link Expired</h1>
          <p>Please contact Tree Dude for a new secure estimate link.</p>
        </section>
      </main>
    );
  }

  const record = trusted.record;
  const completedStatus = ["signed", "accepted_manually"].includes(record.status);
  const customerRecord = {
    documentId: record.documentId,
    status: record.status,
    selectedOption: completedStatus ? record.selected_option || record.manualAcceptance?.selectedOptionLabel || "" : "",
    signatureName: completedStatus ? record.signature_name || record.manualAcceptance?.signatureName || "" : "",
    checkboxAccepted: completedStatus && record.checkboxAccepted === true,
    signedAtDisplay: completedStatus ? record.signedAtDisplay || record.manualAcceptance?.acceptedAtDisplay || "" : "",
    customerView: trusted.customerView,
    accessToken: token,
    signedFile: record.status === "signed" && record.signed?.full
      ? {
          downloadUrl: `/api/estimates/${encodeURIComponent(record.documentId)}/pdf/signed?token=${encodeURIComponent(token)}`,
          filename: record.signed.full.filename,
          format: record.signed.full.format,
        }
      : record.status === "accepted_manually" && record.accepted?.full
        ? {
            downloadUrl: `/api/estimates/${encodeURIComponent(record.documentId)}/pdf/accepted?token=${encodeURIComponent(token)}`,
            filename: record.accepted.full.filename,
            format: record.accepted.full.format,
          }
        : null,
  };

  return <EstimateClient record={customerRecord} />;
}
