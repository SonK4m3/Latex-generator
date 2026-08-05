// Daily generation admission is intentionally independent from app configuration.
// It is only active for the Supabase store, where the SQL RPC performs an atomic
// increment-and-limit check under the authenticated user's session/RLS context.

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export interface GenerationQuotaResult {
  allowed: boolean;
  used: number;
  limit: number;
}

export async function consumeDailyGenerationQuota(): Promise<GenerationQuotaResult> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.rpc("consume_daily_generation_quota");
  if (error) throw new Error("Không thể kiểm tra hạn mức tạo tài liệu.");

  const row = (data as unknown as Array<{
    allowed: boolean;
    used: number;
    limit_value: number;
  }>)[0];
  if (!row) throw new Error("Không nhận được hạn mức tạo tài liệu.");

  return { allowed: row.allowed, used: row.used, limit: row.limit_value };
}
