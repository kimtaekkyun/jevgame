import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE_NAME, isAccessTokenValid } from "./lib/access";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/api/access") return NextResponse.next();

  const token = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const hasAccess = isAccessTokenValid(token);

  if (pathname.startsWith("/api/")) {
    if (hasAccess) return NextResponse.next();
    return NextResponse.json({ error: "입장 코드를 먼저 입력해 주세요." }, { status: 401 });
  }

  if (pathname === "/welcome" || pathname.startsWith("/welcome/")) {
    return hasAccess ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }

  if (pathname === "/" && !hasAccess) {
    return NextResponse.rewrite(new URL("/welcome", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
