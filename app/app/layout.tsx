import Link from "next/link";
import AuthStatus from "@/components/AuthStatus";
import { ThemeToggle } from "@/components/theme-toggle";

// The Compile Room (Operate mode) header — scoped to the authenticated tool
// only. See root DESIGN.md for the visual system this chrome follows.
export default function AppLayout({
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
          <AuthStatus />
          <ThemeToggle />
        </div>
      </header>
      {children}
    </div>
  );
}
