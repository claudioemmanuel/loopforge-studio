import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { handleError, Errors } from "@/lib/errors";
import { z } from "zod";

// Validation schema for test defaults
const testDefaultsSchema = z.object({
  defaultTestCommand: z.string().optional().nullable(),
  defaultTestTimeout: z
    .number()
    .min(30000, "Timeout must be at least 30 seconds")
    .max(3600000, "Timeout must be at most 1 hour")
    .optional(),
  defaultTestGatePolicy: z
    .enum(["strict", "warn", "skip", "autoApprove"])
    .optional(),
});

// GET - Fetch current test defaults configuration
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) {
    return handleError(Errors.notFound("User"));
  }

  return NextResponse.json({
    defaultTestCommand: user.defaultTestCommand,
    defaultTestTimeout: user.defaultTestTimeout,
    defaultTestGatePolicy: user.defaultTestGatePolicy,
  });
}

// POST - Save test defaults configuration
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  try {
    const body = await request.json();

    // Validate request body
    const validated = testDefaultsSchema.parse(body);

    // Save to database
    await db
      .update(users)
      .set({
        defaultTestCommand: validated.defaultTestCommand,
        defaultTestTimeout: validated.defaultTestTimeout,
        defaultTestGatePolicy: validated.defaultTestGatePolicy,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));

    return NextResponse.json({
      success: true,
      ...validated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleError(
        Errors.invalidRequest(error.errors[0]?.message || "Validation failed"),
      );
    }
    throw error;
  }
}
