import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import { getUserService } from "@/lib/contexts/iam/api";
import { expandPath, validateCloneDirectory } from "@/lib/utils/path-utils";

const automationSettingsSchema = z.object({
  defaultCloneDirectory: z.string().min(1).optional(),
  defaultTestCommand: z.string().nullable().optional(),
  defaultTestTimeout: z
    .number()
    .min(30000, "Timeout must be at least 30 seconds")
    .max(3600000, "Timeout must be at most 1 hour")
    .optional(),
  defaultTestGatePolicy: z
    .enum(["strict", "warn", "skip", "autoApprove"])
    .optional(),
  defaultBranchPrefix: z
    .string()
    .trim()
    .min(1, "Default branch prefix is required")
    .max(64, "Default branch prefix must be 64 characters or less")
    .regex(/^\S+$/, "Default branch prefix cannot contain spaces")
    .optional(),
  requirePlanApproval: z.boolean().optional(),
});

function normalizeBranchPrefix(prefix: string): string {
  const trimmed = prefix.trim();
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

export const GET = withAuth(async (_request, { user }) => {
  const cloneDirectory = user.defaultCloneDirectory;

  return NextResponse.json({
    defaultCloneDirectory: cloneDirectory ?? null,
    expandedCloneDirectory: cloneDirectory ? expandPath(cloneDirectory) : null,
    defaultTestCommand: user.defaultTestCommand ?? null,
    defaultTestTimeout: user.defaultTestTimeout ?? 300000,
    defaultTestGatePolicy: user.defaultTestGatePolicy ?? "warn",
    defaultBranchPrefix: user.defaultBranchPrefix ?? "loopforge/",
    requirePlanApproval: user.requirePlanApproval ?? true,
  });
});

export const PUT = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const parsed = automationSettingsSchema.parse(body);

    const updateFields: Record<string, unknown> = {};

    if (parsed.defaultCloneDirectory !== undefined) {
      const validation = await validateCloneDirectory(
        parsed.defaultCloneDirectory,
      );
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error || "Invalid clone directory", validation },
          { status: 400 },
        );
      }
      updateFields.defaultCloneDirectory = parsed.defaultCloneDirectory;
    }

    if (parsed.defaultTestCommand !== undefined) {
      updateFields.defaultTestCommand = parsed.defaultTestCommand;
    }
    if (parsed.defaultTestTimeout !== undefined) {
      updateFields.defaultTestTimeout = parsed.defaultTestTimeout;
    }
    if (parsed.defaultTestGatePolicy !== undefined) {
      updateFields.defaultTestGatePolicy = parsed.defaultTestGatePolicy;
    }
    if (parsed.defaultBranchPrefix !== undefined) {
      updateFields.defaultBranchPrefix = normalizeBranchPrefix(
        parsed.defaultBranchPrefix,
      );
    }
    if (parsed.requirePlanApproval !== undefined) {
      updateFields.requirePlanApproval = parsed.requirePlanApproval;
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { error: "No valid settings provided for update" },
        { status: 400 },
      );
    }

    const userService = getUserService();
    await userService.updateUserFields(user.id, updateFields);

    const resolvedCloneDirectory =
      (updateFields.defaultCloneDirectory as string | undefined) ??
      user.defaultCloneDirectory;
    const resolvedBranchPrefix =
      (updateFields.defaultBranchPrefix as string | undefined) ??
      user.defaultBranchPrefix ??
      "loopforge/";
    const resolvedPlanApproval =
      (updateFields.requirePlanApproval as boolean | undefined) ??
      user.requirePlanApproval ??
      true;

    return NextResponse.json({
      success: true,
      defaultCloneDirectory: resolvedCloneDirectory ?? null,
      expandedCloneDirectory: resolvedCloneDirectory
        ? expandPath(resolvedCloneDirectory)
        : null,
      defaultTestCommand:
        (updateFields.defaultTestCommand as string | null | undefined) ??
        user.defaultTestCommand ??
        null,
      defaultTestTimeout:
        (updateFields.defaultTestTimeout as number | undefined) ??
        user.defaultTestTimeout ??
        300000,
      defaultTestGatePolicy:
        (updateFields.defaultTestGatePolicy as string | undefined) ??
        user.defaultTestGatePolicy ??
        "warn",
      defaultBranchPrefix: resolvedBranchPrefix,
      requirePlanApproval: resolvedPlanApproval,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || "Validation failed" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update automation settings" },
      { status: 500 },
    );
  }
});
