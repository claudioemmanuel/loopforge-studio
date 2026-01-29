import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { getUserGithubToken } from "@/lib/auth";
import { fetchUserRepos } from "@/lib/github";
import { apiLogger } from "@/lib/logger";

export const GET = withAuth(async (_request, { user }) => {
  try {
    // Get decrypted GitHub token from database
    const githubToken = await getUserGithubToken(user.id);

    if (!githubToken) {
      return NextResponse.json(
        { error: "GitHub token not found. Please re-authenticate." },
        { status: 401 },
      );
    }

    // Fetch real repositories from GitHub API
    const repos = await fetchUserRepos(githubToken);

    return NextResponse.json(repos);
  } catch (error) {
    apiLogger.error({ error }, "Error fetching repos");
    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 },
    );
  }
});
