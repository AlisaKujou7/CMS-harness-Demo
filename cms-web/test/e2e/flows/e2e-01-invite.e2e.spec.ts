import { test } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { SetPasswordPage } from '../pages/password.page';
import { UsersPage } from '../pages/users.page';
import { seedUser, uniqueName } from '../support/factories';
import { linkEmailedTo } from '../support/mailbox';

test('E2E-01: Admin invites a user, who accepts and signs in', async ({
  page,
  browser,
  request,
}) => {
  const admin = await seedUser('admin');
  const email = `${uniqueName('invited')}@e2e.test`;
  const password = 'invited-user-pass-1';

  await new LoginPage(page).signIn(admin);
  const users = new UsersPage(page);
  await users.goto();
  await users.invite(email, 'Editor');

  const link = await linkEmailedTo(request, email);
  const invitedContext = await browser.newContext();
  const invited = await invitedContext.newPage();
  await invited.goto(link);
  const setPassword = new SetPasswordPage(invited);
  await setPassword.setPassword(password);
  await setPassword.expectDone(/account is ready/);
  await setPassword.backToSignIn();

  const login = new LoginPage(invited);
  await login.submit(email, password);
  await login.acceptPrivacyNotice();
  await invitedContext.close();
});
