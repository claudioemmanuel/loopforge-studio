export interface GitHubTokenPayload {
  encrypted: string;
  iv: string;
}

export interface CryptoGateway {
  decryptGithubToken(payload: GitHubTokenPayload): string;
}
