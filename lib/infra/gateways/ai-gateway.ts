import {
  createAIClient,
  generateInitialBrainstorm,
  generatePlan,
  type AIClient,
  type BrainstormResult,
  type PlanResult,
  type RepoContext,
} from "@/lib/ai";
import type { AIGateway } from "@/lib/application/ports/ai-gateway";
import type { AiProvider } from "@/lib/application/ports/domain";

export class DefaultAIGateway implements AIGateway {
  createClient(
    provider: AiProvider,
    apiKey: string,
    model: string,
  ): Promise<AIClient> {
    return createAIClient(provider, apiKey, model);
  }

  generateInitialBrainstorm(
    client: AIClient,
    title: string,
    description: string | null,
    repoContext: RepoContext,
  ): Promise<BrainstormResult> {
    return generateInitialBrainstorm(client, title, description, repoContext);
  }

  generatePlan(
    client: AIClient,
    title: string,
    description: string | null,
    brainstormResult: string,
    repoInfo: {
      name: string;
      fullName: string;
      defaultBranch: string;
      techStack: string[];
    },
  ): Promise<PlanResult> {
    return generatePlan(client, title, description, brainstormResult, repoInfo);
  }
}
