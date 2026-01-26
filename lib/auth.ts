import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { db, users } from "./db";
import { eq } from "drizzle-orm";
import { encryptGithubToken, decryptGithubToken } from "./crypto";
import { authLogger } from "@/lib/logger";

/** GitHub OAuth profile shape as returned by the GitHub provider */
interface GitHubProfile {
  id?: number;
  login?: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

// Check if running on localhost (HTTP) - secure cookies don't work over HTTP
const isLocalhost = process.env.NEXTAUTH_URL?.startsWith("http://localhost");
const useSecureCookies = process.env.NODE_ENV === "production" && !isLocalhost;

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // Update session every 24 hours
  },
  cookies: {
    sessionToken: {
      name: useSecureCookies
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "read:user user:email repo",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || !profile) return false;

      const githubProfile = profile as GitHubProfile;
      const githubId = String(githubProfile.id);
      const username = githubProfile.login || user.name || "User";

      // Encrypt GitHub access token
      const encryptedToken = account.access_token
        ? encryptGithubToken(account.access_token)
        : null;

      // Check if user exists
      const existingUser = await db.query.users.findFirst({
        where: eq(users.githubId, githubId),
      });

      if (!existingUser) {
        // Create new user
        await db.insert(users).values({
          id: crypto.randomUUID(),
          githubId,
          username,
          email: user.email || null,
          avatarUrl: user.image || null,
          encryptedGithubToken: encryptedToken?.encrypted || null,
          githubTokenIv: encryptedToken?.iv || null,
          onboardingCompleted: false,
        });
      } else {
        // Update existing user with new token
        await db
          .update(users)
          .set({
            username,
            email: user.email || null,
            avatarUrl: user.image || null,
            encryptedGithubToken:
              encryptedToken?.encrypted || existingUser.encryptedGithubToken,
            githubTokenIv: encryptedToken?.iv || existingUser.githubTokenIv,
            updatedAt: new Date(),
          })
          .where(eq(users.githubId, githubId));
      }

      return true;
    },
    async session({ session, token }) {
      if (token.sub) {
        const dbUser = await db.query.users.findFirst({
          where: eq(users.githubId, token.sub),
        });
        if (dbUser) {
          session.user.id = dbUser.id;
          session.user.githubId = dbUser.githubId;
          session.user.onboardingCompleted =
            dbUser.onboardingCompleted ?? false;
        }
      }
      return session;
    },
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const githubProfile = profile as GitHubProfile;
        token.sub = String(githubProfile.id);
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
  },
});

// Extend session types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      githubId: string;
      onboardingCompleted: boolean;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

// Helper function to get decrypted GitHub token for a user
export async function getUserGithubToken(
  userId: string,
): Promise<string | null> {
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!dbUser?.encryptedGithubToken || !dbUser?.githubTokenIv) {
    return null;
  }

  try {
    return decryptGithubToken({
      encrypted: dbUser.encryptedGithubToken,
      iv: dbUser.githubTokenIv,
    });
  } catch (error) {
    authLogger.error({ error }, "Failed to decrypt GitHub token");
    return null;
  }
}

// Helper function to mark onboarding as completed
export async function completeOnboarding(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ onboardingCompleted: true, updatedAt: new Date() })
    .where(eq(users.id, userId));
}
