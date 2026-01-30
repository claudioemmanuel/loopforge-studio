import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";

export const locales = ["en", "pt-BR"] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async () => {
  const headersList = await headers();
  const locale = headersList.get("x-locale") || "en";

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
