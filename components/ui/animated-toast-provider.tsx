"use client";

// Provider thông báo dạng toast cho toàn app, bọc quanh beUI AnimatedToastStack.
//
// Trước đây mọi phản hồi (lưu nháp lỗi, xoá thất bại, biên dịch xong) đều nằm
// tại chỗ dưới dạng dòng chữ nhỏ, dễ bị bỏ qua khi user đang nhìn chỗ khác.
// Provider này cho bất kỳ client component nào gọi `useToast().toast({...})`.
//
// Toast là hiệu ứng phụ thuần client nên state giữ ở đây, không đẩy vào store.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AnimatedToastStack,
  type AnimatedToast,
  type ToastInput,
} from "@/components/motion/animated-toast-stack";

interface ToastContextValue {
  /** Đẩy một toast mới; trả về id để có thể chủ động đóng. */
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Số toast hiển thị đồng thời; quá ngưỡng thì toast cũ nhất bị loại. */
const MAX_TOASTS = 4;

/** Thời gian tự đóng mặc định (ms). Toast lỗi để lâu hơn cho user kịp đọc. */
const DEFAULT_DURATION = 4000;
const ERROR_DURATION = 8000;

export function AnimatedToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<AnimatedToast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const id = input.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const next: AnimatedToast = {
      dismissible: true,
      duration:
        input.duration ??
        (input.status === "error" ? ERROR_DURATION : DEFAULT_DURATION),
      ...input,
      id,
      createdAt: Date.now(),
    };
    setToasts((prev) => {
      // Cùng id ⇒ cập nhật tại chỗ (dùng cho toast "đang lưu…" → "đã lưu").
      const existing = prev.findIndex((t) => t.id === id);
      if (existing >= 0) {
        const copy = [...prev];
        copy[existing] = next;
        return copy;
      }
      return [...prev, next].slice(-MAX_TOASTS);
    });
    return id;
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <AnimatedToastStack
        toasts={toasts}
        onDismiss={dismiss}
        position="bottom-right"
        placement="fixed"
      />
    </ToastContext.Provider>
  );
}

/**
 * Truy cập hàm đẩy toast. Ném lỗi nếu gọi ngoài provider — sai chỗ này là lỗi
 * lập trình, im lặng bỏ qua sẽ khiến thông báo biến mất không dấu vết.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast phải được dùng bên trong <AnimatedToastProvider>.");
  }
  return ctx;
}
