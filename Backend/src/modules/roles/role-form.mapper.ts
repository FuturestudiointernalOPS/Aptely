type UnknownRecord = Record<string, unknown>;
type ApplicationFormField = {
  id: string;
  type: string;
  label: string;
  required: boolean;
};

function firstNonEmptyString(source: UnknownRecord | undefined, keys: string[]): string | null {
  if (!source) return null;

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }

  return null;
}

function asRecord(value: unknown): UnknownRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as UnknownRecord;
}

function pickNestedString(source: UnknownRecord | undefined, parents: string[], keys: string[]): string | null {
  if (!source) return null;

  for (const parentKey of parents) {
    const parent = asRecord(source[parentKey]);
    const found = firstNonEmptyString(parent, keys);
    if (found) return found;
  }

  return null;
}

function normalizeEndDate(input: string | null): string | null {
  if (!input) return null;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getTime() <= 0) return null;

  return input;
}

function buildLocation(fullForm?: UnknownRecord): string | null {
  if (!fullForm) return null;

  const directLocation = firstNonEmptyString(fullForm, ["localisation", "location"]);
  if (directLocation) return directLocation;

  const country = firstNonEmptyString(fullForm, ["country"])
    ?? pickNestedString(fullForm, ["identity", "location"], ["country"]);
  const city = firstNonEmptyString(fullForm, ["city"])
    ?? pickNestedString(fullForm, ["identity", "location"], ["city"]);

  // Filter generic "other" placeholder values — only show meaningful location strings
  const isOther = (v: string) => ["other", "autre", "other - other"].includes(v.toLowerCase().trim());
  const cleanCountry = country && !isOther(country) ? country : null;
  const cleanCity = city && !isOther(city) ? city : null;
  if (cleanCountry && cleanCity) return `${cleanCountry} - ${cleanCity}`;
  return cleanCountry ?? cleanCity ?? null;
}

function buildApplicationForm(fullForm?: UnknownRecord): ApplicationFormField[] | null {
  if (!fullForm) return null;

  const customQuestionsRaw =
    firstNonEmptyString(fullForm, ["customFormQuestions"])
    ?? pickNestedString(fullForm, ["ai", "form"], ["customFormQuestions", "questionsText"])
    ?? "";

  const fromText = customQuestionsRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((label, index) => ({
      id: `custom_idx_${index}`,
      type: "textarea",
      label,
      required: true,
    }));

  if (fromText.length > 0) return fromText;

  const questions = fullForm.questions;
  if (Array.isArray(questions)) {
    const normalized = questions
      .map((question, index) => {
        if (!question || typeof question !== "object") return null;
        const questionRecord = question as UnknownRecord;
        const label = firstNonEmptyString(questionRecord, ["label", "question", "text"]);
        if (!label) return null;

        return {
          id: typeof questionRecord.id === "string" ? questionRecord.id : `custom_idx_${index}`,
          type: typeof questionRecord.type === "string" ? questionRecord.type : "textarea",
          label,
          required: Boolean(questionRecord.required ?? true),
        };
      })
      .filter((item): item is ApplicationFormField => item !== null);

    return normalized.length > 0 ? normalized : null;
  }

  return null;
}

export function deriveRoleFieldsFromFullForm(fullForm?: UnknownRecord): {
  title: string;
  description: string | null;
  location: string | null;
  type: string | null;
  endDate: string | null;
  applicationForm: ApplicationFormField[] | null;
} {
  const title = (
    firstNonEmptyString(fullForm, ["name_role", "title", "roleTitle", "jobTitle", "positionTitle"])
    ?? pickNestedString(fullForm, ["identity", "role", "job"], ["title", "roleTitle", "jobTitle"])
  )
    ?? "Untitled Role";

  const description =
    firstNonEmptyString(fullForm, ["mission90Day", "mission", "description"])
    ?? pickNestedString(fullForm, ["mission", "context"], ["mission90Day", "description", "summary"]);
  const location = buildLocation(fullForm);
  const type =
    firstNonEmptyString(fullForm, ["type", "contractType", "employmentType"])
    ?? pickNestedString(fullForm, ["identity", "constraints"], ["type", "contractType", "employmentType"]);
  const rawEndDate =
    firstNonEmptyString(fullForm, ["end_date", "decisionTime", "endDate", "deadline"])
    ?? pickNestedString(fullForm, ["posture", "constraints", "timeline"], ["decisionTime", "endDate", "deadline"]);
  const endDate = normalizeEndDate(rawEndDate);
  const applicationForm = buildApplicationForm(fullForm);

  return {
    title,
    description,
    location,
    type,
    endDate,
    applicationForm,
  };
}
