import { getCurrentUser } from "@/lib/auth/current-user";
import AuthStatusClientRender from "@/components/AuthStatusClientRender";
import Link from "next/link";

export default async function AuthStatusClient() {
  const user = await getCurrentUser();

  if (!user || !user.email) {
    return (
      <Link href="/login" className="text-sm font-medium underline">
        Đăng nhập
      </Link>
    );
  }

  return <AuthStatusClientRender email={user.email} />;
}
