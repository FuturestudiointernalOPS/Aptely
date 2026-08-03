export interface CountryRules {
  photo: "forbidden" | "optional" | "recommended";
  maxPages: number;
  age: "forbidden" | "optional";
  nationality: "forbidden" | "optional";
  address: "forbidden" | "city_only" | "recommended" | "optional";
  maritalStatus: "forbidden" | "optional";
  expectedFormat: string;
}

export const COUNTRY_CV_RULES: Record<string, CountryRules> = {
  France:          { photo: "optional",    maxPages: 1, age: "optional",  nationality: "optional",  address: "recommended", maritalStatus: "optional",  expectedFormat: "French CV" },
  "United States": { photo: "forbidden",   maxPages: 1, age: "forbidden", nationality: "forbidden", address: "city_only",   maritalStatus: "forbidden", expectedFormat: "US Resume" },
  "United Kingdom":{ photo: "forbidden",   maxPages: 2, age: "forbidden", nationality: "forbidden", address: "optional",    maritalStatus: "forbidden", expectedFormat: "UK CV" },
  Germany:         { photo: "recommended", maxPages: 2, age: "optional",  nationality: "optional",  address: "recommended", maritalStatus: "optional",  expectedFormat: "German Lebenslauf" },
  Belgium:         { photo: "optional",    maxPages: 2, age: "optional",  nationality: "optional",  address: "recommended", maritalStatus: "optional",  expectedFormat: "European CV" },
  Switzerland:     { photo: "recommended", maxPages: 2, age: "optional",  nationality: "optional",  address: "recommended", maritalStatus: "optional",  expectedFormat: "Swiss CV" },
  Netherlands:     { photo: "optional",    maxPages: 2, age: "optional",  nationality: "optional",  address: "optional",    maritalStatus: "forbidden", expectedFormat: "European CV" },
  Spain:           { photo: "optional",    maxPages: 2, age: "optional",  nationality: "optional",  address: "recommended", maritalStatus: "optional",  expectedFormat: "European CV" },
  Italy:           { photo: "recommended", maxPages: 2, age: "optional",  nationality: "optional",  address: "recommended", maritalStatus: "optional",  expectedFormat: "European CV" },
  Portugal:        { photo: "optional",    maxPages: 2, age: "optional",  nationality: "optional",  address: "recommended", maritalStatus: "optional",  expectedFormat: "European CV" },
  Ireland:         { photo: "forbidden",   maxPages: 2, age: "forbidden", nationality: "forbidden", address: "optional",    maritalStatus: "forbidden", expectedFormat: "UK/Irish CV" },
  Sweden:          { photo: "optional",    maxPages: 2, age: "optional",  nationality: "optional",  address: "optional",    maritalStatus: "forbidden", expectedFormat: "Scandinavian CV" },
  Norway:          { photo: "optional",    maxPages: 2, age: "optional",  nationality: "optional",  address: "optional",    maritalStatus: "forbidden", expectedFormat: "Scandinavian CV" },
  Denmark:         { photo: "optional",    maxPages: 2, age: "optional",  nationality: "optional",  address: "optional",    maritalStatus: "forbidden", expectedFormat: "Scandinavian CV" },
  Poland:          { photo: "optional",    maxPages: 2, age: "optional",  nationality: "optional",  address: "recommended", maritalStatus: "optional",  expectedFormat: "European CV" },
  Canada:          { photo: "forbidden",   maxPages: 2, age: "forbidden", nationality: "forbidden", address: "city_only",   maritalStatus: "forbidden", expectedFormat: "Canadian Resume" },
  Brazil:          { photo: "optional",    maxPages: 2, age: "optional",  nationality: "optional",  address: "recommended", maritalStatus: "optional",  expectedFormat: "Brazilian CV" },
  Mexico:          { photo: "optional",    maxPages: 2, age: "optional",  nationality: "optional",  address: "recommended", maritalStatus: "optional",  expectedFormat: "Latin American CV" },
  Argentina:       { photo: "optional",    maxPages: 2, age: "optional",  nationality: "optional",  address: "recommended", maritalStatus: "optional",  expectedFormat: "Latin American CV" },
  Morocco:         { photo: "recommended", maxPages: 2, age: "optional",  nationality: "optional",  address: "recommended", maritalStatus: "optional",  expectedFormat: "French-style CV" },
  Senegal:         { photo: "recommended", maxPages: 2, age: "optional",  nationality: "optional",  address: "recommended", maritalStatus: "optional",  expectedFormat: "French-style CV" },
  "Ivory Coast":   { photo: "recommended", maxPages: 2, age: "optional",  nationality: "optional",  address: "recommended", maritalStatus: "optional",  expectedFormat: "French-style CV" },
  Nigeria:         { photo: "optional",    maxPages: 2, age: "optional",  nationality: "optional",  address: "recommended", maritalStatus: "optional",  expectedFormat: "British-style CV" },
  "South Africa":  { photo: "forbidden",   maxPages: 2, age: "forbidden", nationality: "forbidden", address: "optional",    maritalStatus: "forbidden", expectedFormat: "South African CV" },
  Tunisia:         { photo: "recommended", maxPages: 2, age: "optional",  nationality: "optional",  address: "recommended", maritalStatus: "optional",  expectedFormat: "French-style CV" },
  India:           { photo: "optional",    maxPages: 2, age: "optional",  nationality: "optional",  address: "recommended", maritalStatus: "optional",  expectedFormat: "Indian Resume" },
  Japan:           { photo: "recommended", maxPages: 1, age: "optional",  nationality: "optional",  address: "recommended", maritalStatus: "optional",  expectedFormat: "Rirekisho" },
  Australia:       { photo: "forbidden",   maxPages: 2, age: "forbidden", nationality: "forbidden", address: "city_only",   maritalStatus: "forbidden", expectedFormat: "Australian Resume" },
  Singapore:       { photo: "optional",    maxPages: 2, age: "optional",  nationality: "optional",  address: "optional",    maritalStatus: "optional",  expectedFormat: "Singaporean CV" },
  "United Arab Emirates": { photo: "recommended", maxPages: 2, age: "optional", nationality: "optional", address: "recommended", maritalStatus: "optional", expectedFormat: "UAE CV" },
  Remote:          { photo: "optional",    maxPages: 2, age: "optional",  nationality: "optional",  address: "optional",    maritalStatus: "optional",  expectedFormat: "International CV" },
};

export const SCORED_MODULE_KEYS = [
  "visual", "coherence", "linguistic", "impact",
  "completeness", "job_fit", "country", "ats", "credibility", "competitive",
] as const;

export const MODULE_KEYS = [
  ...SCORED_MODULE_KEYS,
  "auto_correction",
] as const;

export type ScoredModuleKey = (typeof SCORED_MODULE_KEYS)[number];
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_WEIGHTS: Record<ScoredModuleKey, number> = {
  visual: 10,
  coherence: 15,
  linguistic: 15,
  impact: 15,
  completeness: 10,
  job_fit: 15,
  country: 5,
  ats: 10,
  credibility: 5,
  competitive: 5,
};
