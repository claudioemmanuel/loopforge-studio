import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { locales } from "./i18n";

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
    pathname.startsWith(path),
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

  // Locale detection
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Get locale from user preference (in token), cookie, or Accept-Language header
  let locale = "en";

  if (
    token?.locale &&
    locales.includes(token.locale as (typeof locales)[number])
  ) {
    // Authenticated user - use database preference
    locale = token.locale as string;
  } else {
    // Check for locale cookie (set by LanguageSwitcher for unauthenticated users)
    const localeCookie = request.cookies.get("preferred-locale")?.value;
    if (
      localeCookie &&
      locales.includes(localeCookie as (typeof locales)[number])
    ) {
      locale = localeCookie;
    } else {
      // Parse Accept-Language header as fallback
      const acceptLanguage = request.headers.get("accept-language");
      if (acceptLanguage) {
        const preferredLocale = acceptLanguage
          .split(",")[0]
          .trim()
          .split(";")[0];
        if (locales.includes(preferredLocale as (typeof locales)[number])) {
          locale = preferredLocale;
        } else if (preferredLocale.startsWith("pt")) {
          locale = "pt-BR";
        }
      }
    }
  }

  // Set locale header for i18n.ts to read
  const response = NextResponse.next();
  response.headers.set("x-locale", locale);
  return response;
}

export const config = {
  matcher: [
    // Match root path explicitly
    "/",
    // Match all other paths except static files and API auth routes
    "/((?!_next/static|_next/image|favicon.ico|api/auth).*)",
  ],
};
