import { NextRequest, NextResponse } from "next/server";
import { authRefreshApi } from "@/lib/routes";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "http://localhost:4000";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("hr_refresh_token")?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }

  if (!backendRes.ok) {
    const response = NextResponse.json({ error: "Refresh failed" }, { status: 401 });
    response.headers.set(
      "Set-Cookie",
      "hr_refresh_token=; Path=/; HttpOnly; Max-Age=0; SameSite=Strict"
    );
    return response;
  }

  const data = await backendRes.json();
  const newAccessToken = data.session?.accessToken || data.session?.access_token;
  const newRefreshToken = data.session?.refreshToken || data.session?.refresh_token;

  if (!newAccessToken || !newRefreshToken) {
    return NextResponse.json({ error: "Invalid refresh response" }, { status: 502 });
  }

  const isProduction = process.env.NODE_ENV === "production";
  const secure = isProduction ? "; Secure" : "";

  const rawExpiresAt = data.session?.expiresAt ?? data.session?.expires_at;
  const expiresAt = rawExpiresAt ? Number(rawExpiresAt) : 0;
  const accessMaxAge = expiresAt
    ? Math.min(Math.max(expiresAt - Math.floor(Date.now() / 1000), 0), 3600)
    : 3600;

  const response = NextResponse.json({ accessToken: newAccessToken, expiresAt });
  response.headers.append(
    "Set-Cookie",
    `hr_refresh_token=${encodeURIComponent(newRefreshToken)}; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=604800`
  );
  response.headers.append(
    "Set-Cookie",
    `hr_access_token=${encodeURIComponent(newAccessToken)}; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=${accessMaxAge}`
  );
  if (expiresAt) {
    response.headers.append(
      "Set-Cookie",
      `hr_token_expiry=${expiresAt}; Path=/; SameSite=Strict${secure}; Max-Age=${accessMaxAge}`
    );
  }
  return response;
}
