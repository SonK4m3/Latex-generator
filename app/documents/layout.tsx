import Link from "next/link";
import AuthStatus from "@/components/AuthStatus";
import { ThemeToggle } from "@/components/theme-toggle";

// Same Compile Room chrome as app/app/layout.tsx — a single document's
// workspace is part of the tool, not the marketing surface.
export default function DocumentsLayout({
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
