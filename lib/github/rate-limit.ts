/**
 * GitHub API Rate Limit and Token Error Handling
 *
 * Provides specialized error types and a fetch wrapper that detects
 * rate limiting (429) and token expiration/revocation (401/403) from
 * GitHub API responses.
 */

export class RateLimitError extends Error {
  constructor(
    public service: string,
    public retryAfterSeconds: number,
  ) {
    super(
      `${service} rate limit exceeded. Retry after ${retryAfterSeconds} seconds.`,
    );
    this.name = "RateLimitError";
  }
}

export class TokenExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenExpiredError";
  }
}

/**
 * Fetch wrapper that detects GitHub API rate limits and token errors.
 *
 * - 429: Throws RateLimitError with retry-after duration
 * - 401/403: Throws TokenExpiredError with response details
 * - All other responses: returned as-is for caller handling
 */
export async function fetchWithRateLimit(
  url: string,
  options: RequestInit,
): Promise<Response> {
  const response = await fetch(url, options);

  if (response.status === 429) {
    const retryAfter = parseInt(
      response.headers.get("retry-after") || "60",
      10,
    );
    throw new RateLimitError("GitHub", retryAfter);
  }

  if (response.status === 401 || response.status === 403) {
    const body = await response.text();
    throw new TokenExpiredError(
      `GitHub token expired or revoked: ${response.status} ${body.slice(0, 200)}`,
    );
  }

  return response;
}
