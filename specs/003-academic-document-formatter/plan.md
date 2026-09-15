# Implementation Plan: Academic Document Formatter

**Branch**: `003-academic-document-formatter` | **Date**: 2026-08-05 | **Spec**: [spec.md](./spec.md)

## Summary
Deliver a content-preserving academic formatter: accept user-owned academic content, normalize explicit structure with provenance, require review only for ambiguity, render a verified template deterministically, classify compliance as Draft or Ready to submit, then compile safely. The formatter never invokes AI generation, editing, or content-changing repair.

## Technical Context
**Language/Version**: TypeScript, React 19, Next.js 16
**Primary Dependencies**: Existing UI primitives, Zod validation, Supabase/file stores, LaTeX validation, compile client
**Storage**: Existing file/Supabase stores, extended for formatter artifacts/reviews/format requests
**Testing**: Vitest, React Testing Library, compile-service contract tests
**Target Platform**: Web application and existing Docker compile sandbox
**Project Type**: Next.js web application with compile service
**Performance Goals**: Clear inputs render without an extra review round; user sees an actionable status for every workflow state
**Constraints**: Exact substantive-content preservation; owner scoping; no raw user LaTex execution; no shell escape; compiler remains final technical authority
**Scale/Scope**: Four initial academic templates; text and existing extracted source input; no university auto-template creation

## Constitution Check
- Document reliability: PASS — stores artifact, provenance, compile status, and compliance separately.
- Template-first: PASS — only versioned product-owned template renderers can produce Ready status.
- Verification pipeline: PASS — rendered source is validated and compiler-confirmed; compliance is additional.
- Security-first compilation: PASS — reuses sandbox and does not execute raw source content.
- Provider-agnostic: PASS — formatter calls no provider.
- Test-first incremental delivery: PASS — phase each independently testable workflow slice.

## Project Structure
```text
app/api/academic-formatters/        # formatter routes
app/api/format-requests/            # unverified template requests
components/academic-formatter/      # intake, review, compliance, export UI
lib/academic-formatter/             # contracts, normalization, renderers, compliance, workflow
lib/store/                           # formatter persistence adapters
supabase/migrations/                # formatter persistence schema
specs/003-academic-document-formatter/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/formatter-api.md
tests/unit/academic-formatter/
tests/integration/api-academic-formatters/
```

**Structure Decision**: Keep formatter domain modules separate from existing AI generation/orchestrator modules. Reuse only safe ingestion, validation, compile, store, and UI conventions.

## Implementation Phases
1. Define domain contracts, source snapshots, provenance invariants, input validation, and persistence schema.
2. Implement deterministic normalizer, ambiguity detection, review patch validation, and semantic review UI/API.
3. Add versioned report/thesis/paper/problem-set renderers and deterministic template compliance rule packs.
4. Add formatter workflow/routes: normalize → review or render → validate → compliance → compile; persist state/artifacts and enforce ownership.
5. Add Draft/Ready UI, export metadata, format-request intake, and status feedback.
6. Add unit/integration/compile contract tests; run the quickstart scenarios and full quality gates.

## Post-design Constitution Check
PASS. The dedicated formatter workflow is necessary to uphold strict content preservation; reusing the AI repair loop would violate that invariant. No unjustified complexity beyond domain separation is introduced.
