# Discovery Report — Chat UX, Platform, Frontend Maturity

## Evidence reviewed
- Product/roadmaps: `README.md`, `docs/{project-roadmap,backend-roadmap,frontend-roadmap,feature-tracking,student-journey-tracking}.md`, `PRODUCT.md`, `DESIGN.md`.
- Creation flow: `app/app/page.tsx`, `components/{HomeClient,ChatAssistant,useDocumentGenerationChat,ChatMessageItem,ResultPanel}.tsx`, `app/api/documents/route.ts`.
- Platform: `proxy.ts`, `utils/supabase/middleware.ts`, `lib/auth/current-user.ts`, `app/{login,auth/callback}/`, `lib/store/supabase-document-store.ts`, migrations `0001`–`0003`.
- Workspace/project: `components/{DocumentWorkspace,ProjectFileEditor,DocumentList}.tsx`, `app/api/documents/[id]/route.ts`, `lib/types/document.ts`.
- Existing tests/config: `package.json`, `vitest.config.ts`, integration/component tests listed in plan.

## Current state
1. `/app` already is chat + live result preview: `HomeClient` renders a responsive two-column layout at `lg`, `ChatAssistant` streams status, and its last completed item is shown in `ResultPanel` without navigation. `ChatMessageItem` names analysis/generation/compile/repair stages. This directly addresses the three prior dogfood findings recorded on 2026-08-05: undersized chat/no preview, opaque waiting, and forced navigation.
2. It remains desktop-first: chat uses `h-[78vh] min-h-[520px]`; preview/list stack below it on narrow viewports. The project editor is a flat tab strip with `prompt`/`confirm`, no keyboard model or tree/assets surface. `workspace-store` only persists PDF/source tab globally.
3. Supabase email/password auth, callback exchange, document CRUD, session refresh, and document RLS exist. Pages and document routes also independently call `getCurrentUserId`. `proxy.ts` runs `updateSession`; the current public-path list omits `/`, conflicting with the intentionally public landing page. APIs correctly remain JSON-401 based.
4. Password reset, password update screen, OAuth initiation, account settings, quota accounting, workspace/project tables, membership RLS, and a verified file-to-Supabase migration do not exist. `0003_documents_is_project_column.sql` is committed but documented as not applied live.
5. Documents are only directly owner-scoped. Multi-file is an attribute of a document, not a shared project/domain model. The current `ProjectFile` contract technically permits `contentBase64`, but UI/API E1a deliberately accept only `.tex`; asset storage/upload is not implemented.
6. SEO is limited to basic metadata; document language is `en` despite Vietnamese-first product copy. There is no manifest, install path, social image, service worker, or offline policy. No WCAG target is defined.
7. Existing SSE is the justified realtime mechanism for individual generate/chat-edit status. Supabase Realtime collaboration/presence would add conflict resolution and privacy complexity before projects/memberships have evidence of real multi-user demand; it is deferred.

## Decisions to carry into implementation
- Use `proxy.ts` (Next 16) as one declarative UI-route protection policy: public `/`, `/login`, `/auth/**`; protected `/app/**`, `/documents/**`, future `/settings/**`; APIs retain route-level authorization and JSON 401/403.
- Implement Supabase password reset plus Google OAuth only. OAuth provider enablement/redirect allow-list is a deployment prerequisite, and no GitHub flow is added without demand.
- Add a free-only account model. Enforce 10 successful creation starts per authenticated user per UTC day atomically in Postgres before AI work; show remaining allowance. Manual recompile/chat edit remain unmetered and billing/subscriptions are excluded.
- Establish workspace as the authorization boundary, project as its container, and document as project content. During migration create each legacy owner’s Personal workspace and one project for each existing document, retaining nullable legacy fields only until verification completes. RLS is membership-based with owner/editor/viewer roles; this release exposes only owner UX, not sharing/invites.
- Specialized UI forms are limited to CV, formal letter, and exam, and serialize to the current `description` request contract. Natural language remains available for every template; forms do not introduce a competing persistence model or enable E7.
- Make `/app` responsive and accessible before adding broad visual features. Target WCAG 2.2 AA, including keyboard-only flows, visible focus, status announcements, and 44px touch targets.
- Ship an installable, online-first PWA. Cache public static shell only; never cache authenticated documents, PDFs, tokens, source text, or API responses offline. Binary project assets and Supabase Storage integration are deferred.

## Unresolved questions
- Confirm Supabase project credentials, Google OAuth client/redirect configuration, and a safe staging database before migrations are applied.
- Confirm whether the free quota should be 10 creations/day or a different commercial limit before release; this plan uses 10 as the implemented initial policy.
- Confirm whether existing file-store data can be exported/read in the migration environment; no production data was inspected.
