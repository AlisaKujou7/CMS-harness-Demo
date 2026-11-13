import { expect, test } from '@playwright/test';
import { ContentEditorPage } from '../pages/content-editor.page';
import { LoginPage } from '../pages/login.page';
import { issueApiKey, seedArticle, seedUser } from '../support/factories';
import { publicTitles } from '../support/public-api';

test('E2E-04: Editor unpublishes, and it leaves the public API within 60 seconds', async ({
  page,
  request,
}) => {
  const editor = await seedUser('editor');
  const apiKey = await issueApiKey(request);
  const article = await seedArticle(request, editor, { publish: true });
  await expect.poll(() => publicTitles(request, apiKey)).toContain(article.title);

  await new LoginPage(page).signIn(editor);
  const editorPage = new ContentEditorPage(page);
  await editorPage.goto(article.id);
  await editorPage.unpublish();

  // FR-CONTENT-12
  await expect
    .poll(() => publicTitles(request, apiKey), { timeout: 60_000 })
    .not.toContain(article.title);
});
