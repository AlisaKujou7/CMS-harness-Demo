import type { CookieOptions, Request, Response } from 'express';

const COOKIE_NAME = 'cms_refresh';
const COOKIE_PATH = '/api/admin/auth';
const MAX_AGE_MS = 14 * 24 * 60 * 60_000;

function options(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'strict', path: COOKIE_PATH };
}

export function setSessionCookie(response: Response, token: string, secure: boolean): void {
  response.cookie(COOKIE_NAME, token, { ...options(secure), maxAge: MAX_AGE_MS });
}

export function clearSessionCookie(response: Response, secure: boolean): void {
  response.clearCookie(COOKIE_NAME, options(secure));
}

export function readSessionCookie(request: Request): string {
  const cookies = request.header('cookie')?.split(';') ?? [];
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === COOKIE_NAME && value !== undefined) return value;
  }
  return '';
}
