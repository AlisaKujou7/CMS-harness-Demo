import { expect, test } from '@playwright/test';
import { ContentEditorPage } from '../pages/content-editor.page';
import { LoginPage } from '../pages/login.page';
import { issueApiKey, seedUser, uniqueName } from '../support/factories';
import { publicTitles } from '../support/public-api';

test('E2E-02: Editor drafts, submits and publishes, and it reaches the public API', async ({
  page,
  request,
}) => {
  const editor = await seedUser('editor');
  const apiKey = await issueApiKey(request);
  const title = uniqueName('Publish flow');

  await new LoginPage(page).signIn(editor);
  const editorPage = new ContentEditorPage(page);
  await editorPage.gotoNewArticle();
  await editorPage.write(title, 'Lorem ipsum.');
  await editorPage.saveDraft();
  await editorPage.expectStatus('Draft');
  expect(await publicTitles(request, apiKey)).not.toContain(title);

  await editorPage.submitForReview();
  expect(await publicTitles(request, apiKey)).not.toContain(title);

  await editorPage.publish();
  await expect.poll(() => publicTitles(request, apiKey), { timeout: 60_000 }).toContain(title);
});
