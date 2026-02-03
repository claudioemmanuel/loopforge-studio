import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import type { UserRepository } from "@/lib/application/ports/repositories";
import type { UserAccount } from "@/lib/application/ports/domain";

export class DrizzleUserRepository implements UserRepository {
  async getUserById(userId: string): Promise<UserAccount | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) return null;

    return {
      id: user.id,
      encryptedGithubToken: user.encryptedGithubToken,
      githubTokenIv: user.githubTokenIv,
      preferredProvider: user.preferredProvider,
      encryptedApiKey: user.encryptedApiKey,
      apiKeyIv: user.apiKeyIv,
      openaiEncryptedApiKey: user.openaiEncryptedApiKey,
      openaiApiKeyIv: user.openaiApiKeyIv,
      geminiEncryptedApiKey: user.geminiEncryptedApiKey,
      geminiApiKeyIv: user.geminiApiKeyIv,
      preferredAnthropicModel: user.preferredAnthropicModel,
      preferredOpenaiModel: user.preferredOpenaiModel,
      preferredGeminiModel: user.preferredGeminiModel,
    };
  }
}
