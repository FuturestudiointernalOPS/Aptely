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

  const { refreshToken } = await request.json();
  if (!refreshToken) {
    return NextResponse.json({ error: "Missing refreshToken" }, { status: 400 });
  }

  const isProduction = process.env.NODE_ENV === "production";
  const secure = isProduction ? "; Secure" : "";
  const response = NextResponse.json({ ok: true });
  response.headers.set(
    "Set-Cookie",
    `hr_refresh_token=${encodeURIComponent(refreshToken)}; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=604800`
  );
  return response;
}
