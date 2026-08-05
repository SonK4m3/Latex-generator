# Plan — Dogfood, Auth/DB, and Frontend Maturity

## Objective
Validate the rebuilt `/app` creation workflow with a real document before expanding scope, then deliver the smallest secure Auth/DB foundation and frontend-quality improvements needed for a reliable student-facing product.

## Scope and sequencing

1. **Phase 0 — Dogfood and acceptance baseline** (blocks product-expansion decisions)
2. **Phase 1 — Auth/DB foundation** (blocks user data, quota, and ownership work)
3. **Phase 2 — Frontend maturity** (can start accessibility/responsive work after Phase 0; authenticated account surfaces depend on Phase 1)
4. **Phase 3 — Staging rollout and verification**

Explicitly deferred: realtime collaboration, billing, binary asset workflow, agentic multi-file generation (E1b/E2), formula OCR (E4), and broad migration automation until usage validates their need.

## Phase 0 — Dogfood `/app` with a real document

### Goal
Verify that the new chat + live preview workflow resolves the original three complaints:

1. Chat has enough readable, usable space.
2. Generation steps are visible while processing.
3. Results are previewable in the creation session, without navigating to `/documents/[id]`.

### Method
- Use the product owner’s own real Vietnamese or bilingual academic document request, not a synthetic testimonial or benchmark.
- Run the complete path under a staging-like environment with an available compile service and a configured AI provider; record configuration only as capability status, never secrets.
- Capture evidence: request text, timestamps for status transitions, screenshot/video or written observations, generated document ID, preview behavior, compiler/repair result, and blockers.
- Repeat with one short request and one long/complex request that plausibly triggers repair or clarification.

### Acceptance criteria
- Chat remains comfortably readable at desktop and 768px widths; no critical composer/message/action clipping.
- The user sees meaningful states at least for understanding, generating, validating, compiling, repairing when applicable, and completed/failed.
- Preview opens or refreshes automatically on a completed document in the same `/app` session. A user can return to chat without losing context.
- Failed generation communicates the failure and offers a coherent retry/recovery path.
- The tester can state, with evidence, whether all three original complaints are resolved.

### Deliverables
- `plans/.../reports/dogfood-findings.md`: observed behavior, screenshots/links if available, pass/fail per criterion, prioritized defects.
- A small, explicit follow-up issue list only for observed defects. Do not start E1b/E2 merely because dogfooding finishes.

### Likely modules if defects are found
- `components/HomeClient.tsx`
- `components/ChatAssistant.tsx`
- `components/ChatMessageItem.tsx`
- `components/useDocumentGenerationChat.ts`
- `app/api/documents/route.ts`
- `lib/orchestrator/document.ts`

### Validation
- Manual script above, plus the existing affected component/API integration tests.
- `npm run lint`, targeted Vitest suites, then `npm test` and `npm run build` after any code change.

## Phase 1 — Auth/DB platform foundation

### 1.1 Establish security and data contracts
Before implementation, define and approve:
- supported user identity methods (email/password and Google OAuth),
- reset-password return URL and email templates,
- initial quota policy (planner assumption: 10 completed generation attempts/day/user; confirm before code),
- workspace model (personal workspace first; optional shared workspaces later),
- migration approach and rollback/rehearsal plan for existing file-store documents.

### 1.2 Centralized route protection
- Add Next.js 16-compatible centralized auth guard/middleware for protected document/account routes.
- Preserve public access to landing, login, auth callback, health, and explicitly designated public APIs.
- Keep server-side ownership checks in document data paths; middleware is a routing guard, not authorization replacement.
- Test anonymous redirects, callback handling, authenticated access, and API behavior.

### 1.3 Identity lifecycle
- Implement password-reset request and reset-completion pages using Supabase’s supported recovery flow.
- Implement Google OAuth start/callback/error states with allowlisted redirect URLs.
- Make login/signup/reset/OAuth errors accessible and non-enumerating where appropriate.
- Do not expose Supabase service keys to client code.

### 1.4 Account and quota
- Add a minimal profile/account surface showing identity, current plan label, quota usage, and reset cadence.
- Enforce quota atomically server-side before a billable/generation attempt; never rely on client state.
- Create migrations for profile/quota tables and RLS policies; add integration tests for cross-user isolation and concurrent quota attempts.

### 1.5 Workspace/project ownership
- Model a personal workspace per user and associate documents/projects with it. Keep user ownership as the immediate authorization authority.
- Add workspace/document/project RLS policies and indexes.
- Write a reversible, idempotent migration/rehearsal tool or documented script for existing file-store records only after source data and target project are confirmed.
- Do not implement sharing, invitations, roles, or realtime in this phase.

### Likely modules
- `middleware.ts` or the Next.js-version-supported equivalent verified from `node_modules/next/dist/docs/`
- `app/login/`, `app/auth/callback/`, new recovery/account routes
- `lib/auth/current-user.ts`, Supabase client/server helpers
- `lib/store/`, document API routes and generation admission path
- `supabase/migrations/`
- auth, document-store, API integration tests

### Acceptance criteria
- Anonymous users cannot access protected document/account routes; authenticated users retain valid return navigation.
- Password recovery and Google OAuth succeed in a staging Supabase project.
- A user cannot read/write another user’s document, workspace, quota record, or project through UI or direct API calls.
- A quota-exhausted request produces a clear non-generation response; concurrent requests cannot exceed the allowed limit.
- Migration rehearsal proves record counts, ownership mapping, and rollback procedure before any production migration.

## Phase 2 — Frontend maturity

### 2.1 Responsive and accessibility baseline (priority one)
- Audit `/`, `/app`, login, documents list, and document workspace at mobile, tablet, and desktop breakpoints.
- Fix focus order, keyboard access, semantic headings/landmarks, dialog behavior, visible focus, contrast, status announcements, and loading/error state accessibility.
- Ensure chat and preview have a deliberate small-screen mode (stack/toggle), not a squeezed desktop two-column layout.
- Add automated checks where the existing test setup supports them and manual keyboard/screen-reader smoke checks.

### 2.2 Special-template guided forms (priority two)
- Start with the templates that need structured fields most: thesis, CV, letter, Beamer, and exam.
- Keep free-form prompt entry available; structured fields prefill/augment the prompt and must remain editable.
- Validate inputs client- and server-side. Do not make templates incompatible with existing natural-language generation.
- Introduce one template at a time, validated by representative real document requests.

### 2.3 SEO and PWA basics (priority three)
- Add correct metadata, canonical URLs, Open Graph image strategy, robots and sitemap for public pages only.
- Add PWA manifest, icons, and a deliberately scoped offline strategy that never claims document generation works offline.
- Check that protected/private document pages are not indexed.

### 2.4 Project explorer and assets — discovery gate
- After E1b is approved, design a nested project explorer, assets display, and multi-file autosave from actual generated project requirements.
- Keep the current flat manual project editor as the supported E1a experience until then.
- Do not build binary asset persistence or realtime merely to satisfy a roadmap checkbox.

### Likely modules
- `app/page.tsx`, `app/app/page.tsx`, `components/HomeClient.tsx`, chat and preview components
- `components/DocumentWorkspace.tsx`, `components/ProjectFileEditor.tsx`
- template registry/prompt request types and input components
- `app/layout.tsx`, metadata/manifest/robots/sitemap routes
- component and accessibility tests

### Acceptance criteria
- Core journeys work at 320px, 768px, and 1440px without horizontal overflow or inaccessible primary actions.
- Keyboard-only users can submit a request, observe generation status, access preview, save/edit, and log out.
- Public pages have valid metadata; private documents are not indexable.
- Each released guided template generates an equivalent valid request while preserving free-form editing.

## Phase 3 — Staging rollout and evidence

- Deploy Phase 1/2 changes to staging with Supabase redirects, OAuth credentials, RLS, migration rehearsal, and quota configuration verified.
- Run representative manual E2E flows for anonymous, email/password, recovery, OAuth, quota, CRUD ownership, generation, and responsive keyboard use.
- Run: `npm run lint`, `npm test`, `npm run build`, and `cd compile-service && npm test`.
- Run real-provider/Tectonic evaluation only with approved keys and controlled cost; record actual pass/fail rather than inferred quality.
- Update `docs/feature-tracking.md`, `docs/project-roadmap.md`, `docs/backend-roadmap.md`, `docs/frontend-roadmap.md`, and changelog with evidence and honest status.

## Dependencies and decision gates

| Gate | Required decision/evidence | Unlocks |
|---|---|---|
| G0 | Real `/app` dogfood result recorded | Scope of UX fixes; confidence before new feature work |
| G1 | Supabase staging and Google OAuth configuration available | Recovery/OAuth verification |
| G2 | Quota policy confirmed | Data schema and server enforcement |
| G3 | Legacy data inventory available | Migration rehearsal |
| G4 | E1b product approval | Tree/assets exploration; not required for Phases 0–2 |

## Risks and mitigations

- OAuth and recovery depend on external redirect/email setup: validate in staging before UI completion claims.
- RLS mistakes can expose data: enforce ownership both in service code and database policy; test with two accounts.
- Quota races can overspend provider usage: use an atomic database operation/transaction rather than read-then-write.
- PWA caching can leak stale/private data: cache only public static assets by default; never cache authenticated PDFs/documents without a reviewed policy.
- Scope creep from realtime/multi-file assets: retain explicit deferrals until dogfood and E1b decisions justify them.

## Open decisions

1. Confirm initial quota: is **10 completed generation attempts/day/user** acceptable?
2. Is Google the only OAuth provider for the first release?
3. Is a staging Supabase project plus Google OAuth redirect configuration available?
4. Are there existing file-store documents that must be migrated, and what volume/retention requirements apply?
