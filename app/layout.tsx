import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import Providers from "@/components/providers";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Landing page only ("The Compile Room" tool world stays on Geist Sans/Mono
// per root DESIGN.md's One-Face Rule). Loaded here so Next can optimize and
// self-host it; landing.css references the variable with a system-serif
// fallback chain.
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "AI LaTeX Generator",
  description:
    "Mô tả tài liệu bằng ngôn ngữ tự nhiên → nhận PDF LaTeX biên dịch an toàn.",
};

// Root layout stays minimal on purpose: fonts + providers only. The landing
// page (/) and the tool (/app, /documents/[id]) each own their own chrome —
// the landing page's committed visual world must not inherit the tool's
// Operate-mode header (AuthStatus/ThemeToggle live in app/app/layout.tsx and
// app/documents/[id]/layout.tsx instead). See .impeccable/surface-briefs/landing-page.md.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${jakarta.variable} ${geistMono.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
