import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getMcpConfig } from "@/lib/auth/mcp-config";
import { safeOAuthRedirect, validAuthorizationId } from "./oauth-redirect";

export const dynamic = "force-dynamic";

export default async function ConsentPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const config = getMcpConfig();
  if (!config.enabled) notFound();
  const authorizationId = (await searchParams).authorization_id;
  if (!validAuthorizationId(authorizationId)) return <ConsentError />;
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const returnTo = `/auth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
    redirect(`/login?redirectTo=${encodeURIComponent(returnTo)}`);
  }
  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data) return <ConsentError />;
  if ("redirect_url" in data) {
    const destination = safeOAuthRedirect(data.redirect_url);
    return <main className="mx-auto max-w-lg p-8">
      <h1 className="text-xl font-semibold">Yêu cầu đã được xử lý</h1>
      {destination ? <a className="underline" href={destination}>Quay lại ứng dụng</a> : <p>Không thể mở địa chỉ trả về.</p>}
    </main>;
  }
  if (data.user.id !== user.id || !config.allowedClientIds.includes(data.client.id)) return <ConsentError />;
  return <main className="mx-auto flex max-w-lg flex-col gap-5 p-8">
    <h1 className="text-2xl font-semibold">Kết nối {data.client.name}</h1>
    <p>Ứng dụng này yêu cầu truy cập tài khoản {user.email ?? user.id}.</p>
    <p>Khi đồng ý, ứng dụng có thể đọc và sửa tài liệu của bạn, tạo tài liệu mới,
      gửi mã LaTeX để biên dịch, tải PDF và hủy tác vụ biên dịch qua MCP.</p>
    <p className="text-sm">Đây là một quyền kết nối chung cho toàn bộ công cụ MCP hiện có,
      không có lựa chọn quyền riêng theo thao tác. Công cụ chỉ truy cập tài liệu thuộc tài khoản
      này. Thu hồi kết nối sẽ chặn các yêu cầu tiếp theo.</p>
    <p className="text-sm">OAuth scopes được yêu cầu: {data.scope || "Không có"}.</p>
    <p className="break-all text-sm text-muted-foreground">Địa chỉ trả về: {data.redirect_uri}</p>
    <form action="/auth/consent/decision" method="post" className="flex gap-3">
      <input type="hidden" name="authorization_id" value={authorizationId} />
      <button type="submit" name="decision" value="deny" className="rounded-md border px-4 py-2">Từ chối</button>
      <button type="submit" name="decision" value="approve" className="rounded-md bg-primary px-4 py-2 text-primary-foreground">Đồng ý kết nối</button>
    </form>
  </main>;
}

function ConsentError() {
  return <main className="mx-auto max-w-lg p-8">
    <h1 className="text-xl font-semibold">Không thể xác minh yêu cầu kết nối</h1>
    <p>Yêu cầu có thể đã hết hạn hoặc ứng dụng chưa được phép. Hãy bắt đầu kết nối lại từ ứng dụng.</p>
  </main>;
}
