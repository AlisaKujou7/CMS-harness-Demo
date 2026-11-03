import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { seedArticle, seedUser } from '../support/factories';

// jsdom cannot measure color contrast, so this is where it is checked (06-TEST-STRATEGY 8.7).
async function expectNoViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    results.violations.map(({ id, nodes }) => `${id}: ${nodes[0]?.target.join(' ') ?? ''}`),
  ).toEqual([]);
}

test.describe('accessibility', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`the main screens pass axe in ${colorScheme} mode`, async ({ page, request }) => {
      await page.emulateMedia({ colorScheme });
      const admin = await seedUser('admin');
      const article = await seedArticle(request, admin);

      await page.goto('/login');
      await page.getByRole('heading', { name: 'Sign in to CMS' }).waitFor();
      await expectNoViolations(page);

      await new LoginPage(page).signIn(admin);
      for (const [path, heading] of [
        ['/content/articles', 'Articles'],
        [`/content/articles/${article.id}`, 'Publish'],
        ['/media', 'Media Library'],
        ['/users', 'Users'],
        ['/audit', 'Audit Log'],
        ['/api-keys', 'API Keys'],
        ['/settings/profile', 'Profile'],
      ] as const) {
        await page.goto(path);
        await page.getByRole('heading', { name: heading, exact: true }).waitFor();
        await page.waitForLoadState('networkidle');
        await expectNoViolations(page);
      }
    });
  }

  test('someone can sign in and reach the content with the keyboard alone', async ({ page }) => {
    const editor = await seedUser('editor');

    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email' }).focus();
    await page.keyboard.type(editor.email);
    await page.keyboard.press('Tab');
    await page.keyboard.type(editor.password);
    await page.keyboard.press('Enter');
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });
});
