import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { validateCloneDirectory, expandPath } from "@/lib/utils/path-utils";
import { getUserService } from "@/lib/contexts/iam/api";

// GET – current clone-directory setting
export const GET = withAuth(async (_request, { user }) => {
  return NextResponse.json({
    cloneDirectory: user.defaultCloneDirectory,
    expanded: user.defaultCloneDirectory
      ? expandPath(user.defaultCloneDirectory)
      : null,
  });
});

// POST – validate and persist new clone directory
export const POST = withAuth(async (request, { user }) => {
  const body = await request.json();
  const { cloneDirectory } = body;

  if (!cloneDirectory || typeof cloneDirectory !== "string") {
    return handleError(Errors.invalidRequest("Clone directory is required"));
  }

  const validation = await validateCloneDirectory(cloneDirectory);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error || "Invalid directory", validation },
      { status: 400 },
    );
  }

  const userService = getUserService();
  await userService.updateUserFields(user.id, {
    defaultCloneDirectory: cloneDirectory,
  });

  return NextResponse.json({
    success: true,
    cloneDirectory,
    expanded: expandPath(cloneDirectory),
    validation,
  });
});
