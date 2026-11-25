import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  ACCESS_SESSION_MAX_AGE,
  createAccessToken,
  isAccessConfigured,
  matchesEntryCode,
} from "@/lib/access";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAccessConfigured()) {
    return NextResponse.json(
      { error: "입장 기능이 설정되지 않았습니다. ENTRY_CODE와 ACCESS_SESSION_SECRET을 서버 환경 변수에 설정해 주세요." },
      { status: 503 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 2048) {
    return NextResponse.json({ error: "요청 크기가 너무 큽니다." }, { status: 413 });
  }

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "입력 내용을 읽을 수 없습니다." }, { status: 400 });
  }

  if (!matchesEntryCode(body.code)) {
    return NextResponse.json({ error: "입장 코드가 올바르지 않습니다. 다시 확인해 주세요." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE_NAME, createAccessToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_SESSION_MAX_AGE,
  });
  return response;
}
