import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Check if OAuth is configured (not just placeholders)
  const clientId = process.env.GITHUB_CLIENT_ID || "";
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || "";
  const configured =
    clientId.length > 0 &&
    clientSecret.length > 0 &&
    !clientId.includes("placeholder") &&
    !clientSecret.includes("placeholder");

  // Determine callback URL from request or environment
  const url = new URL(request.url);
  const baseUrl = process.env.NEXTAUTH_URL || `${url.protocol}//${url.host}`;
  const callbackUrl = `${baseUrl}/api/auth/callback/github`;

  return NextResponse.json({
    configured,
    callbackUrl,
  });
}
