import type { AIClient, BrainstormResult, PlanResult, RepoContext } from "@/lib/ai";
import type { AiProvider } from "./domain";

export interface AIGateway {
  createClient(
    provider: AiProvider,
    apiKey: string,
    model: string,
  ): Promise<AIClient>;
  generateInitialBrainstorm(
    client: AIClient,
    title: string,
    description: string | null,
    repoContext: RepoContext,
  ): Promise<BrainstormResult>;
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
  ): Promise<PlanResult>;
}
