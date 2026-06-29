import { getEstimate } from "../../../../../../lib/estimateStore.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fileForVariant(record, variant) {
  if (variant === "signed") return record.signed?.full || null;
  return record.documents?.[variant] || null;
}

export async function GET(_request, context) {
  const { documentId, variant } = await context.params;
  const record = getEstimate(documentId);
  const file = record ? fileForVariant(record, variant) : null;

  if (!file) {
    return Response.json({ error: "Estimate document was not found." }, { status: 404 });
  }

  if (file.format === "pdf" && file.pdfBase64) {
    return new Response(Buffer.from(file.pdfBase64, "base64"), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${file.filename}"`,
      },
    });
  }

  return new Response(file.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "X-PDF-Fallback": "PDF rendering was not available.",
    },
  });
}
