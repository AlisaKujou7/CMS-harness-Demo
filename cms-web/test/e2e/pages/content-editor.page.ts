import { expect, type Page } from '@playwright/test';

export class ContentEditorPage {
  constructor(private readonly page: Page) {}

  async gotoNewArticle(): Promise<void> {
    await this.page.goto('/content/articles/new');
    await this.body.waitFor();
  }

  async goto(id: string): Promise<void> {
    await this.page.goto(`/content/articles/${id}`);
    await this.body.waitFor();
  }

  get title() {
    return this.page.getByRole('textbox', { name: 'Title', exact: true });
  }

  get body() {
    return this.page.getByRole('textbox', { name: 'Body' });
  }

  private button(name: string) {
    return this.page.getByRole('button', { name, exact: true });
  }

  async write(title: string, body: string): Promise<void> {
    await this.title.fill(title);
    await this.body.click();
    await this.body.pressSequentially(body);
  }

  async addToBody(text: string): Promise<void> {
    await this.body.click();
    await this.page.keyboard.press('Control+End');
    await this.body.pressSequentially(text);
  }

  async saveDraft(): Promise<void> {
    await this.button('Save Draft').click();
    await expect(this.page.getByText('Draft saved')).toBeVisible();
  }

  async submitForReview(): Promise<void> {
    await this.button('Submit for Review').click();
    await this.expectStatus('In Review');
  }

  async publish(): Promise<void> {
    await this.button('Publish').click();
    await this.expectStatus('Published');
  }

  async unpublish(): Promise<void> {
    await this.button('Unpublish').click();
    await this.page.getByRole('dialog').getByRole('button', { name: 'Unpublish' }).click();
    await this.expectStatus('Unpublished');
  }

  async reject(note: string): Promise<void> {
    await this.button('Reject').click();
    const dialog = this.page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: /Note for the author/ }).fill(note);
    await dialog.getByRole('button', { name: 'Reject' }).click();
    await this.expectStatus('Draft');
  }

  // Seconds are what let a flow watch a schedule fire without waiting minutes for it.
  async scheduleAt(when: Date): Promise<void> {
    await this.button('Schedule...').click();
    const dialog = this.page.getByRole('dialog');
    await dialog.getByLabel('Publish on').fill(toLocalInputWithSeconds(when));
    await dialog.getByRole('button', { name: 'Schedule' }).click();
    await this.expectStatus('Scheduled');
  }

  async insertNewImage(file: { name: string; mimeType: string; buffer: Buffer }): Promise<void> {
    await this.button('Image').click();
    const dialog = this.page.getByRole('dialog');
    await dialog.getByLabel('Choose files to upload').setInputFiles(file);
    const insert = dialog.getByRole('button', { name: 'Insert' });
    await expect(insert).toBeEnabled();
    await insert.click();
    // A new image is selected, ready for its alt text, which it needs before a role finds it.
    await expect(this.page.getByRole('textbox', { name: 'Image alt text' })).toBeVisible();
  }

  async setAltText(text: string): Promise<void> {
    await this.page.getByRole('textbox', { name: 'Image alt text' }).fill(text);
  }

  async expectStatus(label: string): Promise<void> {
    await expect(this.page.getByText(`Status: ${label}`, { exact: true })).toBeAttached();
  }

  async expectBanner(text: RegExp): Promise<void> {
    await expect(this.page.getByRole('status').filter({ hasText: text })).toBeVisible();
  }

  slugValue(): Promise<string> {
    return this.page.getByRole('textbox', { name: 'Slug' }).inputValue();
  }

  idFromUrl(): string {
    return new URL(this.page.url()).pathname.split('/').at(-1) ?? '';
  }

  async expectSaved(): Promise<void> {
    await expect(this.page).toHaveURL(/\/content\/articles\/[0-9a-f-]{36}$/);
  }
}

function toLocalInputWithSeconds(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  const date = `${String(value.getFullYear())}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  const time = `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  return `${date}T${time}`;
}
