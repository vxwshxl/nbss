import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // `.next-build` is the alternate output `pnpm build:safe` writes to, so a
  // build can run while `pnpm dev` holds `.next`. It was missing here, which
  // meant linting after a safe build reported thousands of problems in
  // generated code and buried the handful in `src`.
  {
    ignores: [
      ".next/**",
      ".next-build/**",
      "out/**",
      "node_modules/**",
      "next-env.d.ts",
    ],
  },
];

export default config;
