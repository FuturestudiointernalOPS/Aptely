import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "http://localhost:4000";

async function proxyRequest(
  request: NextRequest,
  segments: string[]
): Promise<NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get("hr_access_token")?.value;

  const sanitized = segments.filter(
    (s) => s && s !== "." && s !== ".." && !s.includes("/") && !s.includes("\\") && !s.includes("%")
  );
  if (sanitized.length === 0 || sanitized.length !== segments.length) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  const endpoint = "/" + sanitized.join("/");
  const resolved = new URL(endpoint, BACKEND_URL);
  if (!resolved.href.startsWith(BACKEND_URL)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  const url = `${resolved.href}${request.nextUrl.search}`;

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (
      key !== "host" &&
      key !== "cookie" &&
      key !== "connection" &&
      key !== "accept-encoding" &&
      key !== "authorization"
    ) {
      headers[key] = value;
    }
  });
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let body: BodyInit | null = null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.blob();
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(url, { method: request.method, headers, body });
  } catch {
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }

  const responseHeaders = new Headers();
  backendRes.headers.forEach((value, key) => {
    if (
      key !== "transfer-encoding" &&
      key !== "connection" &&
      key !== "content-encoding" &&
      key !== "content-length"
    ) {
      responseHeaders.set(key, value);
    }
  });

  const responseBody = await backendRes.arrayBuffer();

  return new NextResponse(responseBody, {
    status: backendRes.status,
    statusText: backendRes.statusText,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  return proxyRequest(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: RouteContext) {
  return proxyRequest(req, (await ctx.params).path);
}
export async function PUT(req: NextRequest, ctx: RouteContext) {
  return proxyRequest(req, (await ctx.params).path);
}
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  return proxyRequest(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  return proxyRequest(req, (await ctx.params).path);
}
