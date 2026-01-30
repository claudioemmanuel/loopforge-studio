import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { handleError, Errors } from "@/lib/errors";
import { z } from "zod";

const localeSchema = z.object({
  locale: z.enum(["en", "pt-BR"]),
});

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  try {
    const body = await request.json();
    const { locale } = localeSchema.parse(body);

    await db.update(users).set({ locale }).where(eq(users.id, session.user.id));

    return NextResponse.json({ success: true, locale });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
    }
    return handleError(error);
  }
}
