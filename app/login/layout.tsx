import Link from "next/link";
import AuthStatusClient from "@/components/AuthStatusClient";
import { ThemeToggle } from "@/components/theme-toggle";

// Same Compile Room chrome as app/app/layout.tsx — login is a pre-auth step
// of the tool, not the marketing surface, so it keeps the tool's header.
export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-2">
        <Link href="/app" className="text-sm font-semibold">
          AI LaTeX Generator
        </Link>
        <div className="flex items-center gap-4">
          <AuthStatusClient />
          <ThemeToggle />
        </div>
      </header>
      {children}
    </div>
  );
}
