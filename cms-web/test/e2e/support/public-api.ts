import type { APIRequestContext } from '@playwright/test';

export interface PublicArticle {
  readonly title: string;
  readonly slug: string;
  readonly body?: unknown;
}

export async function publicTitles(request: APIRequestContext, apiKey: string): Promise<string[]> {
  const response = await request.get('/api/v1/articles?page_size=100', {
    headers: { 'X-API-Key': apiKey },
  });
  // A failure must not read as "not listed", or an outage would pass for an unpublished article.
  if (!response.ok()) throw new Error(`The public API answered ${String(response.status())}`);
  const { data } = (await response.json()) as { data: readonly PublicArticle[] };
  return data.map((article) => article.title);
}

export async function publicArticle(
  request: APIRequestContext,
  apiKey: string,
  slug: string,
): Promise<PublicArticle> {
  const response = await request.get(`/api/v1/articles/${slug}`, {
    headers: { 'X-API-Key': apiKey },
  });
  if (!response.ok()) throw new Error(`No public article ${slug}: ${String(response.status())}`);
  return ((await response.json()) as { data: PublicArticle }).data;
}
