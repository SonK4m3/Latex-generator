import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "AI LaTeX Generator", short_name: "AI LaTeX", description: "Tạo PDF LaTeX biên dịch an toàn từ mô tả ngôn ngữ tự nhiên.", start_url: "/", display: "standalone", background_color: "#ffffff", theme_color: "#2563eb" };
}
