import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // compile-service là microservice Node (CommonJS) độc lập — lint riêng.
    "compile-service/**",
    // Thư mục công cụ/agent-skills (script CommonJS, không thuộc mã nguồn app) — lint riêng.
    ".claude/**",
    ".agents/**",
    ".agent/**",
    ".kiro/**",
    ".specify/**",
    "test_fetch.js",
  ]),
  // Mã nguồn cài từ registry beUI (`npx shadcn add @beui/...`). Đây là nguồn
  // của bên thứ ba được nhả vào repo, viết theo bộ lint riêng của beUI, nên nó
  // vi phạm vài quy tắc React nghiêm hơn của dự án (set-state-in-effect,
  // purity). Hạ xuống mức "warn" thay vì tắt hẳn: vẫn nhìn thấy được khi đọc
  // lại, nhưng không làm đỏ CI vì mã mình không viết.
  //
  // Lưu ý: TypeScript vẫn kiểm tra đầy đủ các tệp này (không nằm trong
  // tsconfig exclude), và các tệp mình đã chỉnh tay (agent-code.tsx,
  // prompt-input.tsx) vẫn phải tự chịu trách nhiệm về kiểu.
  {
    files: ["components/agents/**/*.{ts,tsx}", "components/motion/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/static-components": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
