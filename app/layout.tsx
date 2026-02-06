import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";
import { Providers } from "@/components/providers/providers";
import { WebVitals } from "@/components/providers/web-vitals";
import { startDomainEventRuntime } from "@/lib/contexts/domain-events/runtime";
import "./globals.css";

// Initialize event handlers on server startup
if (typeof window === "undefined") {
  startDomainEventRuntime({ role: "web" }).catch((error) => {
    console.error("Failed to initialize domain event runtime:", error);
  });
}

export const metadata: Metadata = {
  title: "Loopforge Studio - AI-Powered Development",
  description: "Visual Kanban interface for autonomous AI coding",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <WebVitals />
        <NextIntlClientProvider messages={messages} locale={locale}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
