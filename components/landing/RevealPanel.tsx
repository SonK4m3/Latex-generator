/**
 * Deliberate before/after: shows the actual tool UI (The Compile Room,
 * Operate-mode world documented in root DESIGN.md) inside a "reveal" frame
 * on the binding world's ground, rather than letting the two visual systems
 * clash directly. This is the landing page's one honest proof point: real
 * product chrome, clearly framed as what you get after the seal breaks.
 */
export function RevealPanel() {
  return (
    <section className="ll-reveal" aria-labelledby="ll-reveal-heading">
      <div className="ll-reveal-copy">
        <p className="ll-reveal-kicker">Bên trong lớp bìa</p>
        <h2 id="ll-reveal-heading" className="ll-reveal-title">
          Một công cụ làm việc thật, không phải bản demo.
        </h2>
        <p className="ll-reveal-lede">
          Sau khi niêm phong, bạn làm việc trong không gian biên tập gọn gàng:
          chat để chỉnh sửa bằng ngôn ngữ tự nhiên, sửa mã nguồn thủ công, xem
          PDF thật ngay lập tức.
        </p>
      </div>
      <div className="ll-reveal-frame" role="img" aria-label="Giao diện xem trước PDF và mã nguồn LaTeX của công cụ, với hai thẻ chuyển đổi và khung xem tài liệu bên dưới.">
        <div className="ll-reveal-frame-chrome">
          <span className="ll-reveal-dot" />
          <span className="ll-reveal-dot" />
          <span className="ll-reveal-dot" />
        </div>
        <div className="ll-reveal-frame-body">
          <div className="ll-reveal-tabs">
            <span className="ll-reveal-tab ll-reveal-tab--active">PDF</span>
            <span className="ll-reveal-tab">Mã nguồn</span>
          </div>
          <div className="ll-reveal-page" />
        </div>
      </div>
    </section>
  );
}
