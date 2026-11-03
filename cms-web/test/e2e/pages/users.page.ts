import { expect, type Locator, type Page } from '@playwright/test';

export class UsersPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/users');
    await expect(this.page.getByRole('heading', { name: 'Users' })).toBeVisible();
  }

  async invite(email: string, role: 'Admin' | 'Editor' | 'Author'): Promise<void> {
    await this.page.getByRole('button', { name: 'Invite user' }).click();
    const dialog = this.page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Email' }).fill(email);
    await dialog.getByRole('combobox', { name: 'Role' }).click();
    await this.page.getByRole('option', { name: role }).click();
    await dialog.getByRole('button', { name: 'Send invite' }).click();
    await expect(this.page.getByText(`Invitation sent to ${email}`)).toBeVisible();
  }

  // The list has no search, and other flows add users, so this walks the pages.
  private async rowFor(name: string): Promise<Locator> {
    const row = this.page.getByRole('row').filter({ hasText: name });
    const next = this.page.getByRole('button', { name: 'Next' });
    await expect(this.page.getByRole('table', { name: 'Users' })).toBeVisible();
    for (let page = 2; (await row.count()) === 0 && (await next.isEnabled()); page += 1) {
      await next.click();
      await expect(this.page.getByText(new RegExp(`^Page ${String(page)} of`))).toBeVisible();
    }
    return row;
  }

  async deactivate(name: string): Promise<void> {
    const row = await this.rowFor(name);
    await row.getByRole('button', { name: `More actions for ${name}` }).click();
    await this.page.getByRole('menuitem', { name: 'Deactivate' }).click();
    await this.page.getByRole('dialog').getByRole('button', { name: 'Deactivate' }).click();
    await expect(this.page.getByText('User deactivated')).toBeVisible();
  }
}
