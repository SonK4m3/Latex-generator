import { flattenPdfWhitespace } from "@/lib/mcp/pdf-source-selection";

/** PDF.js may split one sentence across lines or styled spans. Mark only a unique match. */
export function highlightPdfReplacement(divs: HTMLElement[], replacement: string) {
  const needle = replacement.trim().replace(/\s+/gu, " ");
  if (!needle) return;
  const spans: { element: HTMLElement; start: number; end: number }[] = [];
  let page = "";
  for (const element of divs) {
    if (!element.parentElement) continue;
    const start = page.length;
    page += element.textContent ?? "";
    spans.push({ element, start, end: page.length });
    if (element.nextElementSibling?.tagName === "BR") page += "\n";
  }
  const { text, offsets } = flattenPdfWhitespace(page);
  const match = text.indexOf(needle);
  if (match < 0 || text.indexOf(needle, match + 1) >= 0) return;
  const from = offsets[match], to = offsets[match + needle.length];
  for (const { element, start, end } of spans) {
    if (start >= to || end <= from || start === end) continue;
    const content = element.textContent ?? "";
    const left = Math.max(from - start, 0), right = Math.min(to, end) - start;
    const mark = document.createElement("mark");
    mark.setAttribute("data-pdf-highlight", "");
    mark.textContent = content.slice(left, right);
    element.replaceChildren(content.slice(0, left), mark, content.slice(right));
  }
}
