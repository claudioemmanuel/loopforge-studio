import { decryptGithubToken } from "@/lib/crypto";
import type { CryptoGateway, GitHubTokenPayload } from "@/lib/application/ports/crypto-gateway";

export class DefaultCryptoGateway implements CryptoGateway {
  decryptGithubToken(payload: GitHubTokenPayload): string {
    return decryptGithubToken(payload);
  }
}
