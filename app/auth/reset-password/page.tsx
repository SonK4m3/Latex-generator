"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setError(undefined); setMessage(undefined);
    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);
    if (error) return setError("Không thể đổi mật khẩu. Hãy mở lại liên kết từ email.");
    setMessage("Đã đổi mật khẩu. Bạn có thể đăng nhập lại.");
    router.replace("/app"); router.refresh();
  }

  return <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
    <div><h1 className="text-2xl font-semibold">Đặt lại mật khẩu</h1><p className="text-sm text-muted-foreground">Chọn mật khẩu mới cho tài khoản của bạn.</p></div>
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium">Mật khẩu mới<Input type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      <Button type="submit" disabled={loading}>{loading ? "Đang lưu…" : "Đổi mật khẩu"}</Button>
    </form>
  </main>;
}
