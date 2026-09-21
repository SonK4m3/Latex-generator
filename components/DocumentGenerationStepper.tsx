"use client";

// Tiến trình sinh tài liệu, dựng trên beUI AgentActivity.
//
// Trước đây đây là một thanh stepper tĩnh: nó cho biết đang ở bước nào nhưng
// không cho biết vòng tự sửa (validate → compile → repair) đã chạy bao nhiêu
// lần hay mất bao lâu. AgentActivity giữ nguyên chuỗi bước tuyến tính nhưng
// thêm: thời gian đã chạy, hàng trạng thái shimmer khi đang làm việc, và tự
// gập lại thành một dòng tóm tắt khi hoàn tất.
import { useEffect, useRef, useState } from "react";
import { AgentActivity } from "@/components/agents/agent-activity";
import type {
  AgentActivityItem,
  AgentStepStatus,
} from "@/components/agents/agent-activity/types";
import type { DocumentStatus } from "@/lib/types/document";

interface StepperProps {
  currentStatus: DocumentStatus;
  /** Số lần thử của vòng tự sửa, hiển thị kèm bước biên dịch. */
  attempts?: number;
  /** Thông báo lỗi hiện tại, nếu vòng tự sửa đang xử lý lỗi biên dịch. */
  errorMessage?: string;
}

const STEPS: { id: DocumentStatus; label: string; active: string }[] = [
  { id: "ANALYZING", label: "Phân tích yêu cầu", active: "Đang phân tích yêu cầu…" },
  { id: "PLANNED", label: "Dàn ý", active: "Đang dựng dàn ý…" },
  { id: "GENERATING", label: "Sinh mã LaTeX", active: "Đang sinh mã LaTeX…" },
  { id: "REVIEWING", label: "Kiểm cấu trúc & biên dịch", active: "Đang kiểm cấu trúc và biên dịch…" },
  { id: "EXPORTABLE", label: "Hoàn tất", active: "Đang hoàn tất…" },
];

/**
 * CLARIFYING gộp vào ANALYZING, COMPILING gộp vào REVIEWING — giữ đúng cách
 * gộp của bản stepper cũ để không đổi ngữ nghĩa hiển thị.
 */
function mapStatus(status: DocumentStatus): DocumentStatus {
  if (status === "CLARIFYING") return "ANALYZING";
  if (status === "COMPILING") return "REVIEWING";
  return status;
}

export default function DocumentGenerationStepper({
  currentStatus,
  attempts,
  errorMessage,
}: StepperProps) {
  const mapped = mapStatus(currentStatus);
  const currentIndex = STEPS.findIndex((s) => s.id === mapped);
  const isDone = mapped === "EXPORTABLE";

  // Đồng hồ chạy khi còn đang xử lý. Mốc bắt đầu được đặt trong effect (không
  // gọi Date.now() khi render, vì render phải thuần khiết), nên nó phản ánh
  // tổng thời gian của tiến trình chứ không reset mỗi bước.
  const startedAt = useRef<number | null>(null);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (isDone) return;
    startedAt.current ??= Date.now();
    const tick = () =>
      setDuration(Math.round((Date.now() - (startedAt.current ?? Date.now())) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [isDone]);

  const items: AgentActivityItem[] = STEPS.map((step, index) => {
    let status: AgentStepStatus = "pending";
    if (isDone || index < currentIndex) status = "complete";
    else if (index === currentIndex) status = "active";

    // Chỉ bước biên dịch mang thông tin vòng tự sửa.
    const isCompileStep = step.id === "REVIEWING";
    let meta: string | undefined;
    if (isCompileStep && typeof attempts === "number" && attempts > 1) {
      meta = `lần thử ${attempts}`;
    }
    if (isCompileStep && status === "active" && errorMessage) {
      meta = meta ? `${meta} · đang tự sửa` : "đang tự sửa";
    }

    return {
      id: step.id,
      type: "step",
      label: step.label,
      status,
      meta,
    };
  });

  const activeStep = currentIndex >= 0 ? STEPS[currentIndex] : undefined;

  return (
    <AgentActivity
      items={items}
      contentType="step"
      status={isDone ? "complete" : "working"}
      duration={duration}
      activeLabel={activeStep?.active ?? "Đang xử lý…"}
      summary={
        isDone
          ? typeof attempts === "number" && attempts > 1
            ? `Đã tạo tài liệu sau ${attempts} lần thử`
            : "Đã tạo tài liệu"
          : undefined
      }
      collapseOnComplete
      className="w-full"
    />
  );
}
