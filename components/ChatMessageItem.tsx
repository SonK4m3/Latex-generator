"use client";

import { CircleCheckIcon, FileTextIcon, TriangleAlertIcon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  Message, 
  MessageAvatar, 
  MessageContent, 
  MessageFooter, 
  MessageHeader, 
  MessageBubble, 
  MessageBubbleContent, 
  MessageMarker 
} from "@/components/agents/message";
import { AgentProgress } from "@/components/agents/loading-states/agent-progress";
import { CodeBlock } from "@/components/agents/code-block";
import ClarificationQuestionForm from "@/components/ClarificationQuestionForm";
import type { ChatItem, StepStatus } from "@/components/useDocumentGenerationChat";

function stepStatusLabel(status?: StepStatus): string {
  if (!status) return "Đang tạo tài liệu…";
  switch (status.step) {
    case "understanding":
      return "Đang phân tích yêu cầu…";
    case "analyzing":
      return "Đang chuẩn bị nội dung…";
    case "planned":
      return "Chờ duyệt dàn ý…";
    case "generating":
      return "Đang sinh mã LaTeX…";
    case "compiling":
      return "Đang biên dịch PDF…";
    case "repairing":
      return `Đang tự sửa lỗi (lần ${status.attempt}, ${status.errorType})…`;
    default:
      return "Đang xử lý…";
  }
}

export default function ChatMessageItem({
  item,
  onOpen,
  onOpenFull,
  onAnswerClarification,
}: {
  item: ChatItem;
  onOpen: (docId: string) => void;
  onOpenFull?: () => void;
  onAnswerClarification: (botId: string, jobId: string, answers: Record<string, string>) => void;
}) {
  if (item.role === "user") {
    return (
      <Message from="user">
        <MessageContent>
          <MessageBubble variant="solid" className="bg-primary text-primary-foreground">
            <MessageBubbleContent>{item.text}</MessageBubbleContent>
          </MessageBubble>
        </MessageContent>
      </Message>
    );
  }

  return (
    <Message from="assistant" animateIn>
      <MessageAvatar>
        <Avatar className="w-8 h-8">
          <AvatarFallback className="text-xs">AI</AvatarFallback>
        </Avatar>
      </MessageAvatar>
      <MessageContent>
        <MessageHeader>Trợ lý AI LaTeX</MessageHeader>

        {item.status === "streaming" && (
          <>
            {item.streamedLatex ? (
              <MessageBubble variant="ghost" className="bg-muted w-full max-w-full">
                <MessageBubbleContent>
                  {/* CodeBlock ở chế độ streaming: tô sáng LaTeX và tự cuộn
                      theo mép dưới khi mã đang được sinh dần. */}
                  <CodeBlock
                    code={item.streamedLatex}
                    language="latex"
                    status="streaming"
                    maxHeight={224}
                    copyable={false}
                    className="w-full"
                  />
                </MessageBubbleContent>
              </MessageBubble>
            ) : null}
            <MessageMarker className="mr-auto ml-0 flex items-center justify-start bg-transparent">
              <AgentProgress label={stepStatusLabel(item.stepStatus)} />
            </MessageMarker>
          </>
        )}

        {item.status === "done" && (
          <>
            <MessageBubble variant="soft" className="bg-muted text-foreground">
              <MessageBubbleContent>{item.text}</MessageBubbleContent>
            </MessageBubble>
            {item.docId &&
              (item.error ? (
                <MessageMarker className="border border-destructive/50 text-destructive mr-auto ml-0 flex gap-2">
                  <TriangleAlertIcon className="w-4 h-4" />
                  Biên dịch PDF chưa thành công
                </MessageMarker>
              ) : (
                <MessageMarker className="mr-auto ml-0 flex gap-2 text-primary bg-primary/10">
                  <CircleCheckIcon className="w-4 h-4" />
                  Đã tạo tài liệu
                </MessageMarker>
              ))}
            {item.docId && (
              <MessageFooter className="gap-2 mt-2">
                <Button
                  size="sm"
                  variant={item.error ? "outline" : "default"}
                  onClick={() => onOpen(item.docId as string)}
                >
                  <FileTextIcon className="w-4 h-4 mr-2" />
                  Xem trong bảng bên
                </Button>
                {onOpenFull && (
                  <Button size="sm" variant="ghost" onClick={onOpenFull}>
                    Mở toàn màn hình
                  </Button>
                )}
              </MessageFooter>
            )}
          </>
        )}

        {item.status === "awaiting_clarification" && item.clarification && (
          <>
            <MessageMarker className="border border-warning text-warning mr-auto ml-0 flex gap-2">
              <TriangleAlertIcon className="w-4 h-4" />
              Cần thêm thông tin trước khi tạo tài liệu
            </MessageMarker>
            <ClarificationQuestionForm
              questions={item.clarification.questions}
              onSubmit={(answers) =>
                onAnswerClarification(item.id, item.clarification!.jobId, answers)
              }
            />
          </>
        )}

        {item.status === "error" && (
          <>
            <MessageBubble variant="danger" className="bg-destructive text-destructive-foreground">
              <MessageBubbleContent>{item.error ?? "Đã xảy ra lỗi khi tạo tài liệu."}</MessageBubbleContent>
            </MessageBubble>
            <MessageMarker className="border border-destructive/50 text-destructive mr-auto ml-0 flex gap-2">
              <TriangleAlertIcon className="w-4 h-4" />
              Không tạo được tài liệu
            </MessageMarker>
          </>
        )}
      </MessageContent>
    </Message>
  );
}
