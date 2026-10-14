import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "@typescript-eslint/no-explicit-any": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "off",
      "@next/next/no-img-element": "off",

      // ─── R3: Ban mkApiPath in components/pages — use named helpers ─────────
      "no-restricted-imports": ["error", {
        "paths": [{
          "name": "@/lib/routes",
          "importNames": ["mkApiPath"],
          "message": "R3: mkApiPath reserved for api.*.ts files. Use a named helper from routes.ts."
        }]
      }],

      // ─── R3: Ban hardcoded route path concatenation ──────────────────────
      // Never write `${API.foo}/bar` or `${ROUTES.foo}/bar` — use helpers from routes.ts.
      "no-restricted-syntax": [
        "error",
        {
          "selector": "TemplateLiteral:has(MemberExpression[object.name='API'] ~ TemplateElement[value.cooked=/^\\/[^?#]/])",
          "message": "R3 violation: use a helper from @/lib/routes.ts instead of `${API.x}/path`"
        },
        {
          "selector": "TemplateLiteral:has(MemberExpression[object.object.name='ROUTES'] ~ TemplateElement[value.cooked=/^\\/[^?#]/])",
          "message": "R3 violation: use a helper from @/lib/routes.ts instead of `${ROUTES.x}/path`"
        },
      ],
    },
  },
  // R3: mkApiPath is reserved FOR api.*.ts files — exempt them from the ban.
  {
    files: ["src/lib/api*.ts"],
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-syntax": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build tooling (CommonJS node scripts, not application code):
    "scripts/**",
  ]),
]);

export default eslintConfig;
