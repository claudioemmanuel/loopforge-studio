import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { handleError, Errors } from "@/lib/errors";
import { validateCloneDirectory, expandPath } from "@/lib/utils/path-utils";

// POST - Validate path without saving
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  const body = await request.json();
  const { path } = body;

  if (!path || typeof path !== "string") {
    return handleError(Errors.invalidRequest("Path is required"));
  }

  const validation = await validateCloneDirectory(path);

  return NextResponse.json({
    path,
    expanded: expandPath(path),
    validation,
  });
}
