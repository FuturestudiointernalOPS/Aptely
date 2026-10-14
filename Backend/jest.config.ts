import type { Config } from "jest";

const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === "true";

const config: Config = {
  // Environnement Node.js (pas de browser)
  testEnvironment: "node",

  // Les tests sont dans tests/ — séparés du code source
  roots: ["<rootDir>/tests"],

  // Pattern des fichiers de test
  // Par défaut: only unit tests for deterministic local runs.
  // Integration tests (Supabase/network) are enabled explicitly with RUN_INTEGRATION_TESTS=true.
  testMatch: runIntegrationTests
    ? ["**/*.test.ts"]
    : ["**/unit/**/*.test.ts"],

  // Configuration de ts-jest : syntaxe moderne (non dépréciée)
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
  },

  // Résolution des alias @/* → src/* (mirror du tsconfig)
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },

  // Affichage verbose : montre chaque test individuellement
  verbose: true,

  // Timeout par test (Supabase peut être lent) : 15 secondes
  testTimeout: 40000,

  // Nettoie les mocks entre chaque test
  clearMocks: true,

  // Un run qui ne trouve aucun test ne doit pas échouer (CI sur un repo frais).
  passWithNoTests: true,
};

export default config;
