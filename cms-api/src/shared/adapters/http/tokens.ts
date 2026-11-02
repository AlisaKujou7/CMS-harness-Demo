export const ACCESS_TOKEN_AUTHENTICATOR = Symbol('AccessTokenAuthenticator');
export const READINESS_PROBE = Symbol('ReadinessProbe');
export const RATE_LIMITER = Symbol('RateLimiter');
export const HTTP_CONFIG = Symbol('HttpConfig');

export interface RateLimitPolicy {
  readonly limit: number;
  readonly windowSeconds: number;
}

export interface HttpConfig {
  readonly secureCookies: boolean;
  readonly corsOrigins: readonly string[];
  readonly rateLimits: {
    readonly login: RateLimitPolicy;
    readonly passwordReset: RateLimitPolicy;
  };
}
