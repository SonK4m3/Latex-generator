# Tasks: Academic Document Formatter

**Input**: Design documents from `specs/003-academic-document-formatter/`

**Tests**: Required by the project constitution and feature plan. Write focused tests before each behavior slice.

## Phase 1: Setup

- [ ] T001 Create formatter module and test directories at `lib/academic-formatter/`, `components/academic-formatter/`, `tests/unit/academic-formatter/`, and `tests/integration/api-academic-formatters/`
- [ ] T002 [P] Add content-preserving report and ambiguous-input fixtures under `tests/fixtures/academic-formatter/`
- [ ] T003 [P] Add formatter quickstart commands and test-fixture references in `specs/003-academic-document-formatter/quickstart.md`

---

## Phase 2: Foundational Contracts and Persistence

- [ ] T004 Define formatter domain contracts, submission states, provenance, and integrity guards in `lib/academic-formatter/types.ts` and `lib/academic-formatter/content-integrity.ts`
- [ ] T005 [P] Write immutability/provenance tests in `tests/unit/academic-formatter/content-integrity.test.ts`
- [ ] T006 Create formatter input validation in `lib/academic-formatter/formatter-input.ts` and tests in `tests/unit/academic-formatter/formatter-input.test.ts`
- [ ] T007 Add formatter artifact/review/format-request persistence abstractions in `lib/store/academic-formatter-store.ts`
- [ ] T008 [P] Implement file-backed formatter persistence in `lib/store/file-academic-formatter-store.ts` with tests in `tests/unit/academic-formatter/file-academic-formatter-store.test.ts`
- [ ] T009 [P] Implement Supabase formatter persistence and owner-scoped RLS migration in `lib/store/supabase-academic-formatter-store.ts` and `supabase/migrations/0005_academic_formatters.sql`
- [ ] T010 Add store conformance and owner-isolation tests in `tests/unit/academic-formatter/academic-formatter-store.test.ts`

**Checkpoint**: Immutable source snapshots, provenance, and owner-scoped formatter state work before any rendering.

---

## Phase 3: User Story 1 — Format a Report from Existing Content (P1) 🎯 MVP

**Goal**: A user submits clear existing content and receives a content-preserving, compiled Academic Report with Draft status if required information is missing.

**Independent Test**: A clear report fixture with headings, table, and caption compiles; exact content/provenance is retained; missing requirements remain Draft.

- [ ] T011 [P] [US1] Write explicit-structure normalization and preservation tests in `tests/unit/academic-formatter/normalize-explicit-structure.test.ts`
- [ ] T012 [P] [US1] Write deterministic Academic Report renderer tests in `tests/unit/academic-formatter/academic-report-renderer.test.ts`
- [ ] T013 [US1] Implement explicit-only semantic normalization in `lib/academic-formatter/normalize-explicit-structure.ts`
- [ ] T014 [US1] Implement the versioned academic template registry in `lib/academic-formatter/academic-template-registry.ts`
- [ ] T015 [US1] Implement the Academic Report renderer and safe text escaping in `lib/academic-formatter/templates/academic-report-template.ts` and `lib/academic-formatter/render-academic-document.ts`
- [ ] T016 [P] [US1] Write report compliance rule tests in `tests/unit/academic-formatter/report-compliance.test.ts`
- [ ] T017 [US1] Implement report required-field checks and Draft derivation in `lib/academic-formatter/evaluate-template-compliance.ts` and `lib/academic-formatter/derive-submission-state.ts`
- [ ] T018 [P] [US1] Write formatter workflow tests proving zero AI-generation/repair calls in `tests/unit/academic-formatter/formatter-workflow.test.ts`
- [ ] T019 [US1] Implement normalize → render → validate → compliance → safe compile workflow in `lib/academic-formatter/run-formatter-workflow.ts`
- [ ] T020 [P] [US1] Write create/read/export API integration tests in `tests/integration/api-academic-formatters/report-workflow.test.ts` and `tests/integration/api-academic-formatters/ownership-and-export.test.ts`
- [ ] T021 [US1] Implement owner-scoped create/read/export routes in `app/api/academic-formatters/route.ts`, `app/api/academic-formatters/[id]/route.ts`, and `app/api/academic-formatters/[id]/export/route.ts`
- [ ] T022 [P] [US1] Write report intake UI tests in `components/academic-formatter/academic-formatter-intake.test.tsx`
- [ ] T023 [US1] Implement report formatter page, intake, Draft status, preview, and export affordances in `app/academic-formatter/page.tsx`, `components/academic-formatter/academic-formatter-intake.tsx`, and `components/academic-formatter/academic-formatter-status.tsx`

**Checkpoint**: Report MVP works independently without any AI provider or content-changing repair loop.

---

## Phase 4: User Story 2 — Review Ambiguous Structure (P2)

**Goal**: Ambiguous input pauses for an owner to approve structural interpretation without editable prose.

**Independent Test**: An ambiguous fixture cannot render until review; a classification change updates output hierarchy while source text/hash/provenance remain unchanged.

- [ ] T024 [P] [US2] Write ambiguity-policy tests in `tests/unit/academic-formatter/detect-semantic-ambiguity.test.ts`
- [ ] T025 [P] [US2] Write immutable review-patch tests in `tests/unit/academic-formatter/apply-semantic-review.test.ts`
- [ ] T026 [US2] Implement ambiguity detection in `lib/academic-formatter/detect-semantic-ambiguity.ts`
- [ ] T027 [US2] Implement semantic-review patch validation and application in `lib/academic-formatter/apply-semantic-review.ts`
- [ ] T028 [P] [US2] Write semantic-review route integration tests in `tests/integration/api-academic-formatters/semantic-review-workflow.test.ts`
- [ ] T029 [US2] Implement semantic-review submission route in `app/api/academic-formatters/[id]/semantic-review/route.ts`
- [ ] T030 [P] [US2] Write semantic-review panel tests in `components/academic-formatter/semantic-review-panel.test.tsx`
- [ ] T031 [US2] Implement structural-only semantic-review UI in `components/academic-formatter/semantic-review-panel.tsx`
- [ ] T032 [US2] Connect review state and approved render flow in `app/academic-formatter/[id]/page.tsx`

**Checkpoint**: The app never compiles ambiguous content before the owner approves its structure.

---

## Phase 5: User Story 3 — Determine Submission Readiness (P3)

**Goal**: Users distinguish Draft from Ready-to-submit across all four verified academic templates.

**Independent Test**: Complete and incomplete fixtures produce stable rules and Ready/Draft states independently of compilation-only success.

- [ ] T033 [P] [US3] Write template rule-pack and readiness-state tests in `tests/unit/academic-formatter/template-compliance.test.ts` and `tests/unit/academic-formatter/submission-state.test.ts`
- [ ] T034 [P] [US3] Implement Thesis/Dissertation renderer and rules in `lib/academic-formatter/templates/thesis-template.ts`
- [ ] T035 [P] [US3] Implement Research Paper renderer and rules in `lib/academic-formatter/templates/research-paper-template.ts`
- [ ] T036 [P] [US3] Implement Problem Set/Assignment renderer and rules in `lib/academic-formatter/templates/problem-set-template.ts`
- [ ] T037 [US3] Extend registry, compliance evaluation, and workflow for all verified templates in `lib/academic-formatter/academic-template-registry.ts`, `lib/academic-formatter/evaluate-template-compliance.ts`, and `lib/academic-formatter/run-formatter-workflow.ts`
- [ ] T038 [P] [US3] Write compliance rerun/export metadata integration tests in `tests/integration/api-academic-formatters/compliance-and-export.test.ts`
- [ ] T039 [US3] Implement deterministic compliance rerun route in `app/api/academic-formatters/[id]/compliance/route.ts`
- [ ] T040 [P] [US3] Write compliance-state UI tests in `components/academic-formatter/compliance-results.test.tsx`
- [ ] T041 [US3] Implement Draft/Ready results and export warnings in `components/academic-formatter/compliance-results.tsx`
- [ ] T042 [P] [US3] Write format-request API/UI tests in `tests/integration/api-academic-formatters/format-request.test.ts` and `components/academic-formatter/format-request-form.test.tsx`
- [ ] T043 [US3] Implement unverified institution-format request route/UI in `app/api/format-requests/route.ts` and `components/academic-formatter/format-request-form.tsx`

**Checkpoint**: Ready-to-submit is impossible unless review, integrity, validation, mandatory rules, and compilation all pass.

---

## Phase 6: Polish and Cross-Cutting Validation

- [ ] T044 [P] Add route-level accessibility, responsive, error-state, and keyboard-flow coverage for formatter UI in `components/academic-formatter/*.test.tsx`
- [ ] T045 Add source/provenance/renderer determinism regression fixtures in `tests/fixtures/academic-formatter/` and `tests/unit/academic-formatter/`
- [ ] T046 Run full formatter validation and update results in `specs/003-academic-document-formatter/quickstart.md`: `npm test`, `npm run lint`, `npm run build`, and `cd compile-service && npm test`
- [ ] T047 Update honest implementation status in `docs/feature-tracking.md`, `docs/frontend-roadmap.md`, and `docs/backend-roadmap.md`

## Dependencies & Execution Order

- Phase 1 → Phase 2 → US1 → US2 → US3 → Phase 6.
- US1 is the smallest deployable MVP.
- US2 depends on the immutable semantic model and formatter workflow from US1.
- US3 depends on US1 artifact/compliance plumbing and uses US2 review state where applicable.
- T034–T036 can run in parallel after T033; T038/T040/T042 can run in parallel after T037.

## Parallel Example: User Story 1

```text
T011 + T012: normalization and renderer tests
T016 + T018: compliance and zero-AI workflow tests
T020 + T022: API and UI tests after workflow contract is set
```

## Implementation Strategy

1. Deliver and validate T001–T023 as the Academic Report MVP.
2. Dogfood with real user-owned report content before starting semantic-review work.
3. Add ambiguity review, then readiness/template expansion.
4. Treat any source-content mutation, ownership leak, generation/repair call, or false Ready-to-submit status as a release blocker.
