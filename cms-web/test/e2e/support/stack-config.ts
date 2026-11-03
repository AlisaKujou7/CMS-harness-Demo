export const WEB_PORT = 4173;
export const API_PORT = 3100;
export const WEB_URL = `http://localhost:${String(WEB_PORT)}`;
export const API_URL = `http://localhost:${String(API_PORT)}`;

// A test account's password. It only ever exists in the containers of one E2E run.
export const USER_PASSWORD = 'e2e-account-pass-1';
export const ADMIN_EMAIL = 'seed-admin@e2e.test';

export const ENV_DATABASE_URL = 'E2E_DATABASE_URL';
export const ENV_MAILPIT_URL = 'E2E_MAILPIT_URL';
