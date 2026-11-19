# System Architecture

## 1. Overview
The system is divided into three main components: a Next.js frontend/BFF, a Node.js-based LaTeX
compilation service, and a dev-time prompt evaluation platform (not deployed to production).

## 2. Components
### 2.1 Next.js Application (BFF & UI)
- Handles user authentication (Supabase), document storage, and chat state.
- Communicates with external LLM APIs (via Vercel AI SDK — Anthropic-compatible providers) to
  translate natural language to LaTeX.
- Orchestrates the auto-repair loop when compilation fails, and — separately — a truncation
  recovery step when generation itself is cut off before completion (`finishReason === "length"`).
  These are two distinct failure modes handled by two distinct mechanisms:
  - **Truncation recovery** (`generateWithTruncationRecovery()` in `lib/orchestrator/document.ts`):
    runs *before* validation/compilation. Retries the same generation with an increased token
    budget (×1.5, up to 2 retries). Does not count against repair attempts, because there is no
    complete document yet to diagnose.
  - **Repair loop** (`runRepairLoop()`): runs *after* a complete document fails validation
    (`lib/validation/validate.ts` — package allowlist, theorem environment consistency, broken
    cross-references) or fails to compile. Feeds the error log back to the AI for a minimal fix,
    up to `maxAttempts` times.
- Reads AI provider signals honestly: `LatexProvider.generate()` returns a `GenerateOutcome`
  (`latex` + `finishReason` + `rawFinishReason` + token `usage`), not just a raw string — so the
  orchestrator can distinguish "incomplete generation" from "complete but broken output" instead
  of guessing from output length.

### 2.2 Compile Service (Sandbox)
- A stateless, sandboxed Express server running inside Docker (or locally via CLI).
- Receives LaTeX source code.
- Executes `tectonic --untrusted` to compile the source to PDF, with automatic V2-to-V1 fallback
  and local package caching for performance.
- Returns either a base64-encoded PDF or the compilation error logs.
- Resources are limited (1GB RAM, 1 CPU, non-root, read-only filesystem except for output).

### 2.3 Caddy (Reverse Proxy)
- Acts as the single entry point.
- Provides TLS termination (Let's Encrypt).
- Routes traffic to the Next.js app.

### 2.4 Prompt Evaluation Platform (`lib/prompt-eval/`, dev-time only)
- Uses Promptfoo to measure template/prompt quality on a fixed dataset (`datasets/global/`,
  `datasets/math/`), independent of the production request path.
- Two provider modes, same dataset: `MockProvider`-backed (deterministic, $0 cost — safe for
  CI/regression) and real-AI-backed (calls the actual `getProvider()` factory + `.env` config,
  costs real API quota — used to measure actual quality, not just structural contract).
- Custom scorers reuse production code directly instead of reimplementing checks
  (`validate-latex.ts` calls the real `validateLatex()`; `compile-success.ts` calls the real
  compile client). The real-AI provider (`math-real-ai-provider.ts`) also reuses
  `generateWithTruncationRecovery()` from the orchestrator, so the eval measures the same
  behavior end users get — not a simplified stand-in.
- Results are archived as Markdown reports under `results/` for traceability; raw JSON output
  from each run is discarded after extraction.

## 3. Data Flow
1. User submits a request via the Next.js UI (`components/`), authenticated through Supabase.
2. Next.js API route calls the AI Provider to generate LaTeX, going through
   `generateWithTruncationRecovery()` first to guarantee a complete generation before anything
   downstream runs.
3. `lib/validation` checks structure (package allowlist, theorem environments, cross-references)
   before ever reaching the compiler.
4. Next.js sends the LaTeX to the Compile Service and streams status via Server-Sent Events (SSE)
   back to the client.
5. Compile Service returns a PDF or error.
6. If validation or compilation fails on a complete document, Next.js enters the repair loop with
   the AI Provider (bounded by `maxAttempts`, separate from truncation retries).
7. The final PDF is returned to the UI.

## 4. MCP compile workflow

The plugin sends complete LaTeX to the Next.js Streamable HTTP route at `/api/mcp`.
Supabase OAuth identifies the user and the PostgreSQL queue admits jobs with a per-user
quota and an idempotency key. A separate worker calls the existing Tectonic service.
The worker publishes the document and its immutable PDF snapshot in one transaction.
Clients poll for status and request a short-lived, single-use link to the snapshot.
See the [local setup guide](deployment-guide.md) for the OAuth and worker setup.

For edits to an existing document, MCP reads the saved source and passes its
revision timestamp to `update_document_source`. Single-file edits send complete LaTeX;
project edits send `{path, content}` patches for existing readable text files only.
The project RPC locks the owner-scoped document, checks its active OAuth consent and
exact revision, then merges requested content into the stored JSONB array. Read and
job/artifact RPC boundaries also check the live consent, so revoking the one plugin
consent blocks subsequent MCP and direct database calls. It does not
replace the project file list, so binary assets and untouched file metadata stay intact.
Project structure and root path cannot be changed through this tool. When the root is
patched, the legacy `latex` field is synchronized and the previous PDF is invalidated.

The web source editors can also copy a versioned selection context containing the document ID,
saved revision, file path, UTF-16 range, exact selected source, and bounded prefix/suffix anchors.
The `edit_document_selection` MCP tool accepts that context plus replacement text. It reads the
owner-scoped current source, rejects stale revisions or any range/anchor mismatch, then writes the
single resulting file through the same consent-checked compare-and-set path. A concurrent edit
therefore returns a conflict instead of moving the edit to a guessed location. Existing Realtime
revision notices update the open web workspace; the new revision must be compiled there to refresh
the PDF.

The PDF preview is currently a browser iframe and does not expose selectable PDF nodes or map page
coordinates back to LaTeX. Selection context therefore targets source ranges in this iteration.
Direct PDF box selection needs a PDF.js renderer and a SyncTeX-based PDF-to-source mapping.

The document trigger publishes a small revision notice through Supabase Realtime. The
open web editor receives the notice over WebSocket and reads the current document
through its authenticated API. Each notice represents a saved revision. Recompile the
updated source in the editor to refresh the PDF preview.
