// PDF -> plain text, in the browser. Uses pdfjs-dist. Runs client-side so the
// document (like the BYOK key) never has to hit our server on the BYOK path.
//
// The extracted text is BOTH what the model reads AND the grounding source, so
// spacing here matters: we join text items with spaces and pages with newlines,
// then the grounding normalizer (grounding.mjs) collapses whitespace the same way
// v007 does. That symmetry is why a span the model copies from this text grounds.
"use client";

let _pdfjs = null;

async function getPdfjs() {
  if (_pdfjs) return _pdfjs;
  const pdfjs = await import("pdfjs-dist");
  // Local worker (no external host — the CSP blocks CDNs).
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  _pdfjs = pdfjs;
  return pdfjs;
}

// Extract text from a PDF File/Blob/ArrayBuffer. Returns a single string.
export async function pdfToText(input) {
  const pdfjs = await getPdfjs();
  const data =
    input instanceof ArrayBuffer ? input : await input.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((it) => it.str).join(" "));
  }
  return pages.join("\n");
}
