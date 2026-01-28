import {
  AnthropicIcon,
  OpenAIIcon,
  GeminiIcon,
} from "@/components/providers/provider-icons";

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  clone_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  owner: {
    login: string;
    avatar_url: string;
    type: string;
  };
}

export type FilterType = "all" | "public" | "private" | "org";
export type Step = "repos" | "apikey";
export type Provider = "anthropic" | "openai" | "gemini";

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  recommended?: boolean;
}

export interface ProviderConfig {
  id: Provider;
  name: string;
  displayName: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  placeholder: string;
  docsUrl: string;
  color: string;
  bgColor: string;
  models: ModelOption[];
}

export const providers: ProviderConfig[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    displayName: "Claude",
    icon: AnthropicIcon,
    placeholder: "sk-ant-api03-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
    color: "text-[#D4A574]",
    bgColor: "bg-[#D4A574]/10",
    models: [
      {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        description: "Balanced performance and speed",
        recommended: true,
      },
      {
        id: "claude-opus-4-20250514",
        name: "Claude Opus 4",
        description: "Most capable model",
      },
      {
        id: "claude-haiku-3-20240307",
        name: "Claude Haiku 3",
        description: "Fastest responses",
      },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    displayName: "GPT-4",
    icon: OpenAIIcon,
    placeholder: "sk-proj-...",
    docsUrl: "https://platform.openai.com/api-keys",
    color: "text-[#10A37F]",
    bgColor: "bg-[#10A37F]/10",
    models: [
      {
        id: "gpt-4o",
        name: "GPT-4o",
        description: "Latest flagship model",
        recommended: true,
      },
      {
        id: "gpt-4-turbo",
        name: "GPT-4 Turbo",
        description: "Previous flagship",
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        description: "Faster, more affordable",
      },
    ],
  },
  {
    id: "gemini",
    name: "Google",
    displayName: "Gemini",
    icon: GeminiIcon,
    placeholder: "AIza...",
    docsUrl: "https://aistudio.google.com/app/api-keys",
    color: "text-[#4285F4]",
    bgColor: "bg-[#4285F4]/10",
    models: [
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        description: "Most capable model",
        recommended: true,
      },
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        description: "Fast and efficient",
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Cost-effective multimodal",
      },
    ],
  },
];
