import { expect, type Page } from '@playwright/test';

export class ApiKeysPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/api-keys');
    await expect(this.page.getByRole('heading', { name: 'API Keys' })).toBeVisible();
  }

  // Answers with the key, which the screen shows only this once.
  async create(name: string): Promise<string> {
    await this.page.getByRole('button', { name: 'New Key' }).click();
    await this.page.getByRole('dialog').getByRole('textbox', { name: 'Name' }).fill(name);
    await this.page.getByRole('button', { name: 'Create key' }).click();
    const shown = this.page.getByRole('dialog', { name: 'Your new API key' });
    const key = await shown.getByRole('textbox').inputValue();
    await shown.getByRole('button', { name: 'Done' }).click();
    await expect(shown).toBeHidden();
    return key;
  }

  async revoke(name: string): Promise<void> {
    await this.page.getByRole('button', { name: `Revoke ${name}` }).click();
    const dialog = this.page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Key name' }).fill(name);
    await dialog.getByRole('button', { name: 'Revoke' }).click();
    await expect(this.page.getByText('Key revoked')).toBeVisible();
  }
}
