import { NextResponse } from "next/server";
import { auth, getUserGithubToken } from "@/lib/auth";
import { fetchUserRepos } from "@/lib/github";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get decrypted GitHub token from database
    const githubToken = await getUserGithubToken(session.user.id);

    if (!githubToken) {
      return NextResponse.json(
        { error: "GitHub token not found. Please re-authenticate." },
        { status: 401 }
      );
    }

    // Fetch real repositories from GitHub API
    const repos = await fetchUserRepos(githubToken);

    return NextResponse.json(repos);
  } catch (error) {
    console.error("Error fetching repos:", error);
    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 }
    );
  }
}
