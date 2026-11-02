export interface RichTextMark {
  readonly type: string;
  readonly attrs?: Readonly<Record<string, unknown>>;
}

// A ProseMirror node, the portable JSON tree FR-CONTENT-14 asks for.
export interface RichTextNode {
  readonly type: string;
  readonly attrs?: Readonly<Record<string, unknown>>;
  readonly content?: readonly RichTextNode[];
  readonly marks?: readonly RichTextMark[];
  readonly text?: string;
}

// PostgreSQL stores neither NUL nor a lone surrogate in text or jsonb, and would answer with a 500.
export function cleanText(input: string): string {
  return input.toWellFormed().replaceAll('\0', '');
}

export const EMPTY_DOCUMENT: RichTextNode = { type: 'doc', content: [] };

function collectText(node: RichTextNode): string {
  if (node.type === 'text') return node.text ?? '';
  const children = node.content ?? [];
  const isTextBlock = children.some((child) => child.type === 'text');
  return children.map(collectText).join(isTextBlock ? '' : ' ');
}

export function plainText(body: RichTextNode): string {
  return collectText(body).replace(/\s+/g, ' ').trim();
}

function hasImage(node: RichTextNode): boolean {
  return node.type === 'image' || (node.content ?? []).some(hasImage);
}

export function hasContent(body: RichTextNode): boolean {
  return plainText(body) !== '' || hasImage(body);
}
