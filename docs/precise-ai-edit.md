# Precise AI edits from a source selection

The document workspace can hand ChatGPT or Codex a specific saved LaTeX range, so an edit can target
one title, sentence, equation, or other source block instead of rewriting the whole document.

## Use it

1. Open a document and select the LaTeX text in the source editor. For a project document, open the
   file that contains the target first.
2. Choose **Copy context cho AI**. The clipboard receives JSON with the document, saved revision,
   path, exact range, selected text, and nearby source anchors.
3. Paste that JSON into the connected ChatGPT/Codex conversation with an instruction such as:
   “In the selection below, change the heading to `Background` and preserve the surrounding source.”
4. The AI passes the selection object and its replacement LaTeX to MCP tool
   `edit_document_selection`.
5. The MCP server saves the edit. The open web editor receives the new revision; compile there to
   refresh the PDF.

If the source has unsaved changes, save them before copying. The copied context always points at the
persisted revision. If another edit is saved before MCP applies the replacement, the request returns
a version conflict. Copy a fresh context and ask the AI to retry against the current document.

## Context format

```json
{
  "schemaVersion": 1,
  "documentId": "<document UUID>",
  "updatedAt": "<saved ISO timestamp>",
  "filePath": "main.tex",
  "start": 120,
  "end": 158,
  "selectedText": "the selected LaTeX",
  "prefix": "bounded text immediately before the selection",
  "suffix": "bounded text immediately after the selection"
}
```

`start` and `end` are zero-based JavaScript/textarea offsets (UTF-16 code units). The file path is
`main.tex` for single-file documents and the selected relative path for project files. Prefix and
suffix are limited to the nearest 256 code units.

## Safety and current limits

- MCP checks document ownership and current consent through the existing authenticated Supabase
  path. It requires the exact copied revision and rechecks the selected text and both anchors.
- The replacement changes only that span. The complete resulting file is written with the existing
  compare-and-set RPC, preserving atomic conflict handling and realtime notifications.
- A stale revision, moved range, mismatched anchors, binary/unreadable file, or unknown project path
  is rejected without guessing another location.
- This currently selects source text. The PDF pane is an iframe, so direct PDF box/node selection
  is not available yet. The source editor needs no new editor dependency because browser textarea
  selection provides exact text offsets. For a future PDF target, [PDF.js exposes page text items
  and their transforms](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html),
  and [Tectonic supports SyncTeX output](https://tectonic-typesetting.github.io/book/latest/v2cli/compile.html).
  Combining those into reliable PDF-to-LaTeX selections is a separate renderer and source-mapping
  change.
