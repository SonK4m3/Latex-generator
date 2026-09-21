"use client";

import LogoutButton from "@/components/LogoutButton";

export default function AuthStatusClientRender({ email }: { email: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-xs text-muted-foreground sm:inline">
        {email}
      </span>
      <LogoutButton />
    </div>
  );
}
