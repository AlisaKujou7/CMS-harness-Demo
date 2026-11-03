import { test } from '@playwright/test';
import { ContentEditorPage } from '../pages/content-editor.page';
import { LoginPage } from '../pages/login.page';
import { seedUser, uniqueName } from '../support/factories';

test('E2E-03: Editor rejects with a note, the Author edits, and the Editor approves', async ({
  page,
  browser,
}) => {
  const author = await seedUser('author');
  const editor = await seedUser('editor');
  const note = 'Please add a conclusion.';

  await new LoginPage(page).signIn(author);
  const authorEditor = new ContentEditorPage(page);
  await authorEditor.gotoNewArticle();
  await authorEditor.write(uniqueName('Review flow'), 'First attempt.');
  await authorEditor.saveDraft();
  await authorEditor.expectSaved();
  await authorEditor.submitForReview();
  await authorEditor.expectBanner(/read this, but not edit/);
  const id = authorEditor.idFromUrl();

  const editorContext = await browser.newContext();
  const editorTab = await editorContext.newPage();
  await new LoginPage(editorTab).signIn(editor);
  const reviewer = new ContentEditorPage(editorTab);
  await reviewer.goto(id);
  await reviewer.reject(note);

  await authorEditor.goto(id);
  await authorEditor.expectBanner(new RegExp(note));
  await authorEditor.addToBody(' With a conclusion.');
  await authorEditor.saveDraft();
  await authorEditor.submitForReview();

  await reviewer.goto(id);
  await reviewer.publish();
  await editorContext.close();
});
