import type { RepoContext } from "@/lib/ai";

export interface GitHubGateway {
  scanRepo(
    token: string,
    owner: string,
    repo: string,
    branch: string,
  ): Promise<RepoContext>;
}
