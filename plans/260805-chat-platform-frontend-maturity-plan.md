# Implementation Plan

**Scope:** Three coordinated workstreams: dogfood `/app`; close Auth/DB platform gaps; mature responsive, accessible, discoverable frontend. Evidence and rationale: [`reports/260805-chat-platform-frontend-maturity-discovery.md`](./reports/260805-chat-platform-frontend-maturity-discovery.md). Existing generation SSE remains; collaborative realtime, binary assets, AI multi-file creation, billing, and sharing UI are excluded.

## Decisions and dependency map

- **Authorization:** Next 16 `proxy.ts` centralizes UI redirect policy; API handlers retain authenticated/authorized JSON responses. This corrects the current public landing/proxy contradiction without trusting proxy checks for data access.
- **Data model:** workspaces → projects → documents. Migration creates Personal workspace + project per legacy document, then RLS moves from direct `owner_id` to membership checks. Platform schema and migration precede project explorer.
- **Quota:** free-only, **10 generation starts per user/UTC day**, atomically reserved before the AI request; only `POST /api/documents` is metered. It protects cost without blocking repair, manual compile, or chat edit.
- **Realtime:** retain the already-shipped per-user SSE generation/status flow. Do not add Supabase Realtime/presence/cursors until membership, sharing, conflict handling, and measured demand exist.
- **Template forms:** limited reusable form descriptors for `cv`, `letter`, and `exam`; serialize to the existing description API contract, with natural-language fallback. No E7 policy change or per-template backend endpoints.
- **PWA:** installable, online-first public shell only; authenticated content and API responses are never persisted offline.

## Phase 0 — Baseline and dogfood evidence

- [ ] 1. Provision a non-production Supabase test user and run a real document through the current `/app` flow before changing behavior: sign in, create a Vietnamese 3–5 section academic report using the real configured AI and compile service, watch every SSE stage, inspect live PDF/source, open full workspace, edit/recompile, convert to multi-file, and return to the list. Capture screen-size/device, timestamps, prompt/template, compile result, all observed friction, and no document content/secrets in the report.
      Files: modify `plans/reports/260805-chat-platform-frontend-maturity-discovery.md`; create `plans/reports/260805-app-real-document-dogfood.md`
      Acceptance criteria: report records pass/fail for create → visible stage → in-place PDF/source → full editor → saved list, explicitly rechecks the three 2026-08-05 findings, and turns every new P0/P1 finding into a numbered acceptance criterion for later items.
      Verify: with real Supabase/AI/compile configuration, run `npm run dev`, complete the scripted `/app` journey in a browser at 1440px and 390px widths, and attach only redacted observations; run `npm test` afterward to confirm the baseline suite remains green.

- [ ] 2. Convert the dogfood findings into a traceable acceptance matrix and update roadmap status without declaring untested work done. Classify each observation as fixed in current behavior, covered by this plan, or deferred; include accessibility, mobile, platform, and data-migration scenarios.
      Files: modify `plans/reports/260805-app-real-document-dogfood.md`, `docs/student-journey-tracking.md`, `docs/feature-tracking.md`
      Acceptance criteria: every implementation item below has at least one measurable user or security outcome; pre-existing fixes (live preview and granular statuses) remain credited, not reimplemented.
      Verify: `npm test` passes and the report’s final acceptance matrix has no unclassified observation.

## Phase 1 — Safe authentication and account foundation

- [ ] 3. Make route classification explicit and centralize unauthenticated UI redirects in the existing Next 16 proxy. Treat `/`, `/login`, `/auth/**`, the manifest, service worker, and public static assets as public; protect `/app/**`, `/documents/**`, and `/settings/**`; preserve the existing API route behavior of explicit JSON `401`/`403` plus per-resource authorization. Add route-policy tests for public landing, protected UI redirect with a same-origin `redirectTo`, session refresh, and API non-redirect behavior.
      Files: modify `utils/supabase/middleware.ts`, `proxy.ts`; create `lib/auth/route-policy.ts`, `tests/unit/auth-route-policy.test.ts`
      Acceptance criteria: an unauthenticated visitor can load `/`; an unauthenticated protected page redirects once to `/login?redirectTo=<same-origin path>`; API requests never receive HTML redirects; authenticated and expired-session behavior remains correctly refreshed by Supabase.
      Verify: `npm test -- tests/unit/auth-route-policy.test.ts tests/integration/api-documents-crud.test.ts`, then `npx tsc --noEmit` and `npm run lint` pass.

- [ ] 4. Add complete recovery authentication: a password-reset request state on login, callback-safe redirect to a dedicated password-update route, password confirmation/validation, successful update/session refresh, and a return to `/app`. Add Google OAuth initiation alongside email login, using the same callback and a server-validated local redirect path; document required Supabase redirect URLs/provider setup without committing credentials.
      Files: modify `app/login/login-form.tsx`, `app/login/page.tsx`, `app/auth/callback/route.ts`, `utils/supabase/middleware.ts`; create `app/auth/update-password/page.tsx`, `app/auth/update-password/update-password-form.tsx`, `lib/auth/safe-redirect.ts`, `tests/unit/safe-redirect.test.ts`, `tests/unit/login-form.test.tsx`, `tests/unit/update-password-form.test.tsx`; modify `env.example`, `README.md`
      Acceptance criteria: reset request never reveals whether an email exists; confirmation links can only return to permitted internal paths; mismatched/weak passwords do not submit; an OAuth user returns to the requested protected route; missing/unconfigured OAuth fails visibly without breaking password login.
      Verify: `npm test -- tests/unit/safe-redirect.test.ts tests/unit/login-form.test.tsx tests/unit/update-password-form.test.tsx`, `npx tsc --noEmit`, `npm run lint`, and a staging browser smoke test for reset + Google OAuth after Supabase provider configuration.

- [ ] 5. Introduce profiles and server-enforced daily generation usage before AI work starts. Add an idempotent Supabase migration for `profiles` and `generation_usage`, an atomic authenticated RPC that reserves one of 10 UTC-day free generation starts, and a small server-side quota service; make `POST /api/documents` return a stable `429` quota response before calling the provider. Expose read-only profile/quota data through a scoped account API and add a Settings page with email, free-plan label, usage, reset time, and logout.
      Files: create `supabase/migrations/0004_profiles-and-generation-usage.sql`, `lib/account/quota-service.ts`, `app/api/account/route.ts`, `app/settings/page.tsx`, `components/AccountSettings.tsx`, `tests/unit/quota-service.test.ts`, `tests/integration/api-account-and-quota.test.ts`; modify `app/api/documents/route.ts`, `app/app/layout.tsx`, `env.example`, `README.md`, `docs/feature-tracking.md`
      Acceptance criteria: concurrent requests cannot exceed 10 reservations/day; rejected request does not invoke AI or create a document; a successful request counts once even if compile later fails; the authenticated user sees only their email/usage; all profile/usage rows remain RLS-scoped.
      Verify: `npm test -- tests/unit/quota-service.test.ts tests/integration/api-account-and-quota.test.ts tests/integration/api-documents-crud.test.ts`, `npx tsc --noEmit`, `npm run lint`; apply in staging with `npx supabase db push` and validate the RPC/RLS using two test accounts.

## Phase 2 — Workspace/project schema, secure migration, and explorer

- [ ] 6. Add the workspace/project authorization model through a forward-only, idempotent Supabase migration. Create `workspaces`, `workspace_members`, and `projects`; add nullable `project_id` to `documents`; backfill one Personal workspace, owner membership, and project per legacy document; then apply membership-based RLS for project/document access with owner/editor/viewer roles. Preserve `documents.files`/`root_file` and all E1 path guards—this is a structural ownership migration, not an asset or AI-generation rewrite.
      Files: create `supabase/migrations/0005_workspaces-projects-and-document-backfill.sql`, `supabase/migrations/0006_workspace-project-rls-cutover.sql`, `docs/database-migration-runbook.md`; modify `lib/types/document.ts`, `lib/store/supabase-document-store.ts`, `lib/store/documentStore.ts`, `docs/system-architecture.md`
      Acceptance criteria: every existing document belongs to exactly one migrated Personal project; owner can read/write, editor can read/write, viewer can only read, and non-members cannot enumerate/read/mutate even with guessed IDs; rollback is a documented restore/feature-flag procedure, not destructive down migration.
      Verify: `npx supabase db push` against a disposable/staging project, run SQL assertions in `docs/database-migration-runbook.md` as owner/editor/viewer/non-member, then `npm test -- tests/unit/store-project.test.ts tests/integration/api-documents-crud.test.ts tests/integration/api-documents-patch-project.test.ts` plus `npx tsc --noEmit`.

- [ ] 7. Move application store/query contracts to the project-scoped model while preserving the single-document creation flow. Add workspace/project list/get/create operations, resolve the user’s Personal workspace/project on creation, require project membership for document CRUD, and return lightweight project metadata needed by the explorer. Keep file-backed storage behavior explicit and unchanged; project workspaces require `STORE_BACKEND=supabase` rather than a partial dual-backend simulation.
      Files: create `lib/store/supabase-workspace-project-store.ts`, `app/api/workspaces/route.ts`, `app/api/projects/route.ts`, `app/api/projects/[id]/route.ts`, `tests/integration/api-workspaces-projects.test.ts`; modify `lib/store/documentStore.ts`, `lib/store/supabase-document-store.ts`, `lib/types/document.ts`, `app/api/documents/route.ts`, `app/api/documents/[id]/route.ts`, `lib/query-keys.ts`, `README.md`
      Acceptance criteria: document generation automatically lands in the Personal project; document requests are rejected for non-members; no existing single-file or E1a multi-file PATCH contract regresses; file backend clearly returns the existing personal-document experience and does not claim collaborative project support.
      Verify: `npm test -- tests/integration/api-workspaces-projects.test.ts tests/integration/api-documents-crud.test.ts tests/integration/api-documents-patch-project.test.ts tests/unit/store-project.test.ts`, then `npx tsc --noEmit`, `npm run lint`, and `npm run build`.

- [ ] 8. Replace the flat saved-document list with an accessible project explorer backed by the new APIs. Show workspaces/projects, document counts and compile state; retain document delete confirmation and links to the current workspace. Within an E1a project, render the existing `.tex` hierarchy as a keyboard-operable tree and retain root-file semantics; use the existing `ProjectFileEditor` for editing rather than introducing a second editor state model.
      Files: create `components/project-explorer.tsx`, `components/project-file-tree.tsx`, `components/stores/project-explorer-store.ts`, `tests/unit/project-explorer.test.tsx`; modify `components/HomeClient.tsx`, `components/DocumentList.tsx`, `components/DocumentWorkspace.tsx`, `components/ProjectFileEditor.tsx`, `components/stores/workspace-store.ts`, `app/app/page.tsx`, `tests/unit/document-list.test.tsx`
      Acceptance criteria: mouse and keyboard users can expand/collapse, select a project/document/file, identify the root file and current item, and reach delete/open actions with an accessible name; state is scoped by project/document rather than the current global last-tab; no `prompt`/text-symbol-only action is required for core navigation.
      Verify: `npm test -- tests/unit/project-explorer.test.tsx tests/unit/document-list.test.tsx`, `npx tsc --noEmit`, `npm run lint`, and manual keyboard smoke test (Tab/Shift+Tab/Enter/Space/Arrow keys) at 1440px and 390px.

- [ ] 9. Make binary asset scope honest and safe: show an Assets section in the project explorer only as an unavailable-state explanation linked to the roadmap, not a fake upload control. Document the required future contract—Supabase Storage bucket, project membership/RLS, signed retrieval URLs, MIME/size validation, compile-service path guard, deletion lifecycle—before implementing it.
      Files: modify `components/project-explorer.tsx`, `docs/student-journey-tracking.md`, `docs/frontend-roadmap.md`, `docs/backend-roadmap.md`, `docs/database-migration-runbook.md`
      Acceptance criteria: users are not offered an upload that cannot persist/compile; docs explicitly state `.tex`-only E1a current capability and the security prerequisites for actual assets.
      Verify: `npm test -- tests/unit/project-explorer.test.tsx`, `npm run lint`, and `npm run build` pass.

## Phase 3 — Responsive, accessible, template-aware `/app`

- [ ] 10. Apply the dogfood acceptance matrix to responsive Compose Room layouts. Make authenticated header, chat composer/history, live preview, saved/project explorer, document workspace, and project file tree work at 320px, 390px, 768px, and desktop widths; use a deliberate one-panel-at-a-time mobile arrangement with accessible panel switching rather than shrinking two desktop columns. Remove fixed-height traps and ensure touch targets are at least 44px without changing the existing Compile Room visual language.
      Files: modify `app/app/layout.tsx`, `app/documents/layout.tsx`, `components/{HomeClient,ChatAssistant,ResultPanel,DocumentWorkspace,ProjectFileEditor,project-explorer,project-file-tree}.tsx`, `app/globals.css`; create `tests/unit/home-client-responsive.test.tsx`
      Acceptance criteria: no horizontal viewport scrolling, obscured composer, unreachable preview, or trapped nested scroll at target widths; current PDF/source and explorer selection remain understandable after responsive reflow; desktop behavior stays two-column where space permits.
      Verify: `npm test -- tests/unit/home-client-responsive.test.tsx components/__tests__/chat-assistant.test.tsx`, `npx tsc --noEmit`, `npm run lint`, `npm run build`; manually browser-test the dogfood document at each target width.

- [ ] 11. Reach WCAG 2.2 AA for the changed authenticated surfaces: semantic landmarks/headings, focus-visible Compile Blue controls, labelled icon buttons, programmatic errors, `aria-live` status for save/SSE stages, accessible dialogs in place of `confirm`/`prompt`, keyboard tree/tabs, reduced-motion support, and contrast-safe status treatment. Test the actual chat generation, source editing, project browsing, account page, and auth recovery flows with keyboard and a screen reader pass.
      Files: create `components/ui/confirm-dialog.tsx`, `components/ui/rename-file-dialog.tsx`, `tests/unit/accessibility-authenticated-surfaces.test.tsx`; modify `components/{ChatAssistant,ChatMessageItem,ResultPanel,DocumentWorkspace,ProjectFileEditor,DocumentList,AccountSettings,project-explorer,project-file-tree}.tsx`, `app/globals.css`, `DESIGN.md`
      Acceptance criteria: every actionable control has an accessible name; focus never disappears; critical state is communicated without color alone; route, save, compile, quota, and auth errors are announced; all changed flows complete using keyboard only.
      Verify: `npm test -- tests/unit/accessibility-authenticated-surfaces.test.tsx tests/unit/project-explorer.test.tsx`, `npm run lint`, `npm run build`, plus manual NVDA/VoiceOver and keyboard checklist recorded in `plans/reports/260805-app-real-document-dogfood.md`.

- [ ] 12. Add structured, reusable creation briefs for CV, formal letter, and exam only. Define field descriptors next to the template registry, render an accessible form in `ChatAssistant` when selected, generate the existing natural-language `description` deterministically, and keep the free-form prompt visible as an optional additional instruction. Do not modify the document API schema, enable E7, or add bespoke forms for all 11 templates.
      Files: modify `lib/templates/registry.ts`, `components/ChatAssistant.tsx`, `components/useDocumentGenerationChat.ts`, `lib/types/document.ts`; create `components/template-brief-form.tsx`, `lib/templates/template-brief.ts`, `tests/unit/template-brief.test.ts`, `tests/unit/template-brief-form.test.tsx`; modify `components/__tests__/chat-assistant.test.tsx`, `docs/frontend-roadmap.md`
      Acceptance criteria: CV captures identity/experience/skills, letter captures sender/recipient/subject/body, and exam captures title/instructions/questions; required fields prevent submission with understandable errors; output is a valid existing `description` request and all other templates retain the current chat-only flow.
      Verify: `npm test -- tests/unit/template-brief.test.ts tests/unit/template-brief-form.test.tsx components/__tests__/chat-assistant.test.tsx tests/integration/api-documents-crud.test.ts`, then `npx tsc --noEmit`, `npm run lint`, and a real create/compile smoke test for each of the three templates.

## Phase 4 — Public-web metadata and privacy-preserving PWA

- [ ] 13. Complete public SEO metadata and language semantics: set Vietnamese root language, canonical/metadata base from a documented public site URL, consistent title templates, robots, Open Graph/Twitter cards, and a generated static social image that reflects only public product claims. Keep `/app`, `/documents`, `/settings`, and API responses non-indexable.
      Files: modify `app/layout.tsx`, `app/page.tsx`, `env.example`, `README.md`; create `app/robots.ts`, `app/sitemap.ts`, `app/opengraph-image.tsx`, `app/twitter-image.tsx`; modify `next.config.ts`
      Acceptance criteria: public landing has correct canonical, VI language, social preview, and indexability; authenticated pages carry `noindex`; no user document title/source/PDF or Supabase data is included in metadata or generated images.
      Verify: `npm run build`, `npm run lint`, and inspect rendered `<head>` plus `/robots.txt`, `/sitemap.xml`, Open Graph, and Twitter image routes in a production build.

- [ ] 14. Ship an installable online-first PWA without third-party PWA dependencies. Add a manifest, appropriately sized generated icons, registration guarded to production, and a versioned service worker caching only same-origin static assets/public landing shell. Explicitly bypass `/api/**`, authenticated pages, PDFs, documents, Supabase endpoints, and requests with credentials; provide a clear offline message instead of stale private content.
      Files: create `app/manifest.ts`, `app/icon.tsx`, `app/apple-icon.tsx`, `public/service-worker.js`, `components/pwa-service-worker-registration.tsx`, `components/offline-notice.tsx`; modify `app/layout.tsx`, `app/app/layout.tsx`, `next.config.ts`, `README.md`, `docs/frontend-roadmap.md`; create `tests/unit/pwa-service-worker-registration.test.tsx`
      Acceptance criteria: Chromium reports installability on HTTPS; public shell can reopen offline; authenticated data/API/PDF/source are absent from Cache Storage; an offline authenticated visitor receives an explicit reconnect message, never stale document data.
      Verify: `npm test -- tests/unit/pwa-service-worker-registration.test.tsx`, `npm run lint`, `npm run build`, then Chrome DevTools Application/Network audit against a production HTTPS deployment and inspect Cache Storage entries.

## Phase 5 — Migration rollout and final evidence

- [ ] 15. Execute staged Supabase migration and release validation: back up/export existing data, apply pending `0001`–`0006` in a disposable staging project, validate data counts/RLS/quota atomics with distinct accounts, dogfood the real document again, then promote using the written runbook. Update roadmap/changelog/tracking only with observed completion and retain a rollback switch to file storage until production checks pass.
      Files: modify `docs/database-migration-runbook.md`, `docs/{feature-tracking,student-journey-tracking,frontend-roadmap,backend-roadmap,project-roadmap}.md`, `README.md`, `plans/reports/260805-app-real-document-dogfood.md`
      Acceptance criteria: staging migration has zero orphan documents, every legacy document opens under its Personal project, cross-account access is denied, quota is correct, real creation/edit/recompile remains successful, PWA cache contains no private data, and release/rollback owner signs off in the report.
      Verify: `npx supabase db push` in staging; execute all runbook SQL checks; `npm test`; `npm run lint`; `npm run build`; `cd compile-service && npm test`; repeat Phase 0 browser journey with real services.

## Deferred work

- Supabase Realtime collaboration, cursors/presence, concurrent editor conflict resolution, notifications, and offline editing/sync.
- Workspace invitations, sharing UI, team billing, paid plans, subscriptions, and quota changes beyond free-only daily creation starts.
- Binary asset upload, Supabase Storage, signed URLs, project ZIP export, and actual asset compile integration. The explorer documents rather than pretends to provide this.
- E1b AI-generated multi-file plans/sections/scoped repair; chat-edit for multi-file; E2 outline assembly; OCR; and enabling/changing E7.
- CodeMirror/Monaco, broad template-specific forms beyond CV/letter/exam, full i18n, and any PWA caching of private documents.

## Unresolved questions

1. Confirm production/staging Supabase, Google OAuth, allowed callback URLs, and secure backup access before Phase 1/2 deployment.
2. Confirm the initial 10/day free quota is acceptable before implementing Phase 1 item 5.
3. Confirm legacy file-store data volume/location and whether a production export is available for Phase 5 migration rehearsal.
