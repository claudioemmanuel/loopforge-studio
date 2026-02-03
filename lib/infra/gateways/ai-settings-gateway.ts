import { getAIClientConfig } from "@/lib/api/helpers";
import type { User } from "@/lib/db/schema";
import type { AISettingsGateway, AIClientConfig } from "@/lib/application/ports/ai-settings-gateway";
import type { UserAccount } from "@/lib/application/ports/domain";

export class DefaultAISettingsGateway implements AISettingsGateway {
  getClientConfig(user: UserAccount): AIClientConfig | null {
    return getAIClientConfig(user as User);
  }
}
