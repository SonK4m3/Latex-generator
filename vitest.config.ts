import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "tests/**/*.test.{ts,tsx}",
      "app/**/*.test.{ts,tsx}",
      "lib/**/*.test.{ts,tsx}",
      // components/__tests__/** trước đây không nằm trong include nên 4 tệp test
      // ở đó chưa từng chạy (và đã lạc hậu so với component). Thêm vào để chúng
      // thực sự bảo vệ được code.
      "components/**/*.test.{ts,tsx}",
    ],
    exclude: ["node_modules/**", "compile-service/**", ".next/**"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
