import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { handleError, Errors } from "@/lib/errors";
import { validateCloneDirectory, expandPath } from "@/lib/utils/path-utils";

// GET - Fetch current configuration
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
    cloneDirectory: user.defaultCloneDirectory,
    expanded: user.defaultCloneDirectory
      ? expandPath(user.defaultCloneDirectory)
      : null,
  });
}

// POST - Save configuration with validation
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  const body = await request.json();
  const { cloneDirectory } = body;

  if (!cloneDirectory || typeof cloneDirectory !== "string") {
    return handleError(Errors.invalidRequest("Clone directory is required"));
  }

  // Validate directory
  const validation = await validateCloneDirectory(cloneDirectory);

  if (!validation.valid) {
    return NextResponse.json(
      {
        error: validation.error || "Invalid directory",
        validation,
      },
      { status: 400 },
    );
  }

  // Save to database
  await db
    .update(users)
    .set({
      defaultCloneDirectory: cloneDirectory,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({
    success: true,
    cloneDirectory,
    expanded: expandPath(cloneDirectory),
    validation,
  });
}
