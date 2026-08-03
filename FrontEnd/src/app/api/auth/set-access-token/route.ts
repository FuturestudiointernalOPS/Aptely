import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const originHeader = request.headers.get("origin");
  const host = request.headers.get("host") ?? "";
  if (!originHeader) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    if (new URL(originHeader).host !== host) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { accessToken, expiresAt } = body as {
    accessToken?: string;
    expiresAt?: number;
  };

  if (!accessToken) {
    return NextResponse.json({ error: "Missing accessToken" }, { status: 400 });
  }

  const isProduction = process.env.NODE_ENV === "production";
  const secure = isProduction ? "; Secure" : "";
  const maxAge = expiresAt
    ? Math.min(Math.max(expiresAt - Math.floor(Date.now() / 1000), 0), 7 * 24 * 3600)
    : 3600;

  const response = NextResponse.json({ ok: true });
  response.headers.append(
    "Set-Cookie",
    `hr_access_token=${encodeURIComponent(accessToken)}; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=${maxAge}`
  );
  if (expiresAt) {
    response.headers.append(
      "Set-Cookie",
      `hr_token_expiry=${expiresAt}; Path=/; SameSite=Strict${secure}; Max-Age=${maxAge}`
    );
  }
  return response;
}
