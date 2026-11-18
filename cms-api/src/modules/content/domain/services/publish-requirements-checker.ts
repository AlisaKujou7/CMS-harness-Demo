import { MissingRequiredFieldsError } from '../errors/content.errors.js';
import { hasContent, plainText, type RichTextNode } from './rich-text.js';

// FR-CONTENT-06. Title and slug are always valid by construction. The description may be the
// default taken from the body (FR-SEO-02), so only a body with no text leaves it empty.
export function assertPublishable(content: {
  readonly body: RichTextNode;
  readonly seoDescription: string | null;
}): void {
  const missing: string[] = [];
  if (!hasContent(content.body)) missing.push('body');
  if (content.seoDescription === null && plainText(content.body) === '') {
    missing.push('seoDescription');
  }
  if (missing.length > 0) throw new MissingRequiredFieldsError(missing);
}
