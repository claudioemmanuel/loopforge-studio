import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import enMessages from "./messages/en.json";
import ptBRMessages from "./messages/pt-BR.json";

export const locales = ["en", "pt-BR"] as const;
export type Locale = (typeof locales)[number];

const messages = {
  en: enMessages,
  "pt-BR": ptBRMessages,
};

export default getRequestConfig(async () => {
  const headersList = await headers();
  const locale = (headersList.get("x-locale") || "en") as Locale;

  return {
    locale,
    messages: messages[locale] || messages.en,
  };
});
