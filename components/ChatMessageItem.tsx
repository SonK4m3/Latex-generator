"use client";

// Hiển thị MỘT lượt hội thoại bằng các thành phần chat của shadcn/ui:
// Message (bố cục hàng) + Bubble (bề mặt tin nhắn) + Marker (trạng thái/hệ thống).
import { CircleCheckIcon, FileTextIcon, TriangleAlertIcon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { Spinner } from "@/components/ui/spinner";
import ClarificationQuestionForm from "@/components/ClarificationQuestionForm";
import type { ChatItem, StepStatus } from "@/components/useDocumentGenerationChat";

/** Nhãn tiếng Việt cho từng bước — phản hồi trực tiếp phản hồi dogfood: "không cho xem các step,
 *  phải đợi gen ra hết rồi mới được xem". Mỗi bước hiện tên cụ thể, lần tự sửa hiện rõ số lần +
 *  loại lỗi để người dùng biết hệ thống đang thật sự làm gì, không phải 1 spinner mơ hồ. */
function stepStatusLabel(status?: StepStatus): string {
  if (!status) return "Đang tạo tài liệu…";
  switch (status.step) {
    case "understanding":
      return "Đang phân tích yêu cầu…";
    case "analyzing":
      return "Đang chuẩn bị nội dung…";
    case "generating":
      return "Đang sinh mã LaTeX…";
    case "compiling":
      return "Đang biên dịch PDF…";
    case "repairing":
      return `Đang tự sửa lỗi (lần ${status.attempt}, ${status.errorType})…`;
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
  /** Mở route chỉnh sửa đầy đủ (/documents/[id]) — luôn có sẵn như lối thoát, phòng khi cần sửa
   *  sâu (multi-file, chat-edit lịch sử) mà panel preview trong /app không phục vụ. */
  onOpenFull?: () => void;
  onAnswerClarification: (botId: string, jobId: string, answers: Record<string, string>) => void;
}) {
  // Lượt của người dùng: căn phải, bong bóng primary, không cần avatar.
  if (item.role === "user") {
    return (
      <Message align="end">
        <MessageContent>
          <Bubble variant="default" align="end">
            <BubbleContent>{item.text}</BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    );
  }

  // Lượt của trợ lý: căn trái, có avatar + tên.
  return (
    <Message align="start">
      <MessageAvatar>
        <Avatar>
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
      </MessageAvatar>
      <MessageContent>
        <MessageHeader>Trợ lý AI LaTeX</MessageHeader>

        {item.status === "streaming" && (
          <>
            {item.streamedLatex ? (
              <Bubble variant="ghost">
                <BubbleContent>
                  <pre className="max-h-56 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
                    {item.streamedLatex}
                  </pre>
                </BubbleContent>
              </Bubble>
            ) : null}
            <Marker role="status">
              <MarkerIcon>
                <Spinner />
              </MarkerIcon>
              <MarkerContent className="shimmer">{stepStatusLabel(item.stepStatus)}</MarkerContent>
            </Marker>
          </>
        )}

        {item.status === "done" && (
          <>
            <Bubble variant="secondary">
              <BubbleContent>{item.text}</BubbleContent>
            </Bubble>
            {item.docId &&
              (item.error ? (
                <Marker variant="border" role="status">
                  <MarkerIcon>
                    <TriangleAlertIcon />
                  </MarkerIcon>
                  <MarkerContent>Biên dịch PDF chưa thành công</MarkerContent>
                </Marker>
              ) : (
                <Marker role="status">
                  <MarkerIcon>
                    <CircleCheckIcon />
                  </MarkerIcon>
                  <MarkerContent>Đã tạo tài liệu</MarkerContent>
                </Marker>
              ))}
            {item.docId && (
              <MessageFooter>
                <Button
                  size="sm"
                  variant={item.error ? "outline" : "default"}
                  onClick={() => onOpen(item.docId as string)}
                >
                  <FileTextIcon data-icon="inline-start" />
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
            <Marker role="status">
              <MarkerIcon>
                <TriangleAlertIcon />
              </MarkerIcon>
              <MarkerContent>Cần thêm thông tin trước khi tạo tài liệu</MarkerContent>
            </Marker>
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
            <Bubble variant="destructive">
              <BubbleContent>{item.error ?? "Đã xảy ra lỗi khi tạo tài liệu."}</BubbleContent>
            </Bubble>
            <Marker variant="border" role="status">
              <MarkerIcon>
                <TriangleAlertIcon />
              </MarkerIcon>
              <MarkerContent>Không tạo được tài liệu</MarkerContent>
            </Marker>
          </>
        )}
      </MessageContent>
    </Message>
  );
}
