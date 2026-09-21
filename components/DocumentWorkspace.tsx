"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import PdfPreview from "@/components/PdfPreview";
import ChatEditor from "@/components/ChatEditor";
import ProjectFileEditor from "@/components/ProjectFileEditor";
import {
  ExpandableTabs,
  type ExpandableTabsItem,
} from "@/components/motion/expandable-tabs";
import { OverflowActions } from "@/components/motion/overflow-actions";
import { FileDiff } from "@/components/agents/file-diff";
import { useToast } from "@/components/ui/animated-toast-provider";
import { diffLatexLines } from "@/lib/latex/diff-lines";
import { useWorkspaceStore } from "@/components/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import type { StoredDocument } from "@/lib/types/document";
import { getTemplate } from "@/lib/templates/registry";

export default function DocumentWorkspace({
  initialDoc,
}: {
  initialDoc: StoredDocument | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [doc, setDoc] = useState<StoredDocument | null>(initialDoc);
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
  const [saving, setSaving] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const chatAbortRef = useRef<AbortController | null>(null);
  const [actionError, setActionError] = useState<string>();

  // Tải lại từ server (dùng sau khi có lỗi mutate để đồng bộ trạng thái đã lưu).
  const reload = useCallback(async () => {
    if (!doc) return;
    try {
      const res = await fetch(`/api/documents/${doc.id}`);
      if (!res.ok) return;
      const data = (await res.json()) as StoredDocument;
      setDoc(data);
      setDraft(data.latex);
    } catch {
      /* giữ nguyên trạng thái hiện tại */
    }
  }, [doc]);

  // Auto-save nháp (FE-2.4): PATCH compile:false — CHỈ persist latex, KHÔNG biên dịch. Không đụng
  // `draft` khi thành công (người dùng có thể đang gõ tiếp); chỉ cập nhật `doc` (doc.latex = bản đã
  // lưu) để biết còn thay đổi chưa lưu hay không.
  const autoSaveMutation = useMutation({
    mutationFn: async (latex: string) => {
      if (!doc) throw new Error("Tài liệu không tồn tại.");
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ latex, compile: false }),
      });
      const data = (await res.json()) as StoredDocument & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Lưu nháp thất bại.");
      return data;
    },
    onSuccess: (updated) => setDoc(updated),
  });

  // Biên dịch tường minh: PATCH (compile mặc định) → validate + compile → cập nhật PDF.
  const compileMutation = useMutation({
    mutationFn: async (latex: string) => {
      if (!doc) throw new Error("Tài liệu không tồn tại.");
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ latex }),
      });
      const data = (await res.json()) as StoredDocument & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Biên dịch thất bại.");
      return data;
    },
    onSuccess: (updated) => {
      setDoc(updated);
      setDraft(updated.latex);
      if (updated.pdfBase64) setTab("pdf");
      toast({
        title: updated.pdfBase64 ? "Đã biên dịch PDF" : "Biên dịch xong",
        description: updated.error
          ? updated.error
          : `Tài liệu đã cập nhật · ${updated.attempts} lần thử`,
        status: updated.error ? "error" : "success",
      });
    },
    onError: (e) => {
      const message = e instanceof Error ? e.message : "Biên dịch thất bại.";
      setActionError(message);
      toast({ title: "Biên dịch thất bại", description: message, status: "error" });
    },
  });

  // Debounce auto-save: 1500ms sau lần gõ cuối. Chỉ chạy cho tài liệu single-file, không trong khi
  // stream chat-edit, và chỉ khi draft khác bản đã lưu (không rỗng).
  useEffect(() => {
    if (!doc || (doc.files && doc.files.length > 0)) return;
    if (isStreaming) return;
    if (draft.trim().length === 0 || draft === doc.latex) return;
    const t = setTimeout(() => autoSaveMutation.mutate(draft), 1500);
    return () => clearTimeout(t);
  }, [draft, doc, isStreaming, autoSaveMutation]);

  async function sendChat(instruction: string) {
    if (!doc || isStreaming) return;
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
                setDoc(data.doc);
                setDraft(data.doc.latex);
                if (data.doc.pdfBase64) {
                  setTab("pdf");
                }
                return;
              } else if (data.message) {
                setActionError(data.message);
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
    if (!doc || saving) return;
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
        }),
      });
      const data = (await res.json()) as StoredDocument & { error?: string };
      if (!res.ok) {
        setActionError(data.error ?? "Không chuyển được sang dự án nhiều file.");
        return;
      }
      setDoc(data);
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

  const previewTabs: ExpandableTabsItem[] = [
    {
      id: "pdf",
      label: "PDF",
      icon: <FileTextIcon className="size-4" aria-hidden="true" />,
      content: (
        <div className="h-full overflow-y-auto">
          {doc.pdfBase64 ? (
            <PdfPreview pdfBase64={doc.pdfBase64} />
          ) : (
            <p className="p-2 text-sm text-muted-foreground">
              Chưa có PDF. Biên dịch mã LaTeX hoặc sử dụng Chat để tạo.
            </p>
          )}
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
            <ProjectFileEditor doc={doc} onSaved={(updated) => setDoc(updated)} />
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
                onChange={(e) => setDraft(e.target.value)}
                spellCheck={false}
                disabled={isStreaming}
              />
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full w-full gap-2">
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
                {getTemplate(doc.template)?.label ?? doc.template} · {doc.pdfBase64 ? "PDF biên dịch" : "Chưa có PDF"} · Attempt {doc.attempts}
              </p>
            </div>
          </div>
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

      {/* 3-Column Layout: Preview (40%) | Chat Editor (60%) */}
      <div className="flex flex-col md:flex-row flex-1 gap-2 min-h-0 overflow-hidden">
        {/* Preview Column — 40% on lg, 50% on md, full on mobile */}
        <div className="flex-1 md:basis-2/5 min-h-0 overflow-y-auto">
          <div className="flex flex-col gap-2 h-full">
            <GlassPanel
              title="Xem trước"
              subtitle=""
              className="flex-1 min-h-0 p-2"
            >
              <ExpandableTabs
                items={previewTabs}
                value={tab}
                tablistLabel="Chọn chế độ xem tài liệu"
                onValueChange={(id) => {
                  if (id === "pdf" || id === "source") setTab(id);
                }}
              />
            </GlassPanel>
          </div>
        </div>

        {/* Chat Editor Column — 60% on lg, 50% on md, full on mobile */}
        <div className="w-full md:basis-3/5 min-h-0 overflow-y-auto">
          <GlassPanel title="Công cụ chỉnh sửa" subtitle="AI chat hoặc tệp tải lên" className="h-full p-2">
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
                      busy={isStreaming}
                    />
                  </div>

                  {/* Compile & Save Controls */}
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
                            isStreaming ||
                            draft.trim().length === 0,
                          onClick: () => compileMutation.mutate(draft),
                        },
                      ]}
                      overflowActions={[
                        {
                          id: "add-file",
                          label: "Thêm file",
                          icon: <FilePlusIcon className="size-4" aria-hidden="true" />,
                          disabled: saving,
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
                </>
              )}
            </div>
          </GlassPanel>
        </div>
      </div>

    </div>
  );
}
