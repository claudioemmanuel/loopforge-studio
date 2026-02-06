import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { encryptApiKey } from "@/lib/crypto";
import { apiLogger } from "@/lib/logger";
import { getUserService } from "@/lib/contexts/iam/api";
import { getRepositoryService } from "@/lib/contexts/repository/api";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  clone_url: string;
}

type Provider = "anthropic" | "openai" | "gemini";

interface CompleteOnboardingRequest {
  // Support both single repo (legacy) and multiple repos
  repo?: GitHubRepo;
  repos?: GitHubRepo[];
  apiKey: string; // Required for BYOK (only mode now)
  provider?: Provider; // Optional, defaults to "anthropic" for backward compatibility
  model?: string; // Optional, uses default for provider if not specified
}

export const POST = withAuth(async (request, { user }) => {
  try {
    const body: CompleteOnboardingRequest = await request.json();
    const {
      repo,
      repos: reposList,
      apiKey,
      provider = "anthropic",
      model,
    } = body;

    // Normalize to array (support both single repo and multiple repos)
    const reposToAdd = reposList || (repo ? [repo] : []);

    if (reposToAdd.length === 0) {
      return NextResponse.json(
        { error: "At least one repository is required" },
        { status: 400 },
      );
    }

    // API key is required for BYOK (only mode)
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 },
      );
    }

    // Encrypt the API key
    const encrypted = encryptApiKey(apiKey);

    // Build the update object based on the selected provider
    type UserUpdateFields = {
      onboardingCompleted: boolean;
      updatedAt: Date;
      preferredProvider: "anthropic" | "openai" | "gemini";
      encryptedApiKey?: string;
      apiKeyIv?: string;
      openaiEncryptedApiKey?: string;
      openaiApiKeyIv?: string;
      geminiEncryptedApiKey?: string;
      geminiApiKeyIv?: string;
      preferredAnthropicModel?: string;
      preferredOpenaiModel?: string;
      preferredGeminiModel?: string;
    };

    const updateFields: UserUpdateFields = {
      onboardingCompleted: true,
      updatedAt: new Date(),
      preferredProvider: provider,
    };

    // Store API key in the correct provider-specific column
    switch (provider) {
      case "anthropic":
        updateFields.encryptedApiKey = encrypted.encrypted;
        updateFields.apiKeyIv = encrypted.iv;
        if (model) {
          updateFields.preferredAnthropicModel = model;
        }
        break;
      case "openai":
        updateFields.openaiEncryptedApiKey = encrypted.encrypted;
        updateFields.openaiApiKeyIv = encrypted.iv;
        if (model) {
          updateFields.preferredOpenaiModel = model;
        }
        break;
      case "gemini":
        updateFields.geminiEncryptedApiKey = encrypted.encrypted;
        updateFields.geminiApiKeyIv = encrypted.iv;
        if (model) {
          updateFields.preferredGeminiModel = model;
        }
        break;
    }

    const userService = getUserService();
    const repositoryService = getRepositoryService();

    await userService.updateUserFields(user.id, updateFields);

    // Create repo records using atomic upsert to prevent race condition duplicates
    const repoIds: string[] = [];
    for (const repoData of reposToAdd) {
      const createdId = await repositoryService.connectRepository({
        userId: user.id,
        githubRepoId: String(repoData.id),
        name: repoData.name,
        fullName: repoData.full_name,
        defaultBranch: repoData.default_branch,
        cloneUrl: repoData.clone_url,
        isPrivate: repoData.private,
      });

      if (createdId) {
        repoIds.push(createdId);
      } else {
        const existingRepo = await repositoryService.findByUserAndGithubId(
          user.id,
          String(repoData.id),
        );
        if (existingRepo) {
          repoIds.push(existingRepo.id);
        }
      }
    }

    // Return the first repo ID for redirect
    return NextResponse.json({
      repoId: repoIds[0],
      repoIds,
      success: true,
    });
  } catch (error) {
    apiLogger.error({ error }, "Error completing onboarding");
    return NextResponse.json(
      { error: "Failed to complete onboarding" },
      { status: 500 },
    );
  }
});
