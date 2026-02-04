import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { z } from "zod";
import { getUserService } from "@/lib/contexts/iam/api";

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

// GET – current test-defaults configuration
export const GET = withAuth(async (_request, { user }) => {
  return NextResponse.json({
    defaultTestCommand: user.defaultTestCommand,
    defaultTestTimeout: user.defaultTestTimeout,
    defaultTestGatePolicy: user.defaultTestGatePolicy,
  });
});

// POST – validate and persist test defaults
export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const validated = testDefaultsSchema.parse(body);

    const userService = getUserService();
    await userService.updateUserFields(user.id, validated);

    return NextResponse.json({ success: true, ...validated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleError(
        Errors.invalidRequest(error.errors[0]?.message || "Validation failed"),
      );
    }
    throw error;
  }
});
