import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { z } from "zod";
import { getUserService } from "@/lib/contexts/iam/api";

const localeSchema = z.object({
  locale: z.enum(["en", "pt-BR"]),
});

export const PATCH = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const { locale } = localeSchema.parse(body);

    const userService = getUserService();
    await userService.updateLocale(user.id, locale);

    return NextResponse.json({ success: true, locale });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
    }
    throw error;
  }
});
