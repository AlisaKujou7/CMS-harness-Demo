import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import pg from 'pg';
import { ADMIN_EMAIL, ENV_DATABASE_URL, USER_PASSWORD } from './stack-config';

export type Role = 'admin' | 'editor' | 'author';

export interface TestUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly password: string;
}

export function uniqueName(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

async function query<T extends pg.QueryResultRow>(text: string, values: unknown[]): Promise<T[]> {
  const client = new pg.Client({ connectionString: process.env[ENV_DATABASE_URL] });
  await client.connect();
  try {
    return (await client.query<T>(text, values)).rows;
  } finally {
    await client.end();
  }
}

// 06-TEST-STRATEGY 9.2.3: setup goes through the database, not the screens. Every account shares
// the seeded Admin's password hash, because hashing is what the auth specs test.
export async function seedUser(role: Role): Promise<TestUser> {
  const id = randomUUID();
  const name = uniqueName(role);
  const email = `${name}@e2e.test`;
  const inserted = await query(
    `INSERT INTO users (id, email, name, password_hash, role, status, created_at, updated_at)
     SELECT $1, $2, $3, password_hash, $4::user_role, 'active', now(), now()
     FROM users WHERE email = $5
     RETURNING id`,
    [id, email, name, role, ADMIN_EMAIL],
  );
  if (inserted.length !== 1) throw new Error(`The seeded Admin ${ADMIN_EMAIL} is missing`);
  return { id, email, name, password: USER_PASSWORD };
}

// Stands in for the 15 minutes FR-AUTH-06 makes someone wait, as if they had passed.
export async function letLockoutExpire(userId: string): Promise<void> {
  await query(
    `UPDATE login_lockouts SET locked_until = now() - interval '1 second' WHERE user_id = $1`,
    [userId],
  );
}

async function signInByApi(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const response = await request.post('/api/admin/auth/login', { data: { email, password } });
  if (!response.ok()) throw new Error(`Could not sign in ${email}: ${String(response.status())}`);
  const { data } = (await response.json()) as { data: { access_token: string } };
  return data.access_token;
}

export interface SeededArticle {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
}

const paragraph = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

export async function seedArticle(
  request: APIRequestContext,
  author: TestUser,
  options: { readonly publish?: boolean } = {},
): Promise<SeededArticle> {
  const token = await signInByApi(request, author.email, author.password);
  const headers = { Authorization: `Bearer ${token}` };
  const title = uniqueName('Seeded article');
  const created = await request.post('/api/admin/content', {
    headers,
    data: { type: 'article', title, body: paragraph('Seeded body text.') },
  });
  if (!created.ok()) throw new Error(`Could not seed content: ${await created.text()}`);
  const { data } = (await created.json()) as { data: { id: string; slug: string } };
  if (options.publish === true) {
    const published = await request.post(`/api/admin/content/${data.id}/publish`, { headers });
    if (!published.ok()) throw new Error(`Could not publish: ${await published.text()}`);
  }
  return { id: data.id, slug: data.slug, title };
}

export async function issueApiKey(request: APIRequestContext): Promise<string> {
  const token = await signInByApi(request, ADMIN_EMAIL, USER_PASSWORD);
  const response = await request.post('/api/admin/api-keys', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: uniqueName('flow key') },
  });
  if (!response.ok()) throw new Error(`Could not issue a key: ${await response.text()}`);
  const { data } = (await response.json()) as { data: { key: string } };
  return data.key;
}
