import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, createUserAIClient } from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { db } from "@/lib/db";
import { experiments, experimentVariants } from "@/lib/db/schema";
import {
  generateExperiment,
  validateExperimentConfig,
  testAreas,
} from "@/lib/ai/experiment-generator";

// Request validation schema
const generateRequestSchema = z.object({
  testArea: z.enum(testAreas),
  userAnswers: z.record(z.string()),
  customizations: z
    .object({
      experimentName: z.string().optional(),
      trafficAllocation: z.number().min(0).max(100).optional(),
      variantCount: z.number().optional(),
    })
    .optional(),
});

/**
 * POST /api/experiments/generate
 * Generate experiment configuration using AI
 */
export const POST = withAuth(async (request, { user }) => {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = generateRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: validationResult.error.issues,
        },
        { status: 400 },
      );
    }

    const { testArea, userAnswers, customizations } = validationResult.data;

    // Get user's AI client
    const aiClient = await createUserAIClient(user);
    if (!aiClient) {
      return handleError(Errors.noProviderConfigured());
    }

    // Generate experiment using AI
    let generatedExperiment;
    try {
      generatedExperiment = await generateExperiment(
        aiClient,
        testArea,
        userAnswers,
      );
    } catch (error) {
      return NextResponse.json(
        {
          error: "Failed to generate experiment",
          message: error instanceof Error ? error.message : String(error),
        },
        { status: 500 },
      );
    }

    // Apply customizations if provided
    if (customizations?.experimentName) {
      generatedExperiment.name = customizations.experimentName;
    }

    // Validate generated config
    const validation = validateExperimentConfig(generatedExperiment);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Generated experiment is invalid",
          details: validation.errors,
        },
        { status: 500 },
      );
    }

    // Create experiment in database
    const [experiment] = await db
      .insert(experiments)
      .values({
        name: generatedExperiment.name,
        description: generatedExperiment.description,
        trafficAllocation: customizations?.trafficAllocation ?? 10,
        status: "draft",
      })
      .returning();

    // Create variants
    await db.insert(experimentVariants).values(
      generatedExperiment.variants.map((v) => ({
        experimentId: experiment.id,
        name: v.name,
        weight: v.weight,
        config: v.config,
      })),
    );

    // Fetch complete experiment with variants
    const created = await db.query.experiments.findFirst({
      where: (experiments, { eq }) => eq(experiments.id, experiment.id),
      with: {
        variants: true,
      },
    });

    return NextResponse.json({
      experiment: created,
      metadata: {
        testArea,
        generatedBy: aiClient.getProvider(),
        model: aiClient.getModel(),
      },
    });
  } catch (error) {
    console.error("[experiments/generate] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});
