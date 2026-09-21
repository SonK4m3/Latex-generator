"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileTextIcon, PaperclipIcon, PlusIcon, SendHorizontalIcon, SparklesIcon, XIcon } from "lucide-react";
import MarkdownIt from "markdown-it";

import type { TemplateId } from "@/lib/types/document";
import { getTemplate, listTemplates } from "@/lib/templates/registry";
import { useDocumentGenerationChat } from "@/components/useDocumentGenerationChat";
import { SOURCE_ACCEPT, extOf, isTextLike, filesToSources } from "@/components/source-upload";
import ChatMessageItem from "@/components/ChatMessageItem";

import { PromptInput } from "@/components/agents/prompt-input";
import { MessageScroller } from "@/components/agents/message-scroller";
import { Button } from "@/components/ui/button";

function groupedTemplates() {
  const groups: { category: string; items: ReturnType<typeof listTemplates> }[] = [];
  for (const t of listTemplates()) {
    let g = groups.find((x) => x.category === t.category);
    if (!g) {
      g = { category: t.category, items: [] };
      groups.push(g);
    }
    g.items.push(t);
  }
  return groups;
}

const previewMd = new MarkdownIt({ html: false, linkify: false, typographer: false });
const TEMPLATE_GROUPS = groupedTemplates();

const PROMPT_MODELS = TEMPLATE_GROUPS.flatMap((g) =>
  g.items.map((t) => ({
    value: t.id,
    label: t.label,
    icon: <FileTextIcon className="w-4 h-4" />,
  }))
);

export default function ChatAssistant({
  onPreview,
}: {
  onPreview?: (item: import("@/components/useDocumentGenerationChat").ChatItem) => void;
}) {
  const router = useRouter();
  const { items, busy, send, reset, cancel, answerClarification, approvePlan } = useDocumentGenerationChat();
  const [template, setTemplate] = useState<TemplateId>("academic");
  const [text, setText] = useState("");
  const [markdownMode, setMarkdownMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [extractError, setExtractError] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const active = getTemplate(template);
  const canSend = !busy && !preparing && (text.trim().length > 0 || (!markdownMode && files.length > 0));

  const lastCompletedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!onPreview) return;
    const lastDone = [...items].reverse().find((it) => it.status === "done" && it.docId);
    if (lastDone && lastDone.id !== lastCompletedIdRef.current) {
      lastCompletedIdRef.current = lastDone.id;
      onPreview(lastDone);
    }
  }, [items, onPreview]);

  useEffect(() => {
    const handlePlanApproved = (e: Event) => {
      const customEvent = e as CustomEvent<{ botId: string; docId: string; plan: string }>;
      const { botId, docId, plan } = customEvent.detail;
      approvePlan(botId, docId, plan);
    };

    window.addEventListener("plan-approved", handlePlanApproved);
    return () => window.removeEventListener("plan-approved", handlePlanApproved);
  }, [approvePlan]);

  const previewHtml = useMemo(
    () => (markdownMode && showPreview ? previewMd.render(text) : ""),
    [markdownMode, showPreview, text],
  );

  function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files ? Array.from(e.target.files) : [];
    setFiles((prev) => {
      const map = new Map(prev.map((f) => [f.name, f]));
      for (const f of picked) map.set(f.name, f);
      return [...map.values()];
    });
    e.target.value = "";
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  async function submit(promptValue: string, selectedModel?: string) {
    if (!canSend && !promptValue) return;

    const currentTemplate = (selectedModel as TemplateId) || template;

    if (markdownMode) {
      send(promptValue, currentTemplate, "markdown");
      setText("");
      return;
    }

    setExtractError(undefined);
    let sources: { name: string; content: string }[] = [];
    if (files.length > 0) {
      setPreparing(true);
      try {
        const res = await filesToSources(files);
        sources = res.sources;
        if (res.errors.length) setExtractError(res.errors.join(" · "));
      } finally {
        setPreparing(false);
      }
      if (sources.length === 0 && promptValue.trim().length === 0) return;
    }

    send(promptValue, currentTemplate, "natural", sources);
    setText("");
    setFiles([]);
  }

  return (
    <section className="flex h-full min-h-[520px] flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={reset}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Hội thoại mới
        </Button>
        <span className="truncate text-xs text-muted-foreground" title={active?.description ?? ""}>
          Đang chọn: <span className="font-medium text-foreground">{active?.label ?? ""}</span>
        </span>
      </header>

      <MessageScroller className="flex-1 min-h-0 rounded-lg border bg-background" contentClassName="px-4 py-4 mb-8">
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <ChatMessageItem
              key={item.id}
              item={item}
              onOpen={(docId) => onPreview ? onPreview(item) : router.push(`/documents/${docId}`)}
              onOpenFull={() => router.push(`/documents/${item.docId}`)}
              onAnswerClarification={answerClarification}
            />
          ))}
        </div>
      </MessageScroller>

      <div className="flex flex-col gap-2">
        {markdownMode && showPreview && (
          <div className="max-h-48 overflow-auto rounded-lg border bg-background p-3 text-sm">
            <div className="mb-1 text-xs text-muted-foreground">Xem trước Markdown</div>
            {text.trim() ? (
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <span className="text-muted-foreground">Chưa có nội dung.</span>
            )}
          </div>
        )}
        {!markdownMode && files.length > 0 && (
          <ul className="flex flex-wrap gap-1">
            {files.map((f) => (
              <li key={f.name} className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs">
                <span className="max-w-[16rem] truncate">{f.name}</span>
                <button
                  type="button"
                  className="text-red-600"
                  disabled={busy || preparing}
                  onClick={() => removeFile(f.name)}
                >
                  <XIcon className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {extractError && (
          <p role="alert" className="text-xs text-amber-600">
            {extractError}
          </p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={SOURCE_ACCEPT}
          className="hidden"
          onChange={onFilesChange}
        />
        
        <PromptInput
          aria-label="Mô tả tài liệu"
          value={text}
          onValueChange={setText}
          disabled={busy || preparing}
          loading={busy || preparing}
          onStop={cancel}
          models={PROMPT_MODELS}
          model={template}
          onModelChange={(m) => setTemplate(m as TemplateId)}
          actions={[
            {
              value: "attach",
              label: "Đính kèm file",
              icon: <PaperclipIcon className="w-4 h-4" />,
            },
            {
              value: "toggle-markdown",
              label: markdownMode ? "Tắt Markdown" : "Bật Markdown",
              icon: <FileTextIcon className="w-4 h-4" />,
            },
            ...(markdownMode ? [{
              value: "toggle-preview",
              label: showPreview ? "Ẩn xem trước" : "Xem trước Markdown",
            }] : []),
          ]}
          onAction={(action) => {
            if (action === "attach") fileInputRef.current?.click();
            if (action === "toggle-markdown") setMarkdownMode(!markdownMode);
            if (action === "toggle-preview") setShowPreview(!showPreview);
          }}
          onSubmit={submit}
          sendLabel="Gửi yêu cầu tạo tài liệu"
          stopLabel="Huỷ tạo tài liệu"
          placeholder={markdownMode ? "Soạn Markdown..." : "Mô tả tài liệu bạn muốn tạo..."}
        />
      </div>
    </section>
  );
}
