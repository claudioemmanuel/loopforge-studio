import { fetchWithRateLimit } from "./rate-limit";

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  clone_url: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  owner: {
    login: string;
    avatar_url: string;
    type: string; // "User" or "Organization"
  };
}

export async function fetchUserRepos(
  accessToken: string,
): Promise<GitHubRepo[]> {
  const response = await fetchWithRateLimit(
    "https://api.github.com/user/repos?per_page=100&sort=updated",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return response.json();
}

export async function getRepo(
  accessToken: string,
  owner: string,
  repo: string,
): Promise<GitHubRepo> {
  const response = await fetchWithRateLimit(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return response.json();
}

export interface CreatePullRequestInput {
  owner: string;
  repo: string;
  title: string;
  body: string;
  head: string;
  base: string;
  draft?: boolean;
}

export interface PullRequestResult {
  number: number;
  url: string;
  html_url: string;
}

/**
 * Create a pull request on GitHub
 */
export async function createPullRequest(
  accessToken: string,
  input: CreatePullRequestInput,
): Promise<PullRequestResult> {
  const response = await fetchWithRateLimit(
    `https://api.github.com/repos/${input.owner}/${input.repo}/pulls`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: input.title,
        body: input.body,
        head: input.head,
        base: input.base,
        draft: input.draft || false,
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `GitHub API error creating PR: ${response.status} - ${errorBody}`,
    );
  }

  const data = await response.json();
  return {
    number: data.number,
    url: data.url,
    html_url: data.html_url,
  };
}
