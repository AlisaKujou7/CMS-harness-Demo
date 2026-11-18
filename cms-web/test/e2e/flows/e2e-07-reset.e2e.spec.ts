import { test } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { ForgotPasswordPage, SetPasswordPage } from '../pages/password.page';
import { seedUser } from '../support/factories';
import { linkEmailedTo } from '../support/mailbox';

test('E2E-07: Someone who forgot a password gets an email, resets it and signs in', async ({
  page,
  request,
}) => {
  const user = await seedUser('author');
  const newPassword = 'a-brand-new-pass-2';

  await new ForgotPasswordPage(page).request(user.email);
  await page.goto(await linkEmailedTo(request, user.email));
  const setPassword = new SetPasswordPage(page);
  await setPassword.setPassword(newPassword);
  await setPassword.expectDone(/password has been changed/);
  await setPassword.backToSignIn();

  const login = new LoginPage(page);
  await login.submit(user.email, user.password);
  await login.expectRefused();
  await login.submit(user.email, newPassword);
  await login.acceptPrivacyNotice();
});
