import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has("session");
  const { pathname } = request.nextUrl;

  // Logged-in users visiting landing or login → redirect to /feed
  if (hasSession && (pathname === "/" || pathname === "/login")) {
    return NextResponse.redirect(new URL("/feed", request.url));
  }

  // Logged-out users visiting protected pages → redirect to /login
  if (!hasSession && (pathname.startsWith("/feed") || pathname === "/complete-profile" || pathname === "/log-match" || pathname === "/profile")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

// Only run middleware on these routes (not on static assets, API routes, etc.)
export const config = {
  matcher: ["/", "/login", "/feed", "/feed/:path*", "/complete-profile", "/log-match", "/profile"],
};
