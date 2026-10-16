import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // docs/report holds thesis tooling (k6 and Node scripts), not application code.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "docs/report/**"]),
]);
