import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { aiProviders, type AiProvider } from "@/lib/db/schema";
import { apiLogger } from "@/lib/logger";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { provider } = body;

    // Validate provider
    if (!provider || !aiProviders.includes(provider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    // Update user's preferred provider
    await db
      .update(users)
      .set({
        preferredProvider: provider as AiProvider,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));

    return NextResponse.json({ success: true, provider });
  } catch (error) {
    apiLogger.error({ error }, "Failed to update provider");
    return NextResponse.json(
      { error: "Failed to update provider" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      provider: user.preferredProvider || "anthropic",
    });
  } catch (error) {
    apiLogger.error({ error }, "Failed to get provider");
    return NextResponse.json(
      { error: "Failed to get provider" },
      { status: 500 },
    );
  }
}
