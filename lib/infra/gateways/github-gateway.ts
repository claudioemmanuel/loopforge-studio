import { scanRepoViaGitHub } from "@/lib/github/repo-scanner";
import type { GitHubGateway } from "@/lib/application/ports/github-gateway";
import type { RepoContext } from "@/lib/ai";

export class DefaultGitHubGateway implements GitHubGateway {
  async scanRepo(
    token: string,
    owner: string,
    repo: string,
    branch: string,
  ): Promise<RepoContext> {
    const context = await scanRepoViaGitHub(token, owner, repo, branch);
    return {
      techStack: context.techStack,
      fileStructure: context.fileStructure,
      configFiles: context.configFiles,
    };
  }
}
