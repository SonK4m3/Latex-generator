# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Primary: Vietnamese students and researchers (sinh viên / nghiên cứu sinh) writing theses, academic papers, reports, and problem sets who need LaTeX output but do not want to hand-write LaTeX syntax. They work in Vietnamese and/or English, often iterating over multiple sessions on a long document (thesis chapters), and need to keep documents across sessions/devices (auth + persistent storage).

Secondary: anyone needing a quick LaTeX document from a natural-language description across non-thesis use cases — reports, math/physics/chemistry problem sets, engineering docs, Beamer slides, letters/CVs, exams.

## Product Purpose
Translates natural-language descriptions (Vietnamese or English) into compiled LaTeX PDFs plus editable LaTeX source. Removes the need to know LaTeX syntax while still producing a real, safely-compiled document rather than LaTeX-looking text that may not compile.

## Positioning
"Actually compiles." The differentiator is the safe, sandboxed compilation pipeline (Tectonic `--untrusted` in a restricted Docker sandbox, no shell access) combined with a self-healing repair loop that automatically detects and fixes compilation errors. A generic LLM chat can produce LaTeX-looking output that silently fails to compile; this product's core claim is a working PDF, verified by real compilation, with automatic recovery when the first attempt fails.

## Operating Context
- User describes a document in natural language (VI/EN); system selects a template (article/report/beamer/exam/letter class family: academic, thesis, math, physics, chemistry, engineering, presentation, letter/CV, exam) and generates LaTeX.
- Structural validation happens before compilation attempt.
- Compilation runs in an isolated compile-service (Node/Express + Tectonic) behind a reverse proxy (Caddy); the app itself and compile-service are not exposed directly.
- Real-time compiling/status updates stream to the UI via SSE (no polling).
- Users iterate via chat-based natural-language edits or direct manual source edits, then recompile.
- Documents are persisted per authenticated user (Supabase auth + configurable storage backend: file-based `DATA_DIR` by default, or Supabase Postgres with RLS) so a thesis-in-progress survives across sessions/devices.
- Multi-file/multi-chapter project support exists for longer documents (thesis workflows) with manual per-file editing; AI-driven generation of multi-file projects and image/asset embedding are not yet wired into the create flow (tracked as in-progress in `docs/student-journey-tracking.md`).
- RAG-based source-grounding (upload references → AI cites from them) exists in code but is off by default (mock embeddings); real BibTeX/`\cite` bibliography management is not yet implemented (currently manual `thebibliography`).

## Capabilities and Constraints
- Confirmed functionality: natural-language → LaTeX generation, multi-template support, safe sandboxed compilation, auto-repair loop on compile errors, CRUD on stored documents, chat-based iterative editing, manual source editing, SSE-based real-time status.
- Technical constraints: Next.js 16 (App Router) + React 19 frontend/orchestrator; compile-service is Node/Express + Tectonic in Docker, non-root, read-only filesystem, resource-limited (mem 1g / cpu 1.0 / pids 256), no shell-escape; pluggable AI provider architecture (Anthropic/OpenAI/Google/SotaTek proxies/mock).
- Undecided/open (per `docs/project-roadmap.md` "Unresolved questions"): embedding provider for real RAG (local `transformers` vs OpenAI), bibliography approach (BibTeX+biblatex vs continued manual `thebibliography`), and whether PDFs are stored in Supabase Storage vs kept in DB going forward.
- Language: Vietnamese and English are both first-class input languages; UI copy conventions and code comments are in English per project convention, but user-facing generation/chat is bilingual.

## Brand Commitments
None confirmed yet — no fixed name treatment, logo, or voice guide found beyond the working title "AI LaTeX Generator." Not treating this as binding; open for a future design pass.

## Evidence on Hand
- `docs/project-overview-pdr.md` — canonical product description, feature list, tech stack, architecture goals.
- `docs/student-journey-tracking.md` — the primary user's (student/NCS) end-to-end journey, tracked group-by-group with real completion status (auth+storage done; export/multi-file-AI-gen/RAG/bibliography still in progress).
- `docs/feature-tracking.md`, `docs/frontend-roadmap.md`, `docs/backend-roadmap.md`, `docs/project-roadmap.md` — phased release planning.
- `docs/testcases/testcases.json` — MVP evaluation test cases (TC-01/02/05) used for generation-quality checks.
- No testimonials, customer names, press mentions, or performance benchmarks exist. Future work must not fabricate any of these.

## Product Principles
1. A produced document must actually compile — correctness of the compiled PDF is the product, not merely LaTeX-looking text.
2. Removing LaTeX syntax knowledge as a barrier, without removing user control — users can always drop to manual source editing.
3. Safety of compilation (sandboxed, non-root, resource-capped, no shell-escape) is non-negotiable and never traded for convenience features.
4. Vietnamese is a first-class language, not an afterthought translation layer.
5. Long-running documents (theses) must survive across sessions and devices — persistence and auth are foundational, not optional add-ons.

## Accessibility & Inclusion
No project-specific accessibility standard has been established yet; no known specific user accessibility needs recorded. Treat as an open gap rather than assuming a standard (e.g. WCAG level) has been targeted.
