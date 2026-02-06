import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { handleError, Errors } from "@/lib/errors";
import { UseCaseFactory } from "@/lib/contexts/task/api/use-case-factory";
import { ValidationError } from "@/lib/shared/errors";
import { getRepositoryService } from "@/lib/contexts/repository/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ repoId: string }> },
) {
  const session = await auth();
  const { repoId } = await params;

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  const repositoryService = getRepositoryService();
  const repo = await repositoryService.findByOwner(repoId, session.user.id);

  if (!repo) {
    return handleError(Errors.notFound("Repository"));
  }

  // Execute use case
  const useCase = UseCaseFactory.listTasksByRepo();
  const result = await useCase.execute({ repoId });

  if (result.isFailure) {
    return handleError(result.error);
  }

  return NextResponse.json(result.value);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ repoId: string }> },
) {
  const session = await auth();
  const { repoId } = await params;

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  const repositoryService = getRepositoryService();
  const repo = await repositoryService.findByOwner(repoId, session.user.id);

  if (!repo) {
    return handleError(Errors.notFound("Repository"));
  }

  const body = await request.json();

  // Validate request body
  const bodySchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional().default(""),
    priority: z.number().min(0).max(10).optional(),
  });

  let validatedBody;
  try {
    validatedBody = bodySchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleError(
        Errors.invalidRequest(
          error.errors[0]?.message || "Invalid request body",
        ),
      );
    }
    return handleError(Errors.invalidRequest("Invalid request body"));
  }

  // Execute use case
  const useCase = UseCaseFactory.createTask();
  const result = await useCase.execute({
    repoId,
    title: validatedBody.title,
    description: validatedBody.description,
    priority: validatedBody.priority,
  });

  if (result.isFailure) {
    if (result.error instanceof ValidationError) {
      return handleError(Errors.invalidRequest(result.error.message));
    }
    return handleError(result.error);
  }

  return NextResponse.json(result.value);
}
