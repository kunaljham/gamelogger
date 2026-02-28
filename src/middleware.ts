import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const cookieName = process.env.COOKIE_NAME || "session";
  const hasSession = request.cookies.has(cookieName);
  const { pathname } = request.nextUrl;

  // Logged-in users visiting landing or login → redirect to /feed
  if (hasSession && (pathname === "/" || pathname === "/login")) {
    return NextResponse.redirect(new URL("/feed", request.url));
  }

  // Logged-out users visiting protected pages → redirect to /login
  if (!hasSession && (pathname.startsWith("/feed") || pathname.startsWith("/match") || pathname === "/complete-profile" || pathname === "/log-match" || pathname === "/opponents" || pathname === "/profile")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

// Only run middleware on these routes (not on static assets, API routes, etc.)
export const config = {
  matcher: ["/", "/login", "/feed", "/match/:path*", "/complete-profile", "/log-match", "/opponents", "/profile"],
};
