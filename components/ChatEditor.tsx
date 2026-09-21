"use client";

import { useState } from "react";
import type { ChatMessage } from "@/lib/types/document";
import { PromptInput } from "@/components/agents/prompt-input";
import { MessageScroller } from "@/components/agents/message-scroller";
import { Message, MessageBubble, MessageBubbleContent, MessageContent, MessageAvatar } from "@/components/agents/message";
import { AgentProgress } from "@/components/agents/loading-states/agent-progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function ChatEditor({
  messages,
  onSend,
  onCancel,
  busy,
}: {
  messages: ChatMessage[];
  onSend: (instruction: string) => void;
  onCancel?: () => void;
  busy?: boolean;
}) {
  const [text, setText] = useState("");

  function submit(promptValue: string) {
    const t = promptValue.trim();
    if (!t || busy) return;
    onSend(t);
    setText("");
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <MessageScroller
        className="flex-1 space-y-4 overflow-auto rounded-lg border border-border bg-background px-4 py-4"
        contentClassName="flex flex-col gap-4"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <p className="text-sm font-medium text-foreground">Chỉnh sửa tài liệu bằng ngôn ngữ tự nhiên</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Hệ thống sẽ sửa mã LaTeX và biên dịch lại PDF tự động. Bạn không cần biết cú pháp LaTeX.
            </p>
            <ul className="mt-1 text-xs text-muted-foreground space-y-1 text-left">
              <li>💬 &quot;Thêm mục Kết luận vào cuối tài liệu&quot;</li>
              <li>💬 &quot;Đổi tiêu đề thành Báo cáo cuối kỳ&quot;</li>
              <li>💬 &quot;Viết lại phần giới thiệu ngắn gọn hơn&quot;</li>
            </ul>
          </div>
        )}
        
        {messages.map((m) => (
          <Message key={m.id} from={m.role === "user" ? "user" : "assistant"}>
            {m.role === "assistant" && (
              <MessageAvatar>
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs">AI</AvatarFallback>
                </Avatar>
              </MessageAvatar>
            )}
            <MessageContent>
              <MessageBubble variant={m.role === "user" ? "solid" : "soft"} className={m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}>
                <MessageBubbleContent>{m.content}</MessageBubbleContent>
              </MessageBubble>
            </MessageContent>
          </Message>
        ))}
        
        {busy && (
          <Message from="assistant" animateIn>
            <MessageAvatar>
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs">AI</AvatarFallback>
              </Avatar>
            </MessageAvatar>
            <MessageContent>
              <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground w-fit">
                <AgentProgress label="Đang xử lý yêu cầu…" />
              </div>
            </MessageContent>
          </Message>
        )}
      </MessageScroller>

      <PromptInput
        value={text}
        onValueChange={setText}
        disabled={busy}
        loading={busy}
        onStop={onCancel}
        onSubmit={submit}
        sendLabel="Gửi yêu cầu chỉnh sửa"
        stopLabel="Huỷ yêu cầu"
        placeholder="Nhập yêu cầu chỉnh sửa (Ví dụ: Đổi tiêu đề thành Báo cáo)..."
        className="min-h-16"
        aria-label="Yêu cầu chỉnh sửa"
      />
    </div>
  );
}
