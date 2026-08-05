/**
 * Landing page — "The Thesis Binding & Title Page" (Persuade mode).
 *
 * THESIS: A generated document isn't just text — it's a real, finished, bound
 * thing, the way a thesis viva copy is real. Refuses the generic
 * "chat bubble -> magic AI output" SaaS arrangement.
 * OWN-WORLD: Cloth-spine navy/charcoal ground, deckle-edge cream paper panels,
 * gold-foil serif display type (small caps, wide tracking), wax-seal red as
 * the single committed accent, a university-seal medallion reused as a
 * compile-status badge.
 * STORY: rough notes -> a real, finished, bound document, self-healing when
 * it breaks. Believed because the binding stations show the repair loop,
 * not because it's claimed.
 * FIRST VIEWPORT: full-bleed cloth-spine ground; gold-foil tracked title at
 * top; center-left a title card mid-assembly through fold/stitch/stamp/seal
 * stations; center-right the primary CTA as a stamped wax seal.
 * FORM: assigned direction index 7/7 (concept-seed key 0dcb7a30), fused with
 * the "Reduction Passes" staging challenger (binding stations replace a
 * generic progress bar). See .impeccable/surface-briefs/landing-page.md.
 */
import Link from "next/link";
import "./landing.css";
import { BindingStations } from "@/components/landing/BindingStations";
import { SealButton } from "@/components/landing/SealButton";
import { RevealPanel } from "@/components/landing/RevealPanel";

export const metadata = {
  title: "AI LaTeX Generator — Từ ý tưởng đến luận văn thật, biên dịch được",
  description:
    "Mô tả tài liệu bằng tiếng Việt hoặc tiếng Anh, nhận PDF LaTeX biên dịch an toàn với vòng tự sửa lỗi — không phải văn bản giống LaTeX không biên dịch được.",
};

export default function LandingPage() {
  return (
    <div className="ll-root">
      <header className="ll-topbar">
        <span className="ll-wordmark">AI LATEX GENERATOR</span>
        <nav className="ll-topnav">
          <a href="#how-it-works">Cách hoạt động</a>
          <Link href="/login">Đăng nhập</Link>
        </nav>
      </header>

      <main>
        {/* First viewport: the thesis being bound is the thesis of the page. */}
        <section className="ll-hero">
          <div className="ll-hero-grain" aria-hidden="true" />
          <div className="ll-hero-grid">
            <div className="ll-hero-copy">
              <h1 className="ll-title">
                Luận văn của bạn,
                <br />
                đóng gáy thật.
              </h1>
              <p className="ll-lede">
                Mô tả tài liệu bằng ngôn ngữ tự nhiên — tiếng Việt hoặc tiếng
                Anh. Nhận về không phải văn bản trông giống LaTeX, mà một PDF{" "}
                <em>biên dịch được thật</em>, trong sandbox an toàn, với vòng
                tự sửa lỗi khi bản đầu chưa đúng.
              </p>
              <div className="ll-cta-row">
                <SealButton href="/app">Bắt đầu tài liệu</SealButton>
                <a className="ll-secondary-link" href="#how-it-works">
                  Xem quy trình đóng gáy ↓
                </a>
              </div>
              <p className="ll-disclaimer">
                Minh hoạ quy trình dưới đây là dữ liệu mô phỏng, không phải
                tài liệu thật của người dùng.
              </p>
            </div>

            <div className="ll-hero-stage" aria-hidden="true">
              <BindingStations variant="hero" />
            </div>
          </div>
        </section>

        {/* The binding-station sequence, reused as the "how it works" body. */}
        <section id="how-it-works" className="ll-how">
          <h2 className="ll-section-title">Quy trình đóng gáy</h2>
          <p className="ll-section-lede">
            Mỗi bước là một trạm thật trong hệ thống — không phải một thanh
            tiến trình chung. Khi bản in bị lỗi, hệ thống tự quay lại sửa
            trước khi đóng dấu hoàn tất.
          </p>
          <BindingStations variant="explainer" />
        </section>

        {/* Proof: the actual tool (The Compile Room, Operate world) shown as
            a deliberate before/after against the landing world. */}
        <RevealPanel />

        <section className="ll-closing">
          <p className="ll-closing-kicker">Không cần biết cú pháp LaTeX.</p>
          <h2 className="ll-closing-title">
            Bắt đầu tài liệu tiếp theo của bạn.
          </h2>
          <SealButton href="/app">Bắt đầu tài liệu</SealButton>
        </section>
      </main>

      <footer className="ll-footer">
        <span>AI LaTeX Generator</span>
        <Link href="/login">Đăng nhập</Link>
      </footer>
    </div>
  );
}
