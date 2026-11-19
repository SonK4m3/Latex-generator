// lib/store/supabase-document-store.ts
// Backend lưu trữ tài liệu trên SUPABASE (Postgres, bảng public.documents).
// Cùng interface với file-document-store.ts để facade thay thế được.
//
// Bảo mật: dùng server client theo session người dùng (cookies) → RLS (owner_id = auth.uid())
// tự động scope mọi truy vấn theo chủ sở hữu. Tham số ownerId chỉ dùng khi INSERT (đặt owner_id);
// đọc/sửa/xoá dựa vào RLS nên không cần lọc thủ công.
//
// Yêu cầu: chạy migration supabase/migrations/0001_documents.sql (bảng + RLS + trigger).

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { newMessage, toSummary, isValidId } from "@/lib/store/file-document-store";
import type {
  ChatMessage,
  CreateDocumentInput,
  DocType,
  DocumentSummary,
  ProjectFile,
  StoredDocument,
  TemplateId,
  UpdateDocumentPatch,
  InputFormat,
  WorkspaceDocument,
} from "@/lib/types/document";

const TABLE = "documents";

/** Hàng đầy đủ trong bảng documents (snake_case). */
interface DocumentRow {
  id: string;
  owner_id: string | null;
  title: string;
  doc_type: DocType;
  template: TemplateId;
  description: string;
  latex: string;
  pdf_base64: string | null;
  log: string | null;
  error: string | null;
  attempts: number;
  messages: ChatMessage[] | null;
  input_format: InputFormat | null;
  source_markdown: string | null;
  files: ProjectFile[] | null;
  root_file: string | null;
  has_pdf?: boolean | null;
  source_revision?: string | null;
  pdf_source_revision?: string | null;
  created_at: string;
  updated_at: string;
}

/** Hàng workspace: giống DocumentRow nhưng không có bytes PDF, có has_pdf (cột generated sẵn). */
interface WorkspaceRow extends Omit<DocumentRow, "pdf_base64" | "has_pdf"> {
  has_pdf: boolean;
}

/** Cột cho workspace — loại tường minh pdf_base64 để không kéo bytes PDF nặng. */
const WORKSPACE_COLUMNS =
  "id,owner_id,title,doc_type,template,description,latex,log,error,attempts,messages,input_format,source_markdown,files,root_file,created_at,updated_at,has_pdf,source_revision,pdf_source_revision";
/** Fallback khi DB chưa chạy migration revision (source_revision/pdf_source_revision chưa có). */
const WORKSPACE_COLUMNS_BASE =
  "id,owner_id,title,doc_type,template,description,latex,log,error,attempts,messages,input_format,source_markdown,files,root_file,created_at,updated_at,has_pdf";

/** Cột nhẹ cho danh sách (không kéo latex/pdf nặng). */
interface DocumentSummaryRow {
  id: string;
  title: string;
  doc_type: DocType;
  template: TemplateId;
  attempts: number;
  has_pdf: boolean;
  is_project: boolean;
  /** Cột generated có từ migration 0011; thiếu ở DB trước migration. */
  pdf_revision_status?: "missing" | "unknown" | "current" | "stale" | null;
  created_at: string;
  updated_at: string;
}

const PDF_REVISION_STATUS_COLUMN = "pdf_revision_status";
const SUMMARY_COLUMNS =
  "id,title,doc_type,template,attempts,has_pdf,is_project,pdf_revision_status,created_at,updated_at";
/** Fallback khi DB chưa có cột generated `pdf_revision_status` (migration 0011 chưa chạy). */
const SUMMARY_COLUMNS_BASE =
  "id,title,doc_type,template,attempts,has_pdf,is_project,created_at,updated_at";

async function sb() {
  return createClient(await cookies());
}

function rowToDoc(row: DocumentRow): StoredDocument {
  return {
    id: row.id,
    ownerId: row.owner_id ?? undefined,
    title: row.title,
    docType: row.doc_type,
    template: row.template,
    description: row.description,
    latex: row.latex,
    pdfBase64: row.pdf_base64 ?? undefined,
    log: row.log ?? undefined,
    error: row.error ?? undefined,
    attempts: row.attempts,
    messages: row.messages ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    inputFormat: row.input_format ?? undefined,
    sourceMarkdown: row.source_markdown ?? undefined,
    files: row.files ?? undefined,
    rootFile: row.root_file ?? undefined,
    hasPdf: row.has_pdf ?? Boolean(row.pdf_base64),
    sourceRevision: row.source_revision ?? undefined,
    pdfSourceRevision: row.pdf_source_revision ?? undefined,
  };
}

/** Map hàng workspace → contract workspace (không có pdfBase64). */
function workspaceRowToDoc(row: WorkspaceRow): WorkspaceDocument {
  return {
    id: row.id,
    ownerId: row.owner_id ?? undefined,
    title: row.title,
    docType: row.doc_type,
    template: row.template,
    description: row.description,
    latex: row.latex,
    log: row.log ?? undefined,
    error: row.error ?? undefined,
    attempts: row.attempts,
    messages: row.messages ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    inputFormat: row.input_format ?? undefined,
    sourceMarkdown: row.source_markdown ?? undefined,
    files: row.files ?? undefined,
    rootFile: row.root_file ?? undefined,
    hasPdf: row.has_pdf,
    sourceRevision: row.source_revision ?? undefined,
    pdfSourceRevision: row.pdf_source_revision ?? undefined,
  };
}

/**
 * DB chưa migrate revision → PostgREST báo thiếu cột (42703) hoặc schema cache (PGRST204).
 * Chỉ fallback cho lỗi thiếu cột; nếu message nêu tên cột thì kiểm tra đúng cột được hỏi.
 */
function isMissingRevisionColumn(
  error: { code?: string; message?: string } | null,
  columns: readonly string[] = ["source_revision", "pdf_source_revision"],
): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  if (columns.some((column) => message.includes(column.toLowerCase()))) {
    return true;
  }
  return error.code === "42703" || error.code === "PGRST204";
}

function summaryRowToSummary(row: DocumentSummaryRow): DocumentSummary {
  const summary: DocumentSummary = {
    id: row.id,
    title: row.title,
    docType: row.doc_type,
    template: row.template,
    attempts: row.attempts,
    hasPdf: row.has_pdf,
    isProject: row.is_project,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  // Giữ nguyên shape cũ khi DB chưa có cột: không thêm key với giá trị rỗng.
  if (row.pdf_revision_status) {
    summary.pdfRevisionStatus = row.pdf_revision_status;
  }
  return summary;
}

export async function createDocument(
  input: CreateDocumentInput,
): Promise<StoredDocument> {
  const supabase = await sb();
  const insert = {
    owner_id: input.ownerId ?? null,
    title: input.title,
    doc_type: input.docType,
    template: input.template,
    description: input.description,
    latex: input.latex,
    pdf_base64: input.pdfBase64 ?? null,
    log: input.log ?? null,
    error: input.error ?? null,
    attempts: input.attempts,
    messages: input.messages ?? [],
    input_format: input.inputFormat ?? null,
    source_markdown: input.sourceMarkdown ?? null,
    files: input.files ?? null,
    root_file: input.rootFile ?? null,
  };
  const { data, error } = await supabase
    .from(TABLE)
    .insert(insert)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Không tạo được tài liệu: ${error?.message ?? "no data"}`);
  }
  return rowToDoc(data as DocumentRow);
}

export async function getDocument(
  id: string,
  ownerId?: string,
): Promise<StoredDocument | null> {
  if (!isValidId(id)) return null;
  const supabase = await sb();
  let query = supabase.from(TABLE).select("*").eq("id", id);
  if (ownerId !== undefined) query = query.eq("owner_id", ownerId);
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return rowToDoc(data as DocumentRow);
}

/**
 * Đọc tài liệu cho workspace, KHÔNG kéo `pdf_base64`.
 * - Projection tường minh + `has_pdf` (cột generated có từ 0001).
 * - DB chưa có source_revision/pdf_source_revision → fallback projection không revision.
 * - Luôn lọc owner_id (phòng thủ kép ngoài RLS).
 */
export async function getWorkspaceDocument(
  id: string,
  ownerId: string,
): Promise<WorkspaceDocument | null> {
  if (!isValidId(id)) return null;
  if (!ownerId) return null;
  const supabase = await sb();

  const query = supabase
    .from(TABLE)
    .select(WORKSPACE_COLUMNS)
    .eq("id", id)
    .eq("owner_id", ownerId);
  const { data, error } = await query.maybeSingle();

  if (error && isMissingRevisionColumn(error)) {
    const fallback = await supabase
      .from(TABLE)
      .select(WORKSPACE_COLUMNS_BASE)
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    return fallback.error || !fallback.data ? null : workspaceRowToDoc(fallback.data as WorkspaceRow);
  }
  if (error || !data) return null;
  return workspaceRowToDoc(data as unknown as WorkspaceRow);
}

export async function listDocuments(
  ownerId?: string,
): Promise<DocumentSummary[]> {
  const supabase = await sb();
  let query = supabase.from(TABLE).select(SUMMARY_COLUMNS);
  if (ownerId !== undefined) query = query.eq("owner_id", ownerId);
  const { data, error } = await query.order("updated_at", {
    ascending: false,
  });

  // Chỉ fallback khi thiếu đúng cột generated `pdf_revision_status`; lỗi khác giữ hành vi cũ.
  if (error && isMissingRevisionColumn(error, [PDF_REVISION_STATUS_COLUMN])) {
    let fallback = supabase.from(TABLE).select(SUMMARY_COLUMNS_BASE);
    if (ownerId !== undefined) fallback = fallback.eq("owner_id", ownerId);
    const fallbackResult = await fallback.order("updated_at", {
      ascending: false,
    });
    if (fallbackResult.error || !fallbackResult.data) return [];
    return (fallbackResult.data as unknown as DocumentSummaryRow[]).map(
      summaryRowToSummary,
    );
  }
  if (error || !data) return [];
  return (data as unknown as DocumentSummaryRow[]).map(summaryRowToSummary);
}

/** Ánh xạ patch (camelCase) → cột (snake_case), chỉ set khoá có mặt trong patch. */
function patchToRow(patch: UpdateDocumentPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if ("title" in patch) row.title = patch.title;
  if ("latex" in patch) row.latex = patch.latex;
  if ("pdfBase64" in patch) row.pdf_base64 = patch.pdfBase64 ?? null;
  if ("log" in patch) row.log = patch.log ?? null;
  if ("error" in patch) row.error = patch.error ?? null;
  if ("attempts" in patch) row.attempts = patch.attempts;
  if ("messages" in patch) row.messages = patch.messages;
  if ("files" in patch) row.files = patch.files ?? null;
  if ("rootFile" in patch) row.root_file = patch.rootFile ?? null;
  return row;
}

export async function updateDocument(
  id: string,
  patch: UpdateDocumentPatch,
  ownerId?: string,
  expectedUpdatedAt?: string,
): Promise<StoredDocument | null> {
  if (!isValidId(id)) return null;
  const supabase = await sb();
  const row = patchToRow(patch);
  if (Object.keys(row).length === 0) {
    // Không có gì để cập nhật: trả về bản hiện tại (nếu có quyền).
    return getDocument(id, ownerId);
  }
  let query = supabase.from(TABLE).update(row).eq("id", id);
  if (ownerId !== undefined) query = query.eq("owner_id", ownerId);
  if (expectedUpdatedAt !== undefined) {
    query = query.eq("updated_at", expectedUpdatedAt);
  }
  const { data, error } = await query.select("*").maybeSingle();
  if (error || !data) return null;
  return rowToDoc(data as DocumentRow);
}

export async function appendMessages(
  id: string,
  messages: ChatMessage[],
  ownerId?: string,
): Promise<StoredDocument | null> {
  const existing = await getDocument(id, ownerId);
  if (!existing) return null;
  return updateDocument(
    id,
    { messages: [...existing.messages, ...messages] },
    ownerId,
  );
}

export async function deleteDocument(
  id: string,
  ownerId?: string,
): Promise<boolean> {
  if (!isValidId(id)) return false;
  const supabase = await sb();
  let query = supabase.from(TABLE).delete().eq("id", id);
  if (ownerId !== undefined) query = query.eq("owner_id", ownerId);
  const { data, error } = await query.select("id");
  if (error || !data) return false;
  return data.length > 0; // RLS: chỉ xoá được hàng thuộc sở hữu.
}

export { newMessage, toSummary, isValidId };
