import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if GitHub OAuth is configured (not just placeholders)
  const clientId = process.env.GITHUB_CLIENT_ID || "";
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || "";
  const isConfigured =
    clientId.length > 0 &&
    clientSecret.length > 0 &&
    !clientId.includes("placeholder") &&
    !clientSecret.includes("placeholder");

  // Allow setup page and API routes
  if (pathname.startsWith("/setup") || pathname.startsWith("/api/setup")) {
    return NextResponse.next();
  }

  // Redirect to setup if not configured
  if (!isConfigured && !pathname.startsWith("/api")) {
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  // Protected routes - check authentication using JWT token
  const protectedPaths = ["/repos", "/onboarding", "/welcome"];
  const isProtectedPath = protectedPaths.some((path) =>
    pathname.startsWith(path)
  );

  if (isProtectedPath) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Note: Onboarding check is done at the page level since we need DB access
    // The middleware only handles authentication
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match root path explicitly
    "/",
    // Match all other paths except static files and API auth routes
    "/((?!_next/static|_next/image|favicon.ico|api/auth).*)",
  ],
};
