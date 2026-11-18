import { expect, test } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { UsersPage } from '../pages/users.page';
import { seedUser } from '../support/factories';

test('E2E-10: Admin deactivates a user, who is signed out and cannot return', async ({
  page,
  browser,
}) => {
  const admin = await seedUser('admin');
  const user = await seedUser('editor');

  const userContext = await browser.newContext();
  const userTab = await userContext.newPage();
  const userLogin = new LoginPage(userTab);
  await userLogin.signIn(user);

  await new LoginPage(page).signIn(admin);
  const users = new UsersPage(page);
  await users.goto();
  await users.deactivate(user.name);

  // Their next request finds out, without a reload.
  await userTab.getByRole('link', { name: 'Media', exact: true }).click();
  await userLogin.expectSignInScreen();
  await expect(userTab).toHaveURL(/\/login$/);

  await userLogin.submit(user.email, user.password);
  await userLogin.expectRefused();
  await userContext.close();
});
