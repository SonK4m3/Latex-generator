# Precise AI edit by source selection

## 5W analysis

### What

Let a user select an exact LaTeX source span in the web editor, copy a structured context payload, and give it to ChatGPT/Codex with an editing instruction. The MCP server applies the proposed replacement only to that span. Both single-file documents and readable files in multi-file projects are in scope.

### Why

Whole-document updates make it hard to constrain AI changes to the location the user meant. A selected span gives the model a concrete target and reduces accidental edits elsewhere. Revision and anchor checks prevent applying copied context after the source has changed.

### Who

- Document owner: selects a source range in the authenticated web workspace and copies its context.
- ChatGPT/Codex: receives the copied payload and instruction, proposes replacement LaTeX, and invokes the MCP selection-edit tool.
- MCP service: verifies ownership/consent through existing document reads and writes, validates revision and source anchors, then persists one compare-and-set update.
- Open web workspace: receives the existing realtime revision notification and displays the saved source update.

### Where

- UI: single-file editor in `components/DocumentWorkspace.tsx`; multi-file editor in `components/ProjectFileEditor.tsx`.
- MCP: new selection-edit application operation and tool registration in `lib/application/` and `lib/mcp/server.ts`.
- Persistence: existing MCP CAS RPCs for single-file source and project file patches; no schema change.
- Documentation: this plan and `docs/system-architecture.md`.

### When

Copy is enabled only when the selected source is the saved revision. The payload records document ID, revision timestamp, file path, UTF-16 offsets, selected text, and bounded prefix/suffix anchors. MCP edits only if the document still has that revision and every source anchor matches. Concurrent changes or stale contexts return a conflict and require the user/model to copy fresh context.

## Proposed payload and MCP contract

```json
{
  "schemaVersion": 1,
  "documentId": "<uuid>",
  "updatedAt": "<saved revision timestamp>",
  "filePath": "main.tex",
  "start": 120,
  "end": 158,
  "selectedText": "...",
  "prefix": "...",
  "suffix": "..."
}
```

Offsets use JavaScript/textarea UTF-16 code units. The MCP write accepts the payload and a replacement string. It reads the latest owner-scoped source, checks the exact revision, range, selected text, and surrounding anchors, then submits the complete modified file to the existing revision-checked write RPC. This preserves current consent, ownership, realtime, and compare-and-set boundaries.

## Delivery plan

1. Add the 5W/spec and acceptance criteria (this file).
2. Implement a reusable MCP operation with strict schemas, safe file resolution, stale revision/anchor rejection, and tests.
3. Register an `edit_document_selection` MCP tool that consumes copied context plus replacement text.
4. Add a shared source selection payload helper and copy action to single-file and project source editors. Disable it when the editor draft differs from the saved document.
5. Add focused UI/MCP tests and update architecture docs with the interaction and limitation.
6. Run focused tests, MCP suite, lint, TypeScript, and inspect the final diff. Keep local web/MCP integration evidence separate from browser/plugin-cloud acceptance.

## Acceptance criteria

- AC1: Selecting text in a saved single-file document exposes a copy action and copies valid version-1 JSON with the saved revision and exact range/anchors.
- AC2: Selecting text in a saved readable project file copies that file path and source range.
- AC3: Unsaved editor content cannot produce a payload that targets a different persisted source.
- AC4: MCP can replace the exact selection for single-file and project documents and returns the saved revision/link.
- AC5: MCP rejects stale revision, changed source/anchors, invalid range, missing/ambiguous project path, and unsupported source without writing.
- AC6: Successful MCP edit uses existing consent/owner/CAS logic and becomes visible through the existing realtime editor refresh path.
- AC7: Existing whole-source MCP update behavior remains available.
- AC8: Docs state that current PDF preview is an iframe and PDF box-to-source mapping is not part of this delivery; PDF-coordinate selection needs a PDF.js renderer and source mapping.

## Boundaries and risks

- The current PDF preview is a native iframe. It has no page text layer, selectable node identity, or PDF-to-LaTeX source mapping. This delivery treats a selected source range as the node-like target; direct PDF box selection is a follow-up requiring a PDF renderer and mapping strategy.
- Selection context contains selected source text and small adjacent anchors. The user explicitly copies and shares it with their connected AI client.
- A successful save clears the old compiled PDF under current MCP write semantics; the user compiles the saved revision from the web editor.
- Realtime updates notify/open the web editor; they do not make the external ChatGPT page itself a live editor surface.

## Verification record

- AC1–AC5 and AC7: covered by source-selection, application operation, MCP tool-schema, and editor tests; 78 MCP tests passed, including 18 selection-edit cases.
- AC6: editor realtime revision synchronization is covered for a clean multi-file editor, dirty drafts are preserved with an explicit accept-new-revision action, and the live local browser showed the copy button and success feedback. A live MCP selection-write round trip remains unverified in this turn.
- AC8: documented; PDF box selection remains follow-up work.
- `npx tsc --noEmit`, scoped ESLint, and `npm run build` passed.
- Full `npm test`: 496 passed; three CV template assertions failed in existing tests because the current template uses `\\cvsection` and its guidance omits the required `EXAMPLE` marker. Those failures are outside this feature.
