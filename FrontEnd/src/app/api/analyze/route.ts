import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { CandidateAnalysis } from "@/types/landing";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { role, stack, seniority, context } = body as {
      role: string;
      stack: string;
      seniority: string;
      context: string;
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analyze a hypothetical candidate for a ${seniority} ${role} role with a ${stack} tech stack in a ${context} environment.
    Explain how they are scored based on "Evidence" rather than "Resume".`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            role: { type: Type.STRING },
            score: { type: Type.NUMBER },
            fit: { type: Type.STRING, description: "One of: High Fit, Moderate Fit, Low Fit" },
            risk: { type: Type.STRING, description: "One of: Faible, Modéré, Élevé" },
            explanation: { type: Type.STRING },
            proofs: { type: Type.ARRAY, items: { type: Type.STRING } },
            softSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["role", "score", "fit", "risk", "explanation", "proofs", "softSkills"],
        },
      },
    });

    const jsonStr = (response.text || "{}").trim();
    const analysis = JSON.parse(jsonStr) as CandidateAnalysis;
    return NextResponse.json(analysis);
  } catch {
    return NextResponse.json(
      { error: "Analysis failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
