"use client";

import { createContext, useContext, ReactNode } from "react";

interface SettingsData {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  apiKeyMasked?: string | null; // Deprecated, use apiKeys.anthropic
  apiKeys?: {
    anthropic?: string | null;
    openai?: string | null;
    gemini?: string | null;
  };
  modelPreferences?: {
    anthropic: string;
    openai: string;
    gemini: string;
  };
  preferredProvider?: "anthropic" | "openai" | "gemini" | null;
  github: {
    username: string;
    connectedAt: string;
  };
  repos: Array<{
    id: string;
    fullName: string;
    isPrivate: boolean;
  }>;
}

const SettingsContext = createContext<SettingsData | null>(null);

export function SettingsProvider({
  children,
  data,
}: {
  children: ReactNode;
  data: SettingsData;
}) {
  return (
    <SettingsContext.Provider value={data}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
