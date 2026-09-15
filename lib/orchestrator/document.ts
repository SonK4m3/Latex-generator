// lib/orchestrator/document.ts
import type {
  CompileResult,
  DocType,
  DocumentRequest,
  DocumentResult,
  DocumentMetadata,
  EditRequest,
  TemplateId,
} from "@/lib/types/document";
import type {
  SourceFile,
  RetrievedChunk,
  ProjectFile,
} from "@/lib/types/document";
import type { GenerateInput, GenerateOutcome, LatexProvider } from "@/lib/ai/types";
import {
  validateLatex,
  diagnosticsToLog,
  type ValidationResult,
  type ValidateOptions,
} from "@/lib/validation/validate";
import { truncateLog } from "@/lib/orchestrator/truncateLog";
import { getTemplate, wrapBodyInTemplate } from "@/lib/templates/registry";
import { convertMarkdownToLatexBody } from "@/lib/markdown/markdown-to-latex";
import { validateProject } from "@/lib/store/project-document";
import { detectErrorType } from "@/lib/ai/prompts/repair-latex";
import type { LogFields } from "@/lib/log";
import { buildBlueprint } from "@/lib/document-blueprint/build-blueprint";
import { assembleContext } from "@/lib/context-engineering/pipeline";

export interface OrchestratorDeps {
  provider: LatexProvider;
  compile: (latex: string) => Promise<CompileResult>;
  /** Compile dự án multi-file (E1). Bắt buộc cho runProject; không cần cho luồng single-file. */
  compileProject?: (
    files: ProjectFile[],
    rootFile: string,
  ) => Promise<CompileResult>;
  /** Optional custom validator — receives same options as validateLatex(). */
  validate?: (latex: string, options?: ValidateOptions) => ValidationResult;
  maxAttempts: number;
  /** RAG (E3, tuỳ chọn): chọn chunk nguồn liên quan trước khi generate. null ⇒ nhồi thẳng sources. */
  retrieve?: (
    description: string,
    sources: SourceFile[],
  ) => Promise<RetrievedChunk[] | null>;
  /**
   * Observability (BE-5.3.2, optional — mặc định không log gì, giữ hành vi hiện tại cho mọi test/
   * eval tooling không truyền field này). Route (caller) tự quyết định requestId được gắn thế nào
   * (xem buildOrchestratorDeps(requestId) ở lib/orchestrator/deps.ts) — orchestrator chỉ biết gọi
   * deps.logger?.(event, fields), không biết/không cần biết requestId là gì (DI, tách rời tầng
   * "quyết định log cái gì" khỏi tầng "quyết định log đi đâu/kèm gì").
   */
  logger?: (event: string, fields: LogFields) => void;
}

/**
 * Trạng thái bước GỬI CHO CLIENT (khác deps.logger — đó là observability server-side, không phải
 * cho UI). Dùng để hiện "đang phân tích / đang sinh LaTeX / đang biên dịch / đang tự sửa lỗi (lần
 * N)" trong chat, thay cho 1 spinner tĩnh duy nhất — phản hồi phản hồi thật của người dùng khi
 * dogfood: "trong chat lại không cho xem các step, phải đợi gen ra hết rồi mới được xem".
 */
export type StepStatus =
  | { step: "analyzing" }
  | { step: "generating" }
  | { step: "compiling" }
  | { step: "repairing"; attempt: number; errorType: string };

export type OnStepStatus = (status: StepStatus) => void;

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/**
 * Số lần retry tối đa khi generation bị CẮT CỤT (finishReason:"length") — KHÔNG liên quan tới
 * maxAttempts của runRepairLoop (đó là số lần thử SỬA LỖI COMPILE của một document HOÀN CHỈNH).
 * Truncation nghĩa là chưa có document hoàn chỉnh để mà compile/repair — phải xử lý TRƯỚC.
 */
const MAX_TRUNCATION_RETRIES = 2;

/** Hệ số tăng maxOutputTokens mỗi lần retry do bị cắt cụt (Strategy A — "increase budget adaptively"). */
const TRUNCATION_TOKEN_MULTIPLIER = 1.5;

/**
 * Base token budget khi không biết cấu hình thật của provider (orchestrator không phụ thuộc
 * trực tiếp vào lib/config — nhận mọi thứ qua OrchestratorDeps, đúng nguyên tắc DI hiện có).
 * Giá trị này chỉ là ĐIỂM KHỞI ĐẦU cho multiplier — không cần khớp chính xác AI_MAX_TOKENS thật,
 * vì retry sẽ tự tăng dần nếu vẫn bị cắt. Khớp với default trong vercel-provider.ts/mock.ts.
 */
const DEFAULT_BASE_MAX_TOKENS = 8192;

/**
 * Gọi provider.generate() với TRUNCATION RECOVERY — tách biệt hoàn toàn khỏi runRepairLoop.
 *
 * Lý do tách riêng (không đưa vào runRepairLoop):
 *   - Compile error = "document HOÀN CHỈNH nhưng compile thất bại" → cần diagnose + minimal patch.
 *   - Truncation    = "generation CHƯA HOÀN THÀNH" → không nên compile/validate một document chưa
 *     đầy đủ (chắc chắn thiếu \end{document}, dễ gây validate/compile error KHÔNG PHẢI lỗi thật của
 *     nội dung — chỉ là hệ quả của việc bị cắt giữa đường).
 *
 * Strategy áp dụng (theo thứ tự, xem changelog.md E6): tăng token budget có kiểm soát trước
 * (Strategy A) — KHÔNG tự động chuyển sang section-by-section generation ở đây (đó là Strategy B,
 * cần Request Understanding/E1 multi-file, chưa làm) — continuation ghép nối (Strategy C) cũng
 * KHÔNG làm ở đây vì rủi ro duplicate/broken context với LaTeX đã được nêu trong phân tích.
 *
 * finishReason khác "stop"/"length" (content-filter, tool-calls, error, other) KHÔNG được retry mù
 * quáng ở đây — trả nguyên outcome để lớp gọi (runDocument/...) quyết định (hiện tại: coi như "stop"
 * và để runRepairLoop xử lý qua validate/compile như bình thường, vì các finishReason này hiếm gặp
 * trong luồng generate LaTeX thuần và không có chiến lược đặc thù đã được thiết kế).
 */
export async function generateWithTruncationRecovery(
  provider: LatexProvider,
  baseInput: GenerateInput,
  baseMaxTokens: number = DEFAULT_BASE_MAX_TOKENS,
  logger?: (event: string, fields: LogFields) => void,
): Promise<GenerateOutcome> {
  let currentMaxTokens = baseMaxTokens;
  let outcome = await provider.generate(baseInput);

  let retries = 0;
  while (outcome.finishReason === "length" && retries < MAX_TRUNCATION_RETRIES) {
    retries += 1;
    currentMaxTokens = Math.round(currentMaxTokens * TRUNCATION_TOKEN_MULTIPLIER);
    logger?.("orchestrator.truncation_retry", {
      retries,
      currentMaxTokens,
      finishReason: outcome.finishReason,
    });
    outcome = await provider.generate({
      ...baseInput,
      maxTokensOverride: currentMaxTokens,
    });
  }

  return outcome;
}

function extractPackages(latex: string): string[] {
  const set = new Set<string>();
  const re = /\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(latex))) {
    for (const p of m[1].split(",")) set.add(p.trim());
  }
  return [...set];
}

function metadataFor(
  latex: string,
  docType: DocType,
  templateId?: TemplateId,
): DocumentMetadata {
  return {
    engine: "xetex",
    template: docType,
    templateId,
    packages: extractPackages(latex),
  };
}

/**
 * Vòng lặp validate → compile → patch DÙNG CHUNG cho cả generate và edit.
 * `initialLatex` là LaTeX xuất phát; `regenerate(prev, log)` được gọi để sửa lỗi.
 * `attempts` = số lần sinh/sửa LaTeX. Bị chặn cứng bởi maxAttempts (không vô hạn).
 *
 * Template integration:
 *   - packageAllowlist: passed to validateLatex() — rejects unapproved packages before Tectonic.
 *   - templateRepairHints: forwarded to regenerate() → buildRepairPrompt() via GenerateInput.
 */
async function runRepairLoop(
  initialLatex: string,
  regenerate: (previousLatex: string, errorLog: string) => Promise<string>,
  docType: DocType,
  deps: OrchestratorDeps,
  templateId?: TemplateId,
  compileFn?: (latex: string) => Promise<CompileResult>,
  onStepStatus?: OnStepStatus,
): Promise<DocumentResult> {
  const tpl = templateId ? getTemplate(templateId) : undefined;
  const validateOpts = {
    packageAllowlist: tpl?.packageAllowlist,
    knownTheoremEnvironments: tpl?.knownTheoremEnvironments,
  };
  const validate = (latex: string) =>
    (deps.validate ?? validateLatex)(latex, validateOpts);
  const compile = compileFn ?? deps.compile;
  const maxAttempts = Math.max(1, deps.maxAttempts);

  let attempts = 1;
  let latex = initialLatex;
  let lastLog = "";

  for (;;) {
    // 1) AST validation + package allowlist check (cheap) before Tectonic.
    const v = validate(latex);
    if (!v.ok) {
      lastLog = diagnosticsToLog(v.diagnostics);
    } else {
      // 2) Compile (final source of truth).
      onStepStatus?.({ step: "compiling" });
      const c = await compile(latex);
      if (c.success) {
        deps.logger?.("orchestrator.repair_success", { attempts, docType });
        return {
          latex,
          pdfBase64: toBase64(c.pdf),
          attempts,
          metadata: metadataFor(latex, docType, templateId),
        };
      }
      lastLog = truncateLog(c.log);
    }

    const errorType = detectErrorType(lastLog);
    deps.logger?.("orchestrator.repair_attempt", { attempts, errorType });

    // Out of attempts → business failure (HTTP 200 at route).
    if (attempts >= maxAttempts) {
      deps.logger?.("orchestrator.repair_exhausted", { attempts, docType });
      return {
        error:
          "Không tạo được PDF sau nhiều lần thử. Bạn có thể chỉnh mã LaTeX dưới đây hoặc thử lại.",
        latex,
        log: lastLog,
        attempts,
      };
    }

    // 3) Patch: send log/diagnostics to provider for repair.
    attempts += 1;
    onStepStatus?.({ step: "repairing", attempt: attempts, errorType });
    latex = await regenerate(latex, lastLog);
  }
}

/**
 * [DEPRECATED] Orchestrator cũ: sinh 1 lèo từ đầu đến cuối.
 * Sẽ được thay thế bằng các handle* trong kiến trúc State Machine.
 * Orchestrator: generate → AST validate → compile → patch, tối đa maxAttempts.
 * `attempts` = số lần generate. Happy path = 1. Trả DocumentResponse hoặc DocumentError.
 */
export async function runDocument(
  req: DocumentRequest,
  deps: OrchestratorDeps,
  onChunk?: (text: string) => void,
  onCompileStart?: () => void,
  onStepStatus?: OnStepStatus,
): Promise<DocumentResult> {
  onStepStatus?.({ step: "analyzing" });

  // RAG (E3): chọn chunk nguồn liên quan TRƯỚC khi generate (embedding bất đồng bộ).
  let retrievedSources: RetrievedChunk[] | undefined;
  if (deps.retrieve && req.sources && req.sources.length > 0) {
    const r = await deps.retrieve(req.description, req.sources);
    if (r && r.length > 0) retrievedSources = r;
  }

  const tpl = req.template ? getTemplate(req.template) : undefined;
  const templateRepairHints = tpl?.repairHints;

  // Context Engineering (lib/context-engineering) — deterministic pipeline for the INITIAL generate.
  // buildBlueprint is a deterministic (no-LLM) adapter; assembleContext returns null for templates
  // without authored blocks, in which case the provider falls back to the legacy prompt path.
  const baseGenerateInput: GenerateInput = {
    description: req.description,
    docType: req.docType,
    template: req.template,
    sources: req.sources,
    retrievedSources,
    onChunk,
  };
  const blueprint = buildBlueprint(baseGenerateInput);
  const assembled = assembleContext({
    blueprint,
    description: req.description,
    sources: req.sources,
    retrievedSources,
  });
  if (assembled) {
    // Flat, content-free trace (no description/topic/latex — those are redacted by lib/log anyway).
    deps.logger?.("context.assembled", {
      requestId: blueprint.requestId,
      templateId: blueprint.templateId,
      capabilities: blueprint.capabilities.join(","),
      selectedBlockIds: assembled.trace.selectedBlocks.map((b) => b.id).join(","),
      droppedBlockIds: assembled.trace.droppedBlocks
        .map((d) => `${d.id}:${d.reason}`)
        .join(","),
      estimatedInputTokens: assembled.trace.estimatedInputTokens,
    });
  }

  onStepStatus?.({ step: "generating" });

  const initialOutcome = await generateWithTruncationRecovery(
    deps.provider,
    { ...baseGenerateInput, renderedPrompt: assembled?.rendered },
    undefined,
    deps.logger,
  );

  if (assembled) {
    deps.logger?.("context.usage", {
      requestId: blueprint.requestId,
      finishReason: initialOutcome.finishReason,
      inputTokens: initialOutcome.usage?.inputTokens,
      outputTokens: initialOutcome.usage?.outputTokens,
      totalTokens: initialOutcome.usage?.totalTokens,
    });
  }

  const initial = initialOutcome.latex;

  onCompileStart?.();

  return runRepairLoop(
    initial,
    async (previousLatex, errorLog) =>
      (
        await generateWithTruncationRecovery(
          deps.provider,
          {
            description: req.description,
            docType: req.docType,
            template: req.template,
            sources: req.sources,
            retrievedSources,
            errorContext: { previousLatex, errorLog },
            templateRepairHints,
          },
          undefined,
          deps.logger,
        )
      ).latex,
    req.docType,
    deps,
    req.template,
    undefined,
    onStepStatus,
  );
}

/**
 * E5 — Tạo tài liệu từ MARKDOWN bằng converter TẤT ĐỊNH:
 * convert (MD→body) → wrap preamble template → AST validate → compile → patch.
 * Bước sinh ban đầu KHÔNG gọi AI (tất định); repair loop dùng AI CHỈ để sửa lỗi compile
 * (SYSTEM_PROMPT cấm đổi ý đồ nội dung → không "sáng tác thêm").
 * `req.markdown` bắt buộc; `req.template` quyết định preamble + heading (chapter/section).
 */
export async function runDocumentFromMarkdown(
  req: DocumentRequest,
  deps: OrchestratorDeps,
  onChunk?: (text: string) => void,
  onCompileStart?: () => void,
  onStepStatus?: OnStepStatus,
): Promise<DocumentResult> {
  onStepStatus?.({ step: "generating" });
  const template = req.template;
  const tpl = template ? getTemplate(template) : undefined;
  const documentClass = tpl?.documentClass ?? "article";
  const templateRepairHints = tpl?.repairHints;

  const { body, requiredPackages, warnings } = convertMarkdownToLatexBody(
    req.markdown ?? "",
    { documentClass },
  );
  const initial = template
    ? wrapBodyInTemplate(template, body, requiredPackages)
    : [
        "\\documentclass{article}",
        "\\usepackage{fontspec}",
        ...requiredPackages.map((p) => `\\usepackage{${p}}`),
        "\\begin{document}",
        body,
        "\\end{document}",
        "",
      ].join("\n");

  onCompileStart?.();

  const result = await runRepairLoop(
    initial,
    async (previousLatex, errorLog) =>
      (
        await generateWithTruncationRecovery(
          deps.provider,
          {
            description: "",
            docType: req.docType,
            template: req.template,
            errorContext: { previousLatex, errorLog },
            templateRepairHints,
            onChunk,
          },
          undefined,
          deps.logger,
        )
      ).latex,
    req.docType,
    deps,
    req.template,
    undefined,
    onStepStatus,
  );

  if (warnings.length > 0) result.warnings = warnings;
  return result;
}

/**
 * E1 — Compile & sửa lỗi một DỰ ÁN multi-file.
 * Kiểm path an toàn (`validateProject`) → compile CẢ dự án (`deps.compileProject`) → nếu lỗi, AI sửa
 * FILE GỐC (các file phụ giữ nguyên). GIỚI HẠN v1: repair chỉ nhắm file gốc; lỗi nằm trong file phụ
 * phải sửa thủ công. Yêu cầu `deps.compileProject`.
 */
export async function runProject(
  req: {
    files: ProjectFile[];
    rootFile: string;
    docType: DocType;
    template?: TemplateId;
  },
  deps: OrchestratorDeps,
  onChunk?: (text: string) => void,
  onCompileStart?: () => void,
): Promise<DocumentResult> {
  if (!deps.compileProject) {
    throw new Error("runProject cần deps.compileProject");
  }
  const compileProjectDep = deps.compileProject;

  const validation = validateProject(req.files, req.rootFile);
  if (!validation.ok) {
    return { error: validation.error, attempts: 1 };
  }
  const { files, rootFile } = validation;
  const rootLatex = files.find((f) => f.path === rootFile)?.content ?? "";
  const tpl = req.template ? getTemplate(req.template) : undefined;
  const templateRepairHints = tpl?.repairHints;

  const compileFn = (latex: string): Promise<CompileResult> => {
    const projectFiles = files.map((f) =>
      f.path === rootFile ? { ...f, content: latex } : f,
    );
    return compileProjectDep(projectFiles, rootFile);
  };

  onCompileStart?.();

  return runRepairLoop(
    rootLatex,
    async (previousLatex, errorLog) =>
      (
        await generateWithTruncationRecovery(
          deps.provider,
          {
            description: "",
            docType: req.docType,
            template: req.template,
            errorContext: { previousLatex, errorLog },
            templateRepairHints,
            onChunk,
          },
          undefined,
          deps.logger,
        )
      ).latex,
    req.docType,
    deps,
    req.template,
    compileFn,
  );
}

/**
 * Chỉnh sửa tài liệu ĐÃ CÓ theo chỉ thị người dùng (chat-edit):
 * generate(editContext) → AST validate → compile → patch, tối đa maxAttempts.
 * Trả DocumentResponse (LaTeX + PDF mới) hoặc DocumentError (giữ LaTeX gần nhất).
 */
export async function runEdit(
  req: EditRequest,
  deps: OrchestratorDeps,
  onChunk?: (text: string) => void,
  onCompileStart?: () => void,
): Promise<DocumentResult> {
  const tpl = req.template ? getTemplate(req.template) : undefined;
  const templateRepairHints = tpl?.repairHints;

  const initial = (
    await generateWithTruncationRecovery(
      deps.provider,
      {
        description: "",
        docType: req.docType,
        template: req.template,
        editContext: {
          currentLatex: req.currentLatex,
          instruction: req.instruction,
        },
        onChunk,
      },
      undefined,
      deps.logger,
    )
  ).latex;

  onCompileStart?.();

  return runRepairLoop(
    initial,
    async (previousLatex, errorLog) =>
      (
        await generateWithTruncationRecovery(
          deps.provider,
          {
            description: "",
            docType: req.docType,
            template: req.template,
            errorContext: { previousLatex, errorLog },
            templateRepairHints,
          },
          undefined,
          deps.logger,
        )
      ).latex,
    req.docType,
    deps,
  );
}

// ============================================================================
// Kiến trúc Document State Machine (New Handlers)
// ============================================================================

import type { DocumentStatus } from "@/lib/types/document";

/**
 * Trạng thái trung gian khi thực thi từng bước của State Machine
 */
export interface StateMachineResult {
  nextStatus: DocumentStatus;
  planContent?: string;
  latex?: string;
  pdfBase64?: string;
  log?: string;
  error?: string;
  attempts?: number;
}

/**
 * Bước 1: Phân tích (Preflight)
 * AI sẽ kiểm tra xem yêu cầu đã đủ chưa (Bypass nếu đủ).
 */
export async function handleAnalyze(
  req: DocumentRequest,
  deps: OrchestratorDeps
): Promise<StateMachineResult> {
  // TODO: Tích hợp logic Understand Request (Preflight thực tế). 
  // Tạm thời, nếu description quá ngắn -> CLARIFYING. Dài -> PLANNED.
  const isDetailed = req.description.length > 50; 
  if (isDetailed) {
    return { nextStatus: "PLANNED" };
  }
  return { nextStatus: "CLARIFYING" };
}

/**
 * Bước 3: Lên dàn ý (Plan)
 * Sinh ra dàn ý bằng tiếng Việt/Anh để người dùng duyệt trước khi sinh LaTeX.
 */
export async function handlePlan(
  req: DocumentRequest,
  deps: OrchestratorDeps
): Promise<StateMachineResult> {
  const planPrompt: GenerateInput = {
    description: `Vui lòng lập một dàn ý chi tiết bằng Markdown cho tài liệu sau (không viết mã LaTeX, chỉ viết dàn ý các mục chính):\n\n${req.description}`,
    docType: req.docType,
    template: req.template,
    maxTokensOverride: 1000,
  };
  const planOutcome = await deps.provider.generate(planPrompt);
  return {
    nextStatus: "PLANNED",
    planContent: planOutcome.latex, // Tái sử dụng field latex của outcome
  };
}

/**
 * Bước 4: Sinh mã LaTeX từ dàn ý đã duyệt.
 */
export async function handleGenerate(
  req: DocumentRequest,
  planContent: string,
  deps: OrchestratorDeps,
  onChunk?: (text: string) => void
): Promise<StateMachineResult> {
  const blueprint = buildBlueprint({ ...req });
  const assembled = assembleContext({
    blueprint,
    description: req.description + `\n\nDàn ý cần tuân thủ:\n${planContent}`,
    sources: req.sources,
  });

  const generateInput: GenerateInput = {
    description: req.description,
    docType: req.docType,
    template: req.template,
    renderedPrompt: assembled?.rendered,
    onChunk,
  };

  const outcome = await generateWithTruncationRecovery(
    deps.provider,
    generateInput,
    undefined,
    deps.logger
  );

  return {
    nextStatus: "REVIEWING",
    latex: outcome.latex,
    attempts: 1,
  };
}

/**
 * Bước 5 & 6: Tự động review mã LaTeX và biên dịch.
 * Sử dụng vòng lặp runRepairLoop hiện tại để tự review (validate) + compile.
 */
export async function handleReviewAndCompile(
  initialLatex: string,
  req: DocumentRequest,
  deps: OrchestratorDeps,
  onStepStatus?: OnStepStatus
): Promise<StateMachineResult> {
  const result = await runRepairLoop(
    initialLatex,
    async (previousLatex, errorLog) =>
      (
        await generateWithTruncationRecovery(
          deps.provider,
          {
            description: req.description,
            docType: req.docType,
            template: req.template,
            errorContext: { previousLatex, errorLog },
          },
          undefined,
          deps.logger
        )
      ).latex,
    req.docType,
    deps,
    req.template,
    undefined,
    onStepStatus
  );

  if (isDocumentError(result)) {
    return {
      nextStatus: "REVIEWING", // Vẫn kẹt ở Reviewing hoặc thất bại
      latex: result.latex,
      log: result.log,
      error: result.error,
      attempts: result.attempts,
    };
  }

  return {
    nextStatus: "EXPORTABLE",
    latex: result.latex,
    pdfBase64: result.pdfBase64,
    attempts: result.attempts,
  };
}
