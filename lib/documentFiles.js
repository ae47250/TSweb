import { renderPdfBuffer } from "./pdfRenderer.js";

export function htmlDataUrl(html) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

export function pdfDataUrl(base64) {
  return `data:application/pdf;base64,${base64}`;
}

export async function createDownloadFile(html, { documentId, variant, mobile = false, signed = false }) {
  const label = signed ? "signed" : variant;
  try {
    const pdf = await renderPdfBuffer(html, { mobile });
    const pdfBase64 = Buffer.from(pdf).toString("base64");
    return {
      format: "pdf",
      html,
      pdfBase64,
      pdfDataUrl: pdfDataUrl(pdfBase64),
      downloadUrl: `/api/estimates/${encodeURIComponent(documentId)}/pdf/${encodeURIComponent(label)}`,
      filename: `${documentId}-${label}.pdf`,
      contentType: "application/pdf",
    };
  } catch (error) {
    return {
      format: "html-fallback",
      html,
      htmlDataUrl: htmlDataUrl(html),
      downloadUrl: `/api/estimates/${encodeURIComponent(documentId)}/pdf/${encodeURIComponent(label)}`,
      filename: `${documentId}-${label}.html`,
      contentType: "text/html; charset=utf-8",
      pdfError: error?.message || "PDF rendering failed.",
    };
  }
}
