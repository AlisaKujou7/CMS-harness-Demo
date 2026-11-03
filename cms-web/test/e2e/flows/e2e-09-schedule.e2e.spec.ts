import { expect, test } from '@playwright/test';
import { ContentEditorPage } from '../pages/content-editor.page';
import { LoginPage } from '../pages/login.page';
import { issueApiKey, seedArticle, seedUser } from '../support/factories';
import { publicTitles } from '../support/public-api';

const LEAD_MS = 20_000;

test('E2E-09: Editor schedules an article, and it publishes itself when the time comes', async ({
  page,
  request,
}) => {
  const editor = await seedUser('editor');
  const apiKey = await issueApiKey(request);
  const article = await seedArticle(request, editor);

  await new LoginPage(page).signIn(editor);
  const editorPage = new ContentEditorPage(page);
  await editorPage.goto(article.id);
  await editorPage.scheduleAt(new Date(Date.now() + LEAD_MS));
  expect(await publicTitles(request, apiKey)).not.toContain(article.title);

  // FR-CONTENT-07 allows 60 seconds after the scheduled time.
  await expect
    .poll(() => publicTitles(request, apiKey), { timeout: LEAD_MS + 60_000 })
    .toContain(article.title);
  await editorPage.goto(article.id);
  await editorPage.expectStatus('Published');
});
