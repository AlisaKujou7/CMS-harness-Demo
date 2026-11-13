import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, test, type Page } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { seedArticle, type SeededArticle, seedUser } from '../support/factories';

const MAX_TABS = 80;

// jsdom cannot measure color contrast, so this is where it is checked (06-TEST-STRATEGY 8.7).
async function expectNoViolations(page: Page, overlayOpen = false): Promise<void> {
  // Contrast measured during a fade-in is a false alarm, so finite animations finish first.
  // A cancelled animation rejects, which is as finished as one needs to be.
  await page.evaluate(async () => {
    const finite = document
      .getAnimations()
      .filter((animation) => animation.effect?.getTiming().iterations !== Infinity);
    await Promise.allSettled(finite.map((animation) => animation.finished));
  });
  // A modal hides what is behind it and traps focus itself, which axe cannot see from the markup.
  const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']);
  const results = await (
    overlayOpen ? builder.disableRules(['aria-hidden-focus']) : builder
  ).analyze();
  const found = results.violations.flatMap(({ id, nodes }) =>
    nodes.map((node) => `${id}: ${node.target.join(' ')}`),
  );
  expect(found).toEqual([]);
}

// Tabs forward until the target has focus, as someone without a mouse would.
async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let press = 0; press < MAX_TABS; press += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error(`${String(target)} was not reached within ${String(MAX_TABS)} tabs`);
}

async function scanScreens(page: Page, articleId: string): Promise<void> {
  for (const [path, heading] of [
    ['/', /^Good/],
    ['/content/articles', 'Articles'],
    [`/content/articles/${articleId}`, 'Publish'],
    ['/media', 'Media Library'],
    ['/users', 'Users'],
    ['/audit', 'Audit Log'],
    ['/api-keys', 'API Keys'],
    ['/settings/profile', 'Profile'],
  ] as const) {
    await page.goto(path);
    await page.getByRole('heading', { name: heading }).first().waitFor();
    await page.waitForLoadState('networkidle');
    await expectNoViolations(page);
  }
}

async function scanOverlays(page: Page, article: SeededArticle): Promise<void> {
  await page.goto('/content/articles');
  await page.getByRole('button', { name: `More actions for ${article.title}` }).click();
  await page.getByRole('menu').waitFor();
  await expectNoViolations(page, true);
  await page.keyboard.press('Escape');

  await page.goto(`/content/articles/${article.id}`);
  await page.getByRole('button', { name: 'Image', exact: true }).click();
  await page.getByRole('dialog', { name: 'Select media' }).waitFor();
  await page.waitForLoadState('networkidle');
  await expectNoViolations(page, true);
}

test.describe('accessibility', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`screens and overlays pass axe in ${colorScheme} mode`, async ({ page, request }) => {
      await page.emulateMedia({ colorScheme });
      const admin = await seedUser('admin');
      const article = await seedArticle(request, admin);

      await page.goto('/login');
      await page.getByRole('heading', { name: 'Sign in to CMS' }).waitFor();
      await expectNoViolations(page);

      await new LoginPage(page).signIn(admin);
      await scanScreens(page, article.id);
      await scanOverlays(page, article);
    });
  }

  test('an Editor signs in, finds an article and saves an edit by keyboard alone', async ({
    page,
    request,
  }) => {
    const editor = await seedUser('editor');
    const article = await seedArticle(request, editor);

    await page.goto('/login');
    await tabTo(page, page.getByRole('textbox', { name: 'Email' }));
    await page.keyboard.type(editor.email);
    await page.keyboard.press('Tab');
    await page.keyboard.type(editor.password);
    await page.keyboard.press('Enter');
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();

    await tabTo(page, page.getByRole('link', { name: 'Skip to content' }));
    await tabTo(page, page.getByRole('link', { name: 'Content', exact: true }));
    await page.keyboard.press('Enter');

    const menuButton = page.getByRole('button', { name: `More actions for ${article.title}` });
    await menuButton.waitFor();
    await tabTo(page, menuButton);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'View', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');

    const body = page.getByRole('textbox', { name: 'Body' });
    await body.waitFor();
    await tabTo(page, body);
    await page.keyboard.type('Typed by keyboard. ');
    await tabTo(page, page.getByRole('button', { name: 'Save Draft' }));
    await page.keyboard.press('Enter');
    await expect(page.getByText('Draft saved')).toBeVisible();
    await expect(body).toContainText('Typed by keyboard.');
  });
});
