import type { z } from 'zod';

export type Auth = 'none' | 'bearer' | 'apiKey' | 'refreshCookie';

export interface ApiRoute {
  readonly method: 'get' | 'post' | 'patch' | 'delete';
  readonly path: string;
  readonly id: string;
  readonly summary: string;
  readonly tag: string;
  readonly auth: Auth;
  readonly roles?: string;
  readonly query?: z.ZodObject;
  readonly body?: z.ZodType;
  readonly status: number;
  // Headers the route requires, by name and the one value it accepts.
  readonly requiredHeaders?: Readonly<Record<string, string>>;
  readonly cacheHeaders?: boolean;
  readonly rateLimited?: boolean;
  readonly unavailableStatus?: number;
  // Absent means no body. A string names a media type that is not JSON.
  readonly response?: z.ZodType | 'text/csv';
}
