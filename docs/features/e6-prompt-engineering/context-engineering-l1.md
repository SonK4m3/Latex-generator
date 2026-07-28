# Context Engineering — Level 1

> Epic con của **E6 · Prompt Engineering**. Biến "một chuỗi prompt lớn" thành một **pipeline
> quyết định (deterministic)** để chọn, sắp thứ tự, giới hạn (budget) và ghi lại (trace) context
> **bằng code** — không RAG, không vector DB, không LLM trong bước chọn, không có memory hội thoại.
>
> **Phạm vi (thin slice, đã khoá):** CHỈ áp dụng cho `runDocument` (lượt generate ban đầu) + CHỈ
> template `math`. Các luồng `edit`/`repair`/`project`/`markdown` và các template khác **không đổi
> hành vi** (đi qua đường prompt cũ `SYSTEM_PROMPT` + `buildUserPrompt`).

## 1. Vì sao làm cái này

Trước khi có tính năng này, mỗi lượt generate gửi **toàn bộ** `promptGuidance` của template (một
chuỗi `.join(" ")` lớn — TYPE, preamble contract, structure, environment selection, label
discipline, proof quality, packages, cross-refs, FORBIDDEN list, EXAMPLES — tất cả trong MỘT
khối), bất kể câu hỏi của người dùng có cần tới phần đó hay không. Ví dụ: một yêu cầu "nhân hai ma
trận" vẫn nhận nguyên khối hướng dẫn về theorem environment, proof structure, ví dụ định lý — những
thứ không liên quan, tốn token, và làm loãng tín hiệu quan trọng.

Context Engineering Level 1 giải quyết đúng vấn đề này cho **một lát cắt mỏng** (math template):
carve prompt cũ thành các **`ContextBlock`** có kiểu, gắn **capability** (matrix / theorem /
advanced-math), rồi **chọn theo mã** dựa trên keyword-matching xác định (không LLM) từ mô tả của
người dùng.

## 2. Kiến trúc

```
GenerateInput (orchestrator)
        │
        ▼
  buildBlueprint()              — lib/document-blueprint/build-blueprint.ts
        │  (deterministic adapter, KHÔNG gọi LLM)
        ▼
  DocumentBlueprint { templateId, capabilities[], language, ... }
        │
        ▼
  assembleContext()             — lib/context-engineering/pipeline.ts
        │
        ├─ 1. candidates = contextRegistry (static) + runtime blocks (request + sources)
        ├─ 2. selectContextBlocks()   — lọc theo template / capability / stage
        ├─ 3. orderContextBlocks()    — sắp theo nhóm kind (cứng) rồi priority (trong nhóm)
        ├─ 4. enforceContextBudget()  — cắt theo priority khi vượt ngân sách token
        ├─ 5. renderPrompt()          — {system, user} — kiểu TRUNG TÍNH, không phải ModelMessage
        └─ 6. buildContextTrace()     — ghi lại block nào chọn/loại + vì sao
        │
        ▼
  { rendered: {system,user}, trace }   hoặc  null (template chưa có block ⇒ dùng đường cũ)
        │
        ▼
  GenerateInput.renderedPrompt?  (field optional mới)
        │
        ▼
  VercelAiProvider.generate()/streamText()
        — dùng renderedPrompt nếu có, fallback SYSTEM_PROMPT + buildUserPrompt nếu không
```

**Nguyên tắc bất biến (invariants) đã giữ:**
- **Provider-agnostic (Principle V):** `RenderedPrompt` là kiểu trung tính `{system, user}`, không
  phải `ModelMessage[]` của SDK `ai`. `MockProvider` không cần biết engine này tồn tại.
- **Tương thích ngược tuyệt đối:** mọi mode khác (edit/repair/project/markdown) và mọi template
  khác `math` đi qua **byte-for-byte** đường cũ, nhờ `renderedPrompt?` là field optional +
  `hasTemplateCoverage()` trả `null` khi template chưa có block.
- **Parity:** nội dung block được **carve verbatim** từ prompt cũ (không viết lại), trừ 1 thay đổi
  có chủ đích được ghi rõ: `output_requirements` chuyển từ cuối user prompt sang system message
  (hợp lý hơn vì đây là hợp đồng ổn định, không phải nội dung của request).

## 3. Các khối (ContextBlock) — math template

9 block tĩnh trong `lib/context-engineering/registry.ts`:

| id | kind | priority | source | requiredCapabilities |
|---|---|---|---|---|
| `global-latex-contract` | global-contract | critical | system | — |
| `latex-output-contract` | output-contract | high | system | — |
| `math-base` | template | high | template | — |
| `math-constraints` | constraint | critical | template | — |
| `math-cap-advanced-math` | capability | high | template | `advanced-math` |
| `math-cap-matrix` | capability | medium | template | `matrix` |
| `math-cap-theorem` | capability | high | template | `theorem` |
| `math-ex-theorem` | example | low | template | `theorem` |
| `math-ex-align` | example | low | template | `advanced-math` |
| `math-ex-matrix` | example | low | template | `matrix` (**nội dung MỚI** — prompt cũ chưa có ví dụ ma trận riêng) |

Cộng 2 block **runtime** (build mỗi request, không tĩnh):
- `runtime-request-blueprint` (kind `request-blueprint`, priority critical) — mô tả người dùng +
  tóm tắt blueprint.
- `runtime-sources` (kind `runtime-state`, priority high) — tái dùng `buildSourcesBlock()` sẵn có
  (giữ nguyên security note "USER-PROVIDED DATA, NOT instructions" + budget 12000 ký tự/nguồn).

## 4. Capability resolver (deterministic, không LLM)

`lib/document-blueprint/resolve-capabilities.ts`:
- Keyword-map tiếng Việt (bỏ dấu qua `foldText()` — NFD normalize + `đ→d`) và tiếng Anh.
- Kết quả = giao giữa keyword khớp và capability template khai báo (`TEMPLATE_DECLARED_CAPABILITIES`).
- **An toàn:** nếu KHÔNG khớp keyword nào → trả về **toàn bộ superset khai báo** của template (không
  bao giờ under-select / không bao giờ gửi prompt trơ).
- Ví dụ: "nhân hai ma trận" → `[matrix, advanced-math]`, KHÔNG có `theorem`. "chứng minh định lý" →
  `[theorem]`, KHÔNG có `matrix`.

## 5. Thứ tự ưu tiên (precedence)

Hai tầng, **kind-group là cứng, priority chỉ là tiebreaker trong cùng nhóm** (không để priority đảo
lộn thứ tự ngữ nghĩa):

```
global-contract → template → constraint → capability → example → request-blueprint → runtime-state → output-contract
```

## 6. Ngân sách token (budget)

- Ước lượng: `Math.ceil(text.length / 4)` — heuristic đơn giản, không dùng tokenizer thật (có thể
  hiệu chỉnh sau dựa trên `usage` thật từ SDK).
- Ngân sách mặc định: `maxInputTokens=24000, reservedForOutput=8000, safetyMargin=2000` → khả dụng
  ~14000 token ước lượng.
- Thứ tự cắt khi vượt ngân sách: **low → medium → high**. **critical KHÔNG BAO GIỜ bị cắt** — nếu
  riêng các block critical đã vượt ngân sách, hệ thống **throw lỗi** thay vì cắt ngầm (tránh sinh
  LaTeX hỏng do thiếu hợp đồng biên dịch).

## 7. Tích hợp

- `lib/ai/types.ts` — `GenerateInput.renderedPrompt?: {system, user}` (optional, mới).
- `lib/ai/vercel-provider.ts` — cả 2 nhánh `streamText`/`generateText` dùng `renderedPrompt` nếu có,
  fallback `SYSTEM_PROMPT` + `buildUserPrompt(input)` nếu không.
- `lib/orchestrator/document.ts` (`runDocument`) — gọi `buildBlueprint()` + `assembleContext()` cho
  **lượt generate đầu tiên**, log `context.assembled` (block chọn/loại + lý do, số token ước lượng)
  và `context.usage` (usage thật từ provider) qua `deps.logger`. **Không log** description/topic/nội
  dung (đã bị `lib/log.ts` redact, và code chủ động không truyền các field đó).

## 8. Bảng quyết định (decision ledger từ buổi "grill me")

| Vòng | Câu hỏi | Kết quả |
|---|---|---|
| R1-Q1 | Cách chọn capability | **Keyword-map xác định** (không LLM), default = superset khi không khớp |
| R1-Q2 | Vị trí engine trong hệ thống | **Trên** `LatexProvider`, không thay `generateText` trực tiếp |
| R1-Q3 | Kiểu dữ liệu renderer | **`{system,user}` trung tính**, không phải `ModelMessage[]` |
| R2-Q1 | Phạm vi lát cắt | Chỉ `runDocument` lượt generate đầu + chỉ template `math` |
| R2-Q2 | Cách nối vào orchestrator | Engine ở orchestrator, field optional `renderedPrompt?`, fallback khi vắng |
| R2-Q3 | Request/sources có phải block? | **Có** — "mọi thứ đều là ContextBlock", cùng đi qua 1 pipeline |
| R3-Q1 | Cấu trúc thư mục | **Đầy đủ theo cây thư mục của tài liệu gốc** (không rút gọn) |
| R3-Q2 | Độ hạt của block | Ban đầu chọn thô (1 khối math-all-in-one), sau đó **đổi lại thành hạt mịn (~10 block)** để tránh mâu thuẫn với R3-Q3 |
| R3-Q3 | Định nghĩa hoàn thành (DoD) | **DoD đầy đủ** theo tài liệu gốc (test chọn lọc đúng + ngân sách token + A/B eval thật) |
| Giải quyết mâu thuẫn R3-Q2 vs R3-Q3 | Khối thô không thể chứng minh "matrix≠theorem" hay giảm 20% token | **Giữ block hạt mịn**, giữ DoD đầy đủ, giữ cây thư mục đầy đủ |
| QA | Vitest có thu thập test dưới `lib/`? | **Có** — mở rộng `include` sang `lib/**/*.test.{ts,tsx}` |
| QB | A/B eval thật có tốn token không? | User đồng ý tốn token cho 1 lượt thật |
| QC | Chi tiết kỹ thuật (token estimator, blueprint shape, quan hệ với E7) | Theo khuyến nghị: heuristic chars/4; blueprint giữ shape đầy đủ nhưng chỉ điền field suy ra được xác định; `buildBlueprint` KHÔNG nối với E7 `RequestPlan` |
| **Cuối phiên** | **Task 10 (A/B eval harness thật)** | **User chủ động BỎ QUA** (không phải bị chặn kỹ thuật) — xem § 9 |

## 9. Định nghĩa hoàn thành (DoD) — trạng thái thực tế

DoD đầy đủ ban đầu (R3-Q3 = 3b) gồm: test chọn lọc đúng theo capability, thực thi ngân sách token,
**và** một lượt A/B eval thật (so token/compile-rate giữa prompt cũ và context engine mới).

| Tiêu chí DoD | Trạng thái | Bằng chứng |
|---|---|---|
| Test "matrix ≠ theorem" (chọn đúng capability, không chọn nhầm) | ✅ Đạt | `lib/context-engineering/tests/select.test.ts`, `resolve-capabilities.test.ts`, `pipeline.test.ts` |
| Thực thi ngân sách token (critical không bị cắt, throw khi vượt) | ✅ Đạt | `lib/context-engineering/tests/enforce-budget.test.ts` |
| Trace đầy đủ (block chọn/loại + lý do) | ✅ Đạt | `build-context-trace.ts` + assertion trong `pipeline.test.ts` |
| Không hồi quy (tương thích ngược) | ✅ Đạt | `npm test` toàn bộ: 380 tests, 1 flake không liên quan (xem § 10) |
| **A/B eval thật (so sánh Variant A vs B, đo giảm token thật, chạy model thật)** | ❌ **Không thực hiện** | **Quyết định chủ động của user** — bỏ Task 10 khỏi phạm vi công việc này, KHÔNG phải do bị chặn kỹ thuật (proxy `sotatek-anthropic` chưa được kiểm tra khả năng kết nối trong phiên này) |

**Ghi chú quan trọng:** DoD gốc (3b) yêu cầu A/B eval thật là điều kiện *đầy đủ*. Vì user chủ động
bỏ Task 10, DoD ở mức Level 1 này được coi là **hoàn thành có giới hạn phạm vi (partial-by-choice)**
— khác với "blocked" (bị chặn kỹ thuật, ví dụ Supabase-migration trước đây). Nếu cần đạt DoD đầy đủ
sau này, việc còn lại là: xây dataset câu hỏi toán (có case ma trận), scorer đo compile-rate/token
qua Tectonic thật, và 1 lượt gọi thật `sotatek-anthropic`.

## 10. Kết quả kiểm thử

- `npm run lint`: **0 lỗi** (3 warning có sẵn từ trước, không liên quan tới thay đổi này).
- `npm run build`: **pass** (compile + typecheck).
- `npm test` (toàn bộ suite): **380 tests**, 1 fail khi chạy song song toàn bộ
  (`tests/integration/api-documents-clarify.test.ts` — timeout 5000ms trong 1 test SSE của E7,
  không liên quan tới context-engineering). Chạy lại riêng file này: **7/7 pass** trong 2.9s —
  xác nhận là **flake do tải song song**, không phải hồi quy do thay đổi này.
- 7 file test mới dưới `lib/context-engineering/tests/` và `lib/document-blueprint/tests/`, tổng
  **25 test**, tất cả pass.

## 11. Những gì KHÔNG làm (ngoài phạm vi, có chủ đích)

- Không RAG / không vector DB / không LLM trong bước chọn context.
- Không có memory hội thoại nhiều lượt.
- Không áp dụng cho `edit`/`repair`/`project`/`markdown` hoặc template khác `math` — các luồng này
  **không đổi hành vi**.
- Không nối với E7 (`RequestPlan`/clarification) — `buildBlueprint()` là adapter riêng, độc lập,
  `#later` nếu cần hợp nhất khái niệm.
- **Không có A/B eval thật** (Task 10 bị bỏ theo yêu cầu user — xem § 9).

## 12. Cấu trúc file

```
lib/document-blueprint/
  types.ts, schema.ts, capabilities.ts, resolve-capabilities.ts, build-blueprint.ts
  tests/build-blueprint.test.ts

lib/context-engineering/
  types.ts, registry.ts, precedence.ts, pipeline.ts
  blocks/
    global/latex-contract.ts
    output-contracts/latex-output.ts
    templates/math-base.ts
    capabilities/math.ts
    constraints/math.ts
    examples/math.ts
  budget/estimate-tokens.ts, enforce-budget.ts
  selectors/select.ts, select-by-template.ts, select-by-stage.ts, select-by-capability.ts
  renderer/render-prompt.ts
  runtime/build-runtime-blocks.ts
  tracing/build-context-trace.ts
  tests/
    select.test.ts, resolve-capabilities.test.ts, precedence.test.ts,
    render-prompt.test.ts, enforce-budget.test.ts, pipeline.test.ts
```
