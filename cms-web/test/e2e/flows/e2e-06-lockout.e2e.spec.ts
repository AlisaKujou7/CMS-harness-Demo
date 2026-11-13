import { test } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { letLockoutExpire, seedUser } from '../support/factories';

const FAILURES_UNTIL_LOCKED = 5;

test('E2E-06: Five wrong passwords lock the account until the time has passed', async ({
  page,
}) => {
  const user = await seedUser('author');
  const login = new LoginPage(page);
  await login.goto();

  for (let attempt = 0; attempt < FAILURES_UNTIL_LOCKED; attempt += 1) {
    await login.submit(user.email, 'not-the-password-1');
    await login.expectRefused();
  }

  // FR-AUTH-06: even the right password is refused now, with the same generic message.
  await login.submit(user.email, user.password);
  await login.expectRefused();

  await letLockoutExpire(user.id);
  await login.submit(user.email, user.password);
  await login.acceptPrivacyNotice();
});
