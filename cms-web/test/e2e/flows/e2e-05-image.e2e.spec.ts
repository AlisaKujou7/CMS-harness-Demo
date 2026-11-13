import { expect, test } from '@playwright/test';
import { ContentEditorPage } from '../pages/content-editor.page';
import { LoginPage } from '../pages/login.page';
import { issueApiKey, seedUser, uniqueName } from '../support/factories';
import { publicArticle } from '../support/public-api';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

interface ImageNode {
  readonly type: string;
  readonly attrs?: { readonly src?: string; readonly alt?: string };
  readonly content?: readonly ImageNode[];
}

function firstImage(node: ImageNode): ImageNode | undefined {
  if (node.type === 'image') return node;
  return (node.content ?? []).map(firstImage).find(Boolean);
}

// An Author cannot publish (02-SRS 5.3.1), so this flow ends with an Editor doing it.
test('E2E-05: Author embeds an uploaded image, and it is visible publicly once published', async ({
  page,
  browser,
  request,
}) => {
  const author = await seedUser('author');
  const editor = await seedUser('editor');
  const apiKey = await issueApiKey(request);

  await new LoginPage(page).signIn(author);
  const authorEditor = new ContentEditorPage(page);
  await authorEditor.gotoNewArticle();
  await authorEditor.write(uniqueName('Image flow'), 'A picture follows.');
  await authorEditor.insertNewImage({
    name: `${uniqueName('pixel')}.png`,
    mimeType: 'image/png',
    buffer: ONE_PIXEL_PNG,
  });
  await authorEditor.setAltText('One pixel');
  await authorEditor.saveDraft();
  await authorEditor.submitForReview();
  const id = authorEditor.idFromUrl();
  const slug = await authorEditor.slugValue();

  const editorContext = await browser.newContext();
  const editorTab = await editorContext.newPage();
  await new LoginPage(editorTab).signIn(editor);
  const reviewer = new ContentEditorPage(editorTab);
  await reviewer.goto(id);
  await expect(reviewer.body.getByRole('img', { name: 'One pixel' })).toBeVisible();
  await reviewer.publish();
  await editorContext.close();

  const article = await publicArticle(request, apiKey, slug);
  const image = firstImage(article.body as ImageNode);
  expect(image?.attrs?.alt).toBe('One pixel');
  const file = await request.get(image?.attrs?.src ?? '');
  expect(file.ok()).toBe(true);
  expect(file.headers()['content-type']).toContain('image/png');
});
