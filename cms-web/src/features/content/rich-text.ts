import type { RichTextDoc } from './types/content.types';

interface RichNode {
  readonly type?: string;
  readonly attrs?: Readonly<Record<string, unknown>>;
  readonly content?: readonly RichNode[];
  readonly marks?: readonly RichNode[];
  readonly text?: string;
}

export const EMPTY_DOC: RichTextDoc = { type: 'doc', content: [] };

function asNode(doc: RichTextDoc): RichNode {
  return doc;
}

function mediaIdOf(node: RichNode): string | null {
  const id = node.attrs?.['mediaId'];
  return node.type === 'image' && typeof id === 'string' ? id : null;
}

function mapNodes(node: RichNode, change: (node: RichNode) => RichNode): RichNode {
  const changed = change(node);
  return changed.content
    ? { ...changed, content: changed.content.map((child) => mapNodes(child, change)) }
    : changed;
}

function visit(node: RichNode, seen: (node: RichNode) => void): void {
  seen(node);
  for (const child of node.content ?? []) visit(child, seen);
}

export function collectMediaIds(doc: RichTextDoc): readonly string[] {
  const ids = new Set<string>();
  visit(asNode(doc), (node) => {
    const id = mediaIdOf(node);
    if (id !== null) ids.add(id);
  });
  return [...ids];
}

function withSources(doc: RichTextDoc, sourceOf: (id: string) => string | undefined): RichTextDoc {
  return mapNodes(asNode(doc), (node) => {
    const id = mediaIdOf(node);
    const src = id === null ? undefined : sourceOf(id);
    return src === undefined ? node : { ...node, attrs: { ...node.attrs, src } };
  }) as RichTextDoc;
}

// A stored src is a signed URL that has probably expired (ADR-0013), and an image that was
// force-deleted has no current one, so it keeps its dead reference and shows its alt text.
export function withCurrentUrls(
  doc: RichTextDoc,
  urls: ReadonlyMap<string, string | null>,
): RichTextDoc {
  return withSources(doc, (id) => urls.get(id) ?? undefined);
}

export function storedUrlsOf(doc: RichTextDoc): ReadonlyMap<string, string> {
  const urls = new Map<string, string>();
  visit(asNode(doc), (node) => {
    const id = mediaIdOf(node);
    if (id !== null) urls.set(id, String(node.attrs?.['src']));
  });
  return urls;
}

// Saving puts the stored src back, so that reading a fresh URL is not a change to the content.
export function withStoredUrls(doc: RichTextDoc, stored: ReadonlyMap<string, string>): RichTextDoc {
  return withSources(doc, (id) => stored.get(id));
}

function cleanAttrs(attrs: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(attrs).filter(([, value]) => value !== null && value !== undefined),
  );
}

const LINK_DEFAULTS = new Set(['rel', 'class']);

function cleanMark(mark: RichNode): RichNode {
  const attrs = cleanAttrs(mark.attrs ?? {});
  const kept = Object.fromEntries(
    Object.entries(attrs).filter(([name]) => !(mark.type === 'link' && LINK_DEFAULTS.has(name))),
  );
  return { type: mark.type ?? '', ...(Object.keys(kept).length > 0 ? { attrs: kept } : {}) };
}

function isEmptyParagraph(node: RichNode): boolean {
  return node.type === 'paragraph' && (node.content ?? []).length === 0;
}

function canonicalChildren(node: RichNode): readonly RichNode[] {
  const children = (node.content ?? []).map(canonical);
  const [only] = children;
  const blank = node.type === 'doc' && children.length === 1 && only && isEmptyParagraph(only);
  return blank ? [] : children;
}

function canonicalAttrs(node: RichNode): Record<string, unknown> {
  const attrs = cleanAttrs(node.attrs ?? {});
  if (mediaIdOf(node) !== null) delete attrs['src'];
  return attrs;
}

function canonical(node: RichNode): RichNode {
  const attrs = canonicalAttrs(node);
  const content = canonicalChildren(node);
  const marks = (node.marks ?? []).map(cleanMark);
  return {
    ...(node.type === undefined ? {} : { type: node.type }),
    ...(node.text === undefined ? {} : { text: node.text }),
    ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
    ...(marks.length > 0 ? { marks } : {}),
    ...(content.length > 0 ? { content } : {}),
  };
}

// The editor adds null attributes and an empty paragraph that the server's sanitizer removes, and
// a signed src changes with every read. Neither is a change the author made.
export function sameDoc(a: RichTextDoc, b: RichTextDoc): boolean {
  return JSON.stringify(canonical(asNode(a))) === JSON.stringify(canonical(asNode(b)));
}

export function missingImages(before: RichTextDoc, after: RichTextDoc): number {
  const kept = new Set(collectMediaIds(after));
  return collectMediaIds(before).filter((id) => !kept.has(id)).length;
}

const SAFE_LINK = /^(https?:\/\/|mailto:|\/(?!\/)|#)/i;

// The same rule as the server's sanitizer, so a link is refused here rather than vanishing on save.
export function isSafeLink(href: string): boolean {
  return SAFE_LINK.test(href);
}
