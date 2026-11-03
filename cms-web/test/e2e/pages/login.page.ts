import { expect, type Page } from '@playwright/test';

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  async submit(email: string, password: string): Promise<void> {
    await this.page.getByRole('textbox', { name: 'Email' }).fill(email);
    await this.page.getByRole('textbox', { name: 'Password' }).fill(password);
    await this.page.getByRole('button', { name: 'Sign in' }).click();
  }

  // Signs in and accepts the privacy notice a new browser shows on first login.
  async signIn(user: { readonly email: string; readonly password: string }): Promise<void> {
    await this.goto();
    await this.submit(user.email, user.password);
    await this.acceptPrivacyNotice();
  }

  async acceptPrivacyNotice(): Promise<void> {
    await this.page.getByRole('button', { name: 'I understand' }).click();
    await expect(this.page.getByRole('heading', { level: 1 })).toContainText('Good');
  }

  get error() {
    return this.page.getByRole('alert');
  }

  async expectRefused(): Promise<void> {
    await expect(this.error).toContainText('incorrect');
    await expect(this.page).toHaveURL(/\/login$/);
  }

  async expectSignInScreen(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Sign in to CMS' })).toBeVisible();
  }
}
