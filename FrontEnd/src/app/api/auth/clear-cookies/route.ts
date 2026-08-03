import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  const isProduction = process.env.NODE_ENV === "production";
  const secure = isProduction ? "; Secure" : "";
  const expired = `; Path=/; Max-Age=0; SameSite=Strict${secure}`;
  const expiredHttpOnly = `; Path=/; HttpOnly; Max-Age=0; SameSite=Strict${secure}`;
  response.headers.append("Set-Cookie", `hr_access_token=deleted${expiredHttpOnly}`);
  response.headers.append("Set-Cookie", `hr_refresh_token=deleted${expiredHttpOnly}`);
  response.headers.append("Set-Cookie", `user_email=deleted${expired}`);
  response.headers.append("Set-Cookie", `hr_token_expiry=deleted${expired}`);
  return response;
}
