# Research — Academic Document Formatter

## Decisions

### Deterministic, content-preserving workflow
**Decision:** Build a formatter workflow separate from AI generation/edit/repair. It accepts user text/extracted sources, preserves source offsets, normalizes explicit structure, requires review for ambiguity, renders deterministic LaTeX, checks compliance, then compiles.

**Rationale:** The product promise forbids substantive additions or changes. Existing generation and repair loops can alter content, so they cannot establish that guarantee.

**Alternatives:** Reuse AI generation/repair (rejected: violates preservation); render raw text directly (rejected: no semantic hierarchy/compliance).

### Separate formatter contracts
**Decision:** Add formatter-specific domain types and persistence rather than widening the generation `DocumentRequest` contract.

**Rationale:** A semantic review, provenance, compliance state, and source snapshot are distinct from a generated document and must remain independently testable.

### Review only ambiguous inputs
**Decision:** Render directly for explicit Markdown/headings/styles; create a review state for competing hierarchy, caption/table/formula, or front-matter interpretations.

**Rationale:** Preserves a fast path without silently producing a polished, structurally incorrect document.

### Template authority and deterministic compliance
**Decision:** Product-owned, versioned academic templates define renderer and mandatory compliance rules. Compilation only proves technical validity; readiness additionally requires every mandatory rule to pass.

**Rationale:** This makes Draft versus Ready-to-submit truthful and repeatable.

### Verified-format boundary
**Decision:** An institution sample/rule creates an unverified Format Request, never an immediately selectable template or an institutional-compliance claim.

**Rationale:** Prevents false claims while retaining a path to a curated template library.

### Existing integrations
**Decision:** Reuse existing ingestion, owner-scoped persistence conventions, LaTeX validation, compile client, and sandbox unchanged. Add dedicated formatter routes and UI rather than changing generation endpoints.

**Rationale:** Limits regression risk and retains the constitution's security/verification gates.
