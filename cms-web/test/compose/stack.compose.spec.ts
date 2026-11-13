import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { ContentEditorPage } from '../e2e/pages/content-editor.page';
import { LoginPage } from '../e2e/pages/login.page';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

function admin(): { email: string; password: string } {
  const email = process.env['COMPOSE_ADMIN_EMAIL'];
  const password = process.env['COMPOSE_ADMIN_PASSWORD'];
  if (email === undefined || password === undefined) {
    throw new Error(
      'Set COMPOSE_ADMIN_EMAIL and COMPOSE_ADMIN_PASSWORD, from infra/.local/admin.env',
    );
  }
  return { email, password };
}

// A policy or CORS refusal reaches the console and may otherwise only look like a missing image.
function collectBrowserRefusals(page: Page): string[] {
  const refusals: string[] = [];
  page.on('console', (message) => {
    if (/content security policy|cors/i.test(message.text())) refusals.push(message.text());
  });
  page.on('pageerror', (error) => refusals.push(error.message));
  return refusals;
}

test('the SPA runs under nginx: session, upload to storage, and images', async ({ page }) => {
  const refusals = collectBrowserRefusals(page);

  await new LoginPage(page).signIn(admin());

  // The session cookie is Secure and SameSite=Strict, so a reload proves it survived the proxy.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign in to CMS' })).toBeHidden();

  const editor = new ContentEditorPage(page);
  await editor.gotoNewArticle();
  await editor.write(`Compose check ${randomUUID()}`, 'A picture follows.');
  await editor.insertNewImage({
    name: `compose-${randomUUID()}.png`,
    mimeType: 'image/png',
    buffer: ONE_PIXEL_PNG,
  });
  await editor.setAltText('One pixel');
  await editor.saveDraft();

  await page.reload();
  const image = editor.body.getByRole('img', { name: 'One pixel' });
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBeGreaterThan(0);

  expect(refusals).toEqual([]);
});

test('the API documentation renders under its own policy', async ({ page }) => {
  const refusals = collectBrowserRefusals(page);

  await page.goto('/docs');

  await expect(page.getByRole('heading', { name: /CMS/ }).first()).toBeVisible();
  expect(refusals).toEqual([]);
});
