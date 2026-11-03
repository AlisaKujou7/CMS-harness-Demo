import { expect, type Page } from '@playwright/test';

// The screen behind both an invitation link and a password reset link.
export class SetPasswordPage {
  constructor(private readonly page: Page) {}

  async setPassword(password: string): Promise<void> {
    await this.page.getByRole('textbox', { name: 'New password' }).fill(password);
    await this.page.getByRole('textbox', { name: 'Confirm password' }).fill(password);
    await this.page.getByRole('button', { name: 'Set password' }).click();
  }

  async backToSignIn(): Promise<void> {
    await this.page.getByRole('link', { name: 'Back to sign in' }).click();
  }

  async expectDone(message: RegExp): Promise<void> {
    await expect(this.page.getByRole('status')).toContainText(message);
  }
}

export class ForgotPasswordPage {
  constructor(private readonly page: Page) {}

  async request(email: string): Promise<void> {
    await this.page.goto('/login');
    await this.page.getByRole('link', { name: 'Forgot password?' }).click();
    await this.page.getByRole('textbox', { name: 'Email' }).fill(email);
    await this.page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(this.page.getByRole('status')).toContainText('reset link is on its way');
  }
}
