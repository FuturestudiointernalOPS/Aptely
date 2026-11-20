/**
 * Frontend feature flags for the role-simplification work (Piste B).
 *
 * ROLE_PERSONAS_V1 is OFF by default. To enable it in dev/QA:
 *   NEXT_PUBLIC_ROLE_PERSONAS_V1=true
 * In production an explicit second opt-in is required, so the flag can never be
 * turned on accidentally by a generic environment variable:
 *   NEXT_PUBLIC_ROLE_PERSONAS_V1_PROD_QA=true
 *
 * Keep this module free of React imports so it can be used on both server and client.
 */
export const ROLE_PERSONAS_V1 =
  process.env.NEXT_PUBLIC_ROLE_PERSONAS_V1 === "true" &&
  (process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_ROLE_PERSONAS_V1_PROD_QA === "true");
