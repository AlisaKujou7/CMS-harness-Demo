import { expect, test } from '@playwright/test';
import { ApiKeysPage } from '../pages/api-keys.page';
import { LoginPage } from '../pages/login.page';
import { seedUser, uniqueName } from '../support/factories';

test('E2E-08: Admin creates a key that reads the public API, and revoking it stops that', async ({
  page,
  request,
}) => {
  const admin = await seedUser('admin');
  const name = uniqueName('Flow key');
  const read = (key: string) =>
    request.get('/api/v1/articles', { headers: { 'X-API-Key': key } }).then((res) => res.status());

  await new LoginPage(page).signIn(admin);
  const keys = new ApiKeysPage(page);
  await keys.goto();
  const key = await keys.create(name);
  expect(await read(key)).toBe(200);

  await keys.revoke(name);
  await expect.poll(() => read(key)).toBe(401);
});
