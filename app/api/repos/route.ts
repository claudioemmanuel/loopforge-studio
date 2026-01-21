import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, repos } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRepos = await db.query.repos.findMany({
    where: eq(repos.userId, session.user.id),
  });

  return NextResponse.json(userRepos);
}

export async function DELETE() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.delete(repos).where(eq(repos.userId, session.user.id));

  return NextResponse.json({ success: true });
}
