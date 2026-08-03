import { describe, expect, it } from "vitest";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

const DICTIONARIES = { en, fr } as const;

describe("i18n locale dictionaries", () => {
  it("contain only non-empty string values (valid JSON, no nested objects)", () => {
    for (const [locale, dict] of Object.entries(DICTIONARIES)) {
      for (const [key, value] of Object.entries(dict)) {
        expect(typeof value, `${locale}.json["${key}"] should be a string`).toBe("string");
        expect((value as string).trim().length, `${locale}.json["${key}"] should not be empty`).toBeGreaterThan(0);
      }
    }
  });

  it("have the exact same set of keys in fr and en (no missing translation → no fallback leak)", () => {
    const frKeys = new Set(Object.keys(fr));
    const enKeys = new Set(Object.keys(en));

    const missingInEn = [...frKeys].filter((k) => !enKeys.has(k));
    const missingInFr = [...enKeys].filter((k) => !frKeys.has(k));

    expect(missingInEn, "keys present in fr.json but missing in en.json (will leak FR text in EN locale)").toEqual([]);
    expect(missingInFr, "keys present in en.json but missing in fr.json (will leak EN text in FR locale)").toEqual([]);
  });
});
