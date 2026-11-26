"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import {
  ChevronLeft,
  Trash2,
  FileTextIcon,
  CodeIcon,
  PlayIcon,
  FilePlusIcon,
  RotateCcwIcon,
} from "lucide-react";
import WorkspacePdfViewer from "@/components/WorkspacePdfViewer";
import ChatEditor from "@/components/ChatEditor";
import ProjectFileEditor from "@/components/ProjectFileEditor";
import { OverflowActions } from "@/components/motion/overflow-actions";
import { FileDiff } from "@/components/agents/file-diff";
import { useToast } from "@/components/ui/animated-toast-provider";
import { diffLatexLines } from "@/lib/latex/diff-lines";
import { useWorkspaceStore } from "@/components/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Textarea } from "@/components/ui/textarea";
import { CopySelectionContextButton } from "@/components/CopySelectionContextButton";
import { Spinner } from "@/components/ui/spinner";
import type { StoredDocument } from "@/lib/types/document";
import { getTemplate } from "@/lib/templates/registry";
import {
  createSourceSelectionContext,
  type SourceSelectionSnapshot,
} from "@/lib/mcp/selection-context";
import {
  compareRevisionTimestamps,
  useDocumentRealtime,
  type WorkspaceDocument,
} from "@/lib/hooks/use-document-realtime";

class DocumentRevisionConflictError extends Error {
  constructor(
    message: string,
    readonly document: StoredDocument | null,
  ) {
    super(message);
  }
}

type PatchInput = {
  latex: string;
  expectedUpdatedAt: string;
  compile?: false;
};

export default function DocumentWorkspace({
  initialDoc,
}: {
  initialDoc: StoredDocument | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [doc, setDoc] = useState<WorkspaceDocument | null>(initialDoc);
  const [loadError] = useState<string | undefined>(
    initialDoc ? undefined : "Không tìm thấy tài liệu.",
  );
  // Tab view (pdf/source) sống trong useWorkspaceStore (persist last-active tab, global).
  const tab = useWorkspaceStore((s) => s.tab);
  const setTab = useWorkspaceStore((s) => s.setTab);

  // Nạp tab đã lưu từ localStorage sau khi mount (store dùng skipHydration để tránh lệch hydration).
  useEffect(() => {
    void useWorkspaceStore.persist.rehydrate();
  }, []);

  // Chỉnh sửa thủ công mã nguồn.
  const [draft, setDraft] = useState(initialDoc?.latex ?? "");
  const [sourceSelection, setSourceSelection] = useState<SourceSelectionSnapshot | null>(null);
  const [projectDirty, setProjectDirty] = useState(false);
  const draftRef = useRef(draft);
  const docRef = useRef(doc);
  useLayoutEffect(() => {
    draftRef.current = draft;
    docRef.current = doc;
  }, [draft, doc]);
  const latestRevisionRef = useRef(initialDoc?.updatedAt);
  const localWriteRef = useRef<PatchInput | null>(null);
  const [remoteDocument, setRemoteDocument] = useState<WorkspaceDocument | null>(null);
  const [remoteDeleted, setRemoteDeleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [updates, setUpdates] = useState<string[]>([]);
  const chatAbortRef = useRef<AbortController | null>(null);
  const [actionError, setActionError] = useState<string>();

  const receiveRemoteDocument = useCallback((incoming: WorkspaceDocument | null) => {
    if (!incoming) {
      setRemoteDeleted(true);
      return;
    }
    const current = docRef.current;
    const lastRevision = latestRevisionRef.current;
    const timestampOrder = lastRevision
      ? compareRevisionTimestamps(incoming.updatedAt, lastRevision)
      : 1;
    // Older events are ignored. Equal timestamps can still carry a new source/PDF revision (a
    // compile updates the PDF without touching `updatedAt`), so compare revisions as well.
    if (timestampOrder < 0) return;
    if (
      timestampOrder === 0 && current &&
      incoming.sourceRevision === current.sourceRevision &&
      incoming.pdfSourceRevision === current.pdfSourceRevision &&
      incoming.hasPdf === current.hasPdf
    ) {
      return;
    }
    latestRevisionRef.current = incoming.updatedAt;
    setRemoteDeleted(false);
    const merged = incoming;

    const ownWrite = localWriteRef.current;
    if (
      ownWrite && merged.latex === ownWrite.latex &&
      compareRevisionTimestamps(merged.updatedAt, ownWrite.expectedUpdatedAt) > 0
    ) {
      if (merged.latex !== current?.latex) setSourceSelection(null);
      setDoc(merged);
      return;
    }
    if (!current) return;
    setUpdates((previous) =>
      previous[0] === merged.updatedAt
        ? previous
        : [merged.updatedAt, ...previous].slice(0, 20),
    );
    if (merged.sourceRevision && merged.sourceRevision === current.sourceRevision) {
      setDoc(merged);
      return;
    }
    const sourceChanged =
      merged.latex !== current.latex || merged.sourceRevision !== current.sourceRevision;
    if (chatAbortRef.current || (sourceChanged && draftRef.current !== current.latex)) {
      setRemoteDocument((previous) =>
        !previous || compareRevisionTimestamps(merged.updatedAt, previous.updatedAt) > 0
          ? merged
          : previous,
      );
      return;
    }

    if (sourceChanged) setSourceSelection(null);
    setDoc(merged);
    // Keep the local draft: a metadata refresh must not discard unsaved typing. The draft only
    // follows the server when there is nothing unsaved, which is the branch above.
    if (draftRef.current === current.latex) setDraft(merged.latex);
    setRemoteDocument(null);
  }, []);

  useDocumentRealtime(doc?.id, receiveRemoteDocument);

  const patchDocument = useCallback(async (id: string, input: PatchInput) => {
    localWriteRef.current = input;
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          latex: input.latex,
          expectedUpdatedAt: input.expectedUpdatedAt,
          ...(input.compile === false ? { compile: false } : {}),
        }),
      });
      const data = (await res.json()) as WorkspaceDocument & {
        error?: string;
        document?: StoredDocument | null;
      };
      if (res.status === 409) {
        throw new DocumentRevisionConflictError(
          data.error ?? "Tài liệu đã thay đổi trên máy chủ.",
          data.document ?? null,
        );
      }
      if (!res.ok) throw new Error(data.error ?? "Lưu tài liệu thất bại.");
      return data as WorkspaceDocument;
    } finally {
      if (localWriteRef.current === input) localWriteRef.current = null;
    }
  }, []);

  const acceptSavedDocument = useCallback((updated: WorkspaceDocument) => {
    const lastRevision = latestRevisionRef.current;
    if (lastRevision && compareRevisionTimestamps(updated.updatedAt, lastRevision) < 0) {
      return false;
    }
    latestRevisionRef.current = updated.updatedAt;
    setDoc(updated);
    return true;
  }, []);

  const recordConflict = useCallback((error: unknown) => {
    if (!(error instanceof DocumentRevisionConflictError)) return;
    if (error.document) {
      latestRevisionRef.current = error.document.updatedAt;
      setRemoteDocument(error.document);
      setRemoteDeleted(false);
    } else {
      setRemoteDeleted(true);
    }
  }, []);

  // Tải lại từ server (dùng sau khi có lỗi mutate để đồng bộ trạng thái đã lưu).
  const reload = useCallback(async () => {
    if (!doc) return;
    try {
      const res = await fetch(`/api/documents/${doc.id}?view=workspace`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      if (!res.ok) return;
      const data = (await res.json()) as WorkspaceDocument;
      const merged = data;
      latestRevisionRef.current = merged.updatedAt;
      setDoc(merged);
      setDraft(merged.latex);
      setRemoteDocument(null);
      setRemoteDeleted(false);
    } catch {
      /* giữ nguyên trạng thái hiện tại */
    }
  }, [doc]);

  // Auto-save nháp (FE-2.4): PATCH compile:false — CHỈ persist latex, KHÔNG biên dịch. Không đụng
  // `draft` khi thành công (người dùng có thể đang gõ tiếp); chỉ cập nhật `doc` (doc.latex = bản đã
  // lưu) để biết còn thay đổi chưa lưu hay không.
  const autoSaveMutation = useMutation({
    mutationFn: async (input: PatchInput) => {
      if (!doc) throw new Error("Tài liệu không tồn tại.");
      return patchDocument(doc.id, input);
    },
    onSuccess: acceptSavedDocument,
    onError: recordConflict,
  });

  // Biên dịch tường minh: PATCH (compile mặc định) → validate + compile → cập nhật PDF.
  const compileMutation = useMutation({
    mutationFn: async (input: PatchInput) => {
      if (!doc) throw new Error("Tài liệu không tồn tại.");
      try {
        return await patchDocument(doc.id, input);
      } catch (error) {
        const current = error instanceof DocumentRevisionConflictError ? error.document : null;
        // A preview worker can publish this exact revision while the manual compile is running.
        if (doc.sourceRevision && doc.pdfSourceRevision !== doc.sourceRevision &&
          current?.id === doc.id && current.sourceRevision === doc.sourceRevision &&
          current.pdfSourceRevision === current.sourceRevision && !current.error &&
          (current.hasPdf || current.pdfBase64) && input.latex === doc.latex && input.latex === current.latex) {
          return current;
        }
        throw error;
      }
    },
    onSuccess: (updated) => {
      const accepted = acceptSavedDocument(updated);
      if (accepted && draftRef.current === updated.latex) setDraft(updated.latex);
      const hasViewerPdf = Boolean(updated.pdfBase64 || updated.hasPdf);
      if (accepted && hasViewerPdf) setTab("pdf");
      toast({
        title: hasViewerPdf ? "Đã biên dịch PDF" : "Biên dịch xong",
        description: updated.error
          ? updated.error
          : `Tài liệu đã cập nhật · ${updated.attempts} lần thử`,
        status: updated.error ? "error" : "success",
      });
    },
    onError: (e) => {
      recordConflict(e);
      const message = e instanceof Error ? e.message : "Biên dịch thất bại.";
      setActionError(message);
      toast({ title: "Biên dịch thất bại", description: message, status: "error" });
    },
  });

  // Debounce auto-save: 1500ms sau lần gõ cuối. Chỉ chạy cho tài liệu single-file, không trong khi
  // stream chat-edit, và chỉ khi draft khác bản đã lưu (không rỗng).
  useEffect(() => {
    if (!doc || (doc.files && doc.files.length > 0)) return;
    if (isStreaming || saving || compileMutation.isPending || autoSaveMutation.isPending || remoteDocument || remoteDeleted) return;
    if (draft.trim().length === 0 || draft === doc.latex) return;
    const t = setTimeout(
      () => autoSaveMutation.mutate({ latex: draft, expectedUpdatedAt: doc.updatedAt }),
      1500,
    );
    return () => clearTimeout(t);
  }, [draft, doc, isStreaming, saving, compileMutation.isPending, remoteDocument, remoteDeleted, autoSaveMutation]);

  async function sendChat(instruction: string) {
    if (!doc || draft !== doc.latex || isStreaming || remoteDocument || remoteDeleted || autoSaveMutation.isPending || compileMutation.isPending) return;
    setIsStreaming(true);
    setActionError(undefined);

    // Automatically switch to source tab to see live changes
    setTab("source");

    const tempAssistantId = `assistant-tmp-${Date.now()}`;
    const initialAssistantMsg = {
      id: tempAssistantId,
      role: "assistant" as const,
      content: "Đang chuẩn bị chỉnh sửa...",
      createdAt: new Date().toISOString(),
    };

    const optimistic: StoredDocument = {
      ...doc,
      messages: [
        ...doc.messages,
        {
          id: `user-tmp-${Date.now()}`,
          role: "user",
          content: instruction,
          createdAt: new Date().toISOString(),
        },
        initialAssistantMsg,
      ],
    };
    setDoc(optimistic);

    let accumulatedLatex = "";

    try {
      const controller = new AbortController();
      chatAbortRef.current = controller;
      const res = await fetch(`/api/documents/${doc.id}/chat`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
        },
        body: JSON.stringify({ instruction }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setActionError(errorData.error ?? "Chỉnh sửa thất bại.");
        await reload();
        return;
      }

      if (!res.body) {
         setActionError("Không nhận được dữ liệu stream từ server.");
         await reload();
         return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.text) {
                accumulatedLatex += data.text;
                setDraft(accumulatedLatex);

                setDoc((prev) => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    messages: prev.messages.map((m) => {
                      if (m.id === tempAssistantId) {
                        return {
                          ...m,
                          content: `Đang nhận mã nguồn LaTeX... (${accumulatedLatex.length} ký tự)`,
                        };
                      }
                      return m;
                    }),
                  };
                });
              } else if (data.status === "compiling") {
                setDoc((prev) => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    messages: prev.messages.map((m) => {
                      if (m.id === tempAssistantId) {
                        return {
                          ...m,
                          content: "Đang biên dịch tài liệu PDF...",
                        };
                      }
                      return m;
                    }),
                  };
                });
              } else if (data.doc) {
                if (!acceptSavedDocument(data.doc)) return;
                setDraft(data.doc.latex);
                setRemoteDocument(null);
                if (data.doc.pdfBase64 || data.doc.hasPdf) {
                  setTab("pdf");
                }
                return;
              } else if (data.message) {
                setActionError(data.message);
                if (data.code === "version_conflict") {
                  recordConflict(new DocumentRevisionConflictError(data.message, data.document));
                  return;
                }
                await reload();
                return;
              }
            } catch {
              // ignore
            }
          }
        }
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") {
        await reload();
        return;
      }
      setActionError("Không kết nối được máy chủ.");
      await reload();
    } finally {
      setIsStreaming(false);
      chatAbortRef.current = null;
    }
  }

  function cancelChat() {
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    setIsStreaming(false);
  }

  async function onDelete() {
    if (!doc) return;
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Đã xoá tài liệu", description: doc.title, status: "success" });
        router.push("/");
      } else {
        setActionError("Xoá thất bại.");
        toast({ title: "Xoá thất bại", status: "error" });
      }
    } catch {
      setActionError("Không kết nối được máy chủ.");
      toast({ title: "Không kết nối được máy chủ", status: "error" });
    } finally {
      setConfirmingDelete(false);
    }
  }

  // E1a — Convert-in-place: biến tài liệu single-file hiện tại thành dự án multi-file.
  // Seed file gốc "main.tex" = nội dung latex hiện có, cộng một file mới rỗng. Một PATCH duy nhất;
  // KHÔNG gọi AI. Sau khi thành công, doc.files sẽ có mặt ⇒ UI tự chuyển sang ProjectFileEditor.
  async function convertToProject() {
    if (!doc || saving || remoteDocument || remoteDeleted || autoSaveMutation.isPending || compileMutation.isPending) return;
    setSaving(true);
    setActionError(undefined);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          files: [
            { path: "main.tex", content: doc.latex },
            { path: "section1.tex", content: "" },
          ],
          rootFile: "main.tex",
          expectedUpdatedAt: doc.updatedAt,
        }),
      });
      const data = (await res.json()) as StoredDocument & { error?: string };
      if (!res.ok) {
        setActionError(data.error ?? "Không chuyển được sang dự án nhiều file.");
        return;
      }
      acceptSavedDocument(data);
      setTab("source");
    } catch {
      setActionError("Không kết nối được máy chủ.");
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <div className="glass rounded-lg p-6">
          <p className="text-destructive font-medium">{loadError}</p>
          <Link
            href="/app"
            className="mt-4 inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // Diff giữa bản đã lưu trên server và bản nháp đang gõ / đang stream về.
  // Đây là chỗ duy nhất user thấy được chat-edit đã thay đổi những gì.
  const unsavedDiff = diffLatexLines(doc.latex, draft);
  const hasUnsaved = unsavedDiff.lines.length > 0;
  const hasViewerPdf = Boolean(doc.pdfBase64) || doc.hasPdf === true;

  const previewTabs = [
    {
      id: "pdf",
      label: "PDF",
      icon: <FileTextIcon className="size-4" aria-hidden="true" />,
      content: (
        <div className="h-full overflow-y-auto">
          <WorkspacePdfViewer
            documentId={doc.id}
            selectionDocument={doc}
            selectionBlocked={(doc.files?.length ? projectDirty : draft !== doc.latex) ||
              Boolean(remoteDocument) || remoteDeleted || isStreaming || saving}
            pdfBase64={doc.pdfBase64}
            hasPdf={doc.hasPdf}
            sourceRevision={doc.sourceRevision}
            pdfSourceRevision={doc.pdfSourceRevision}
            pending={compileMutation.isPending}
            fileName={`${doc.title.replace(/[\\/:*?"<>|]/g, "_")}.pdf`}
          />
        </div>
      ),
    },
    {
      id: "source",
      label: "LaTeX",
      icon: <CodeIcon className="size-4" aria-hidden="true" />,
      content: (
        <div className="flex h-full flex-col gap-2 overflow-y-auto">
          {doc.files && doc.files.length > 0 ? (
            <ProjectFileEditor doc={doc} onSaved={(updated) => setDoc(updated)} onDraftChange={setProjectDirty} />
          ) : (
            <>
              {hasUnsaved && (
                <FileDiff
                  file="main.tex"
                  lines={unsavedDiff.lines}
                  language="latex"
                  status={isStreaming ? "streaming" : "complete"}
                  maxHeight={220}
                  defaultOpen={isStreaming}
                  collapseOnComplete
                />
              )}
              <Textarea
                variant="glass"
                aria-label="Mã LaTeX"
                className="min-h-64 flex-1 font-mono text-sm"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setSourceSelection(null);
                }}
                onSelect={(e) => {
                  const { selectionStart: start, selectionEnd: end } = e.currentTarget;
                  setSourceSelection(end > start ? {
                    start,
                    end,
                    source: doc.latex,
                    updatedAt: doc.updatedAt,
                  } : null);
                }}
                spellCheck={false}
                disabled={isStreaming}
              />
              <CopySelectionContextButton
                context={sourceSelection && draft === doc.latex && !remoteDocument && !remoteDeleted
                  ? createSourceSelectionContext({
                    documentId: doc.id,
                    updatedAt: doc.updatedAt,
                    filePath: "main.tex",
                    source: doc.latex,
                    selection: sourceSelection,
                  })
                  : null}
                disabled={draft !== doc.latex || Boolean(remoteDocument) || remoteDeleted}
                disabledMessage={remoteDocument || remoteDeleted
                  ? "Xử lý revision mới trước khi copy context."
                  : "Lưu bản nháp trước để tạo context đúng revision."}
              />
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="@container relative flex h-full w-full min-w-0 flex-col gap-2">
      {/* Document Header */}
      <div className="glass rounded-lg p-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/app"
              className="text-primary hover:text-primary/80 transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
              aria-label="Back to documents"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-foreground">
                {doc.title}
              </h1>
              <p className="text-xs text-muted-foreground">
                {doc.rootFile ?? "main.tex"} · {getTemplate(doc.template)?.label ?? doc.template}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Button size="sm" variant="ghost" aria-expanded={historyOpen} aria-controls="document-update-history" onClick={() => setHistoryOpen(!historyOpen)}>Cập nhật trong phiên</Button>
            <Button size="sm" variant={chatOpen ? "secondary" : "ghost"} aria-expanded={chatOpen} aria-controls="document-chat" onClick={() => setChatOpen(!chatOpen)}>Chat</Button>
          {confirmingDelete ? (
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-xs text-destructive">Xoá vĩnh viễn?</span>
              <Button
                size="xs"
                variant="destructive"
                onClick={() => void onDelete()}
              >
                Xác nhận
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setConfirmingDelete(false)}
              >
                Huỷ
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirmingDelete(true)}
              className="flex-shrink-0"
              aria-label={`Xoá tài liệu: ${doc.title}`}
              title={`Xoá tài liệu: ${doc.title}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Xoá
            </Button>
          )}
          </div>
        </div>

        <p role="status" className="mt-1 text-xs text-muted-foreground">
          {updates.length > 0 && (hasViewerPdf ? "Đã nhận bản cập nhật" : "Mã nguồn đã cập nhật · cần biên dịch")}
        </p>
        <section id="document-update-history" hidden={!historyOpen} className="mt-2 border-t px-1 pt-2 text-sm">
          <p className="font-medium">Cập nhật trong phiên</p>
          <p>Cập nhật đã lưu gần nhất: {new Date(doc.updatedAt).toLocaleString("vi-VN")}</p>
          <ol className="max-h-32 overflow-auto text-muted-foreground">
            {updates.map((revision, index) => <li key={`${revision}-${index}`}>Nhận cập nhật lúc {new Date(revision).toLocaleString("vi-VN")}</li>)}
          </ol>
        </section>

        {remoteDocument && (
          <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 rounded border border-glass-border p-2">
            <p className="mr-auto text-sm">Có bản mới trên máy chủ. Bản nháp của bạn vẫn được giữ.</p>
            <Button size="sm" variant="outline" onClick={() => {
              setDoc(remoteDocument);
              setDraft(remoteDocument.latex);
              setRemoteDocument(null);
              setActionError(undefined);
              setTab("source");
            }}>Dùng bản máy chủ</Button>
            <Button size="sm" disabled={!draft.trim() || autoSaveMutation.isPending || compileMutation.isPending || isStreaming} onClick={() => {
              setDoc(remoteDocument);
              setRemoteDocument(null);
              setActionError(undefined);
              autoSaveMutation.mutate({ latex: draft, expectedUpdatedAt: remoteDocument.updatedAt });
            }}>Lưu bản nháp của tôi</Button>
          </div>
        )}
        {remoteDeleted && <p role="alert" className="mt-2 text-sm text-destructive">Không còn truy cập được tài liệu. Bạn có thể sao chép bản nháp từ tab LaTeX.</p>}
        {doc.error && (
          <div
            className="mt-2 rounded border border-destructive/50 bg-destructive/10 p-2"
            role="alert"
            aria-live="polite"
            aria-atomic="true"
          >
            <p className="text-sm font-medium text-destructive">{doc.error}</p>
            {doc.log && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-destructive/80 hover:text-destructive">
                  Chi tiết lỗi
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-background p-2 text-xs">
                  {doc.log}
                </pre>
              </details>
            )}
          </div>
        )}
        {actionError && (
          <p
            className="mt-2 text-sm text-destructive"
            role="alert"
            aria-live="polite"
            aria-atomic="true"
          >
            {actionError}
          </p>
        )}
      </div>

      {!(doc.files && doc.files.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-glass-border p-2">
          <OverflowActions
            size="sm"
            primaryActions={[
              {
                id: "compile",
                label: compileMutation.isPending
                  ? "Đang biên dịch…"
                  : "Biên dịch",
                icon: compileMutation.isPending ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <PlayIcon className="size-4" aria-hidden="true" />
                ),
                disabled:
                  compileMutation.isPending ||
                  autoSaveMutation.isPending ||
                  saving ||
                  Boolean(remoteDocument) ||
                  remoteDeleted ||
                  isStreaming ||
                  draft.trim().length === 0,
                onClick: () => compileMutation.mutate({ latex: draft, expectedUpdatedAt: doc.updatedAt }),
              },
            ]}
            overflowActions={[
              {
                id: "add-file",
                label: "Thêm file",
                icon: <FilePlusIcon className="size-4" aria-hidden="true" />,
                disabled: saving || Boolean(remoteDocument) || remoteDeleted || autoSaveMutation.isPending || compileMutation.isPending || hasUnsaved,
                onClick: () => void convertToProject(),
              },
              {
                id: "reload",
                label: "Tải lại từ máy chủ",
                icon: <RotateCcwIcon className="size-4" aria-hidden="true" />,
                disabled: isStreaming,
                onClick: () => void reload(),
              },
            ]}
            openLabel="Thêm hành động"
            closeLabel="Thu gọn hành động"
          />

          <span
            className="flex items-center gap-1 text-xs text-muted-foreground"
            aria-live="polite"
            role="status"
          >
            {autoSaveMutation.isPending ? (
              <>
                <Spinner className="h-3 w-3" /> Đang lưu…
              </>
            ) : autoSaveMutation.isError ? (
              <span className="text-destructive">Lưu nháp lỗi</span>
            ) : hasUnsaved ? (
              `Chưa lưu · +${unsavedDiff.additions} −${unsavedDiff.deletions}`
            ) : (
              "Đã lưu"
            )}
          </span>
        </div>
      )}
      <div className="relative min-h-0 min-w-0 flex-1">
        <div className="min-w-0 rounded-lg border bg-background p-2">
          <div role="group" aria-label="Chọn chế độ xem tài liệu" className="flex gap-1 border-b pb-1">
            {previewTabs.map(({ id, label, icon }) => (
              <Button key={id} size="sm" variant={tab === id ? "secondary" : "ghost"} aria-pressed={tab === id} onClick={() => {
                if (id === "pdf" || id === "source") setTab(id);
              }}>{icon}{label}</Button>
            ))}
          </div>
          {previewTabs.map(({ id, content }) => (
            <div key={id} hidden={tab !== id} className="min-w-0">{content}</div>
          ))}
        </div>

        <div id="document-chat" hidden={!chatOpen} className="absolute inset-x-0 top-0 z-20 max-h-[70dvh] overflow-y-auto rounded-lg border bg-background shadow-lg @[600px]:left-auto @[600px]:w-96">
          <GlassPanel title="Chat tài liệu" subtitle="" className="h-full p-2">
            <div className="flex flex-col gap-2 h-full overflow-y-auto">
              {doc.files && doc.files.length > 0 ? (
                <p className="text-sm text-muted-foreground p-2">
                  Chat-edit không hỗ trợ dự án nhiều file. Sử dụng tab Mã nguồn để chỉnh sửa.
                </p>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto">
                    <ChatEditor
                      messages={doc.messages}
                      onSend={sendChat}
                      onCancel={cancelChat}
                      busy={isStreaming || Boolean(remoteDocument) || remoteDeleted || hasUnsaved}
                    />
                  </div>


                </>
              )}
            </div>
          </GlassPanel>
        </div>
      </div>

    </div>
  );
}
