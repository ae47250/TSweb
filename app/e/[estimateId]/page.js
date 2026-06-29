import { getEstimate } from "../../../lib/estimateStore.js";
import EstimateClient from "./EstimateClient.jsx";

export const dynamic = "force-dynamic";

export default async function CustomerEstimatePage({ params }) {
  const { estimateId } = await params;
  const record = getEstimate(decodeURIComponent(estimateId));

  if (!record) {
    return (
      <main className="estimate-page">
        <section className="card">
          <h1>Estimate Not Available</h1>
          <p>This clean estimate link is valid after an estimate has been generated in the current app session.</p>
          <p className="text-muted">Durable Vercel Blob storage is not wired yet, so old links may not survive a server restart.</p>
        </section>
      </main>
    );
  }

  return <EstimateClient record={record} />;
}
