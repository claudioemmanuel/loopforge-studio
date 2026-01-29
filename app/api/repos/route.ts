import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { db, repos } from "@/lib/db";
import { eq } from "drizzle-orm";

export const GET = withAuth(async (_request, { user }) => {
  const userRepos = await db.query.repos.findMany({
    where: eq(repos.userId, user.id),
  });

  return NextResponse.json(userRepos);
});

export const DELETE = withAuth(async (_request, { user }) => {
  await db.delete(repos).where(eq(repos.userId, user.id));

  return NextResponse.json({ success: true });
});
