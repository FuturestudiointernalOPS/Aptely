import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/config/env";

const TIMEOUT_MS = 30000;

function getModel() {
  if (!env.GEMINI_MODEL || !env.GEMINI_API_KEY) {
    throw new Error("GEMINI_MODEL and GEMINI_API_KEY must be set");
  }
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({
    model: env.GEMINI_MODEL,
    generationConfig: { responseMimeType: "application/json" },
  });
}

function cleanJson(text: string): string {
  return text.replace(/```json/g, "").replace(/```/g, "").trim();
}

/**
 * Parse Gemini output into JSON, tolerating occasional surrounding prose or a
 * trailing note. Falls back to the outermost {...} block before giving up so a
 * single stray character does not turn into a hard "analyse échouée".
 */
function parseGeminiJson<T>(raw: string): T {
  const cleaned = cleanJson(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error("Gemini returned non-JSON output");
  }
}

export async function callGemini<T = Record<string, unknown>>(
  prompt: string,
  maxRetries = 2
): Promise<T> {
  const model = getModel();
  let retries = 0;

  while (retries <= maxRetries) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const result = await model.generateContent(prompt);
      clearTimeout(timer);
      return parseGeminiJson<T>(result.response.text());
    } catch (err) {
      retries++;
      if (retries > maxRetries) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Gemini failed after ${maxRetries + 1} attempts: ${msg.substring(0, 200)}`);
      }
      await new Promise((r) => setTimeout(r, Math.pow(2, retries) * 500));
    }
  }
  throw new Error("Gemini call failed");
}

export async function callGeminiVision<T = Record<string, unknown>>(
  prompt: string,
  imageBuffer: Buffer,
  mimeType = "image/png",
  maxRetries = 2
): Promise<T> {
  const model = getModel();
  let retries = 0;

  while (retries <= maxRetries) {
    try {
      const result = await model.generateContent([
        prompt,
        { inlineData: { mimeType, data: imageBuffer.toString("base64") } },
      ]);
      return parseGeminiJson<T>(result.response.text());
    } catch (err) {
      retries++;
      if (retries > maxRetries) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Gemini Vision failed: ${msg.substring(0, 200)}`);
      }
      await new Promise((r) => setTimeout(r, Math.pow(2, retries) * 500));
    }
  }
  throw new Error("Gemini Vision call failed");
}
