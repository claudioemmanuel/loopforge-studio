import type { AiProvider, UserAccount } from "./domain";

export interface AIClientConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;
}

export interface AISettingsGateway {
  getClientConfig(user: UserAccount): AIClientConfig | null;
}
