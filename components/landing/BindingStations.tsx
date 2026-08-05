/**
 * The fused staging device: four binding stations (fold, stitch, stamp,
 * seal) stand in for a generic progress bar/step list, dramatizing the
 * product's real self-healing repair loop as a literal bookbinding
 * sequence. "stitch" is where a failed compile gets patched and re-run
 * before continuing — the moment the mechanism actually proves itself.
 */
type Station = {
  id: "fold" | "stitch" | "stamp" | "seal";
  label: string;
  detail: string;
};

const STATIONS: Station[] = [
  { id: "fold", label: "Gấp bản thảo", detail: "Mô tả của bạn → cấu trúc LaTeX" },
  { id: "stitch", label: "Khâu & tự sửa", detail: "Biên dịch thử, tự vá lỗi nếu có" },
  { id: "stamp", label: "Đóng dấu", detail: "Kiểm tra cấu trúc trước khi in" },
  { id: "seal", label: "Niêm phong", detail: "PDF biên dịch thật, sẵn sàng" },
];

export function BindingStations({
  variant,
}: {
  variant: "hero" | "explainer";
}) {
  return (
    <ol
      className={
        variant === "hero" ? "ll-stations ll-stations--hero" : "ll-stations"
      }
    >
      {STATIONS.map((station, index) => (
        <li key={station.id} className="ll-station" data-station={station.id}>
          <span className="ll-station-medallion" aria-hidden="true">
            <StationGlyph id={station.id} />
          </span>
          <span className="ll-station-body">
            <span className="ll-station-label">{station.label}</span>
            {variant === "explainer" ? (
              <span className="ll-station-detail">{station.detail}</span>
            ) : null}
          </span>
          {index < STATIONS.length - 1 ? (
            <span className="ll-station-thread" aria-hidden="true" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function StationGlyph({ id }: { id: Station["id"] }) {
  switch (id) {
    case "fold":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 6h16M4 12h16M4 18h10"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case "stitch":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeDasharray="2.5 2.5"
          />
        </svg>
      );
    case "stamp":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect
            x="6"
            y="4"
            width="12"
            height="12"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path d="M9 20h6M12 16v4" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    case "seal":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M12 8.5l1.3 2.6 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4L12 8.5z"
            fill="currentColor"
          />
        </svg>
      );
  }
}
