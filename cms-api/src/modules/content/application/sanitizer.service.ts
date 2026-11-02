import { InvalidContentError } from '../domain/errors/content.errors.js';
import { cleanText, type RichTextMark, type RichTextNode } from '../domain/services/rich-text.js';

const MAX_DEPTH = 32;
const MAX_NODES = 100_000;
const MAX_URL_LENGTH = 2048;
const MAX_STRIP_PASSES = 5;

const WITH_CHILDREN = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'codeBlock',
]);
const LEAVES = new Set(['horizontalRule', 'hardBreak']);
const SIMPLE_MARKS = new Set(['bold', 'italic', 'underline', 'strike', 'code']);

const SAFE_LINK = /^(https?:\/\/|mailto:|\/(?!\/)|#)/i;
const SAFE_IMAGE = /^(https?:\/\/|\/(?!\/))/i;

const UNSAFE_URL_CHARACTERS = /[\u0000-\u001f\u007f\\]/;
const CODE_LANGUAGE = /^[\w+-]{1,32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DANGEROUS_TAG = /<\/?(script|style|iframe|object|embed)\b/gi;

type Attrs = Readonly<Record<string, unknown>>;

interface Walk {
  nodes: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function reject(message: string): never {
  throw new InvalidContentError('body', message);
}

function isSafeUrl(value: unknown, pattern: RegExp): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAX_URL_LENGTH &&
    pattern.test(value) &&
    !UNSAFE_URL_CHARACTERS.test(value)
  );
}

function stringAttrs(attrs: Attrs, names: readonly string[]): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const name of names) {
    const value = attrs[name];
    if (typeof value === 'string') kept[name] = cleanText(value);
  }
  return kept;
}

function attrsOf(node: Record<string, unknown>): Attrs {
  return isRecord(node['attrs']) ? node['attrs'] : {};
}

// One pass, linear in the text: a tag with no closing ">" or no end tag removes the rest, because
// a browser could treat everything after it as part of the element.
function stripPass(text: string): string {
  const lower = text.toLowerCase();
  let output = '';
  let position = 0;
  for (const match of lower.matchAll(DANGEROUS_TAG)) {
    if (match.index < position) continue;
    output += text.slice(position, match.index);
    const name = String(match[1]);
    const opening = !match[0].startsWith('</');
    const tagEnd = lower.indexOf('>', match.index);
    if (tagEnd === -1) return output;
    position = tagEnd + 1;
    if (opening && name !== 'embed') {
      const closing = lower.indexOf(`</${name}`, position);
      if (closing === -1) return output;
      const closingEnd = lower.indexOf('>', closing);
      if (closingEnd === -1) return output;
      position = closingEnd + 1;
    }
  }
  return output + text.slice(position);
}

// Text nodes are inert in JSON, but a consumer could render them as HTML, and SEC-04 says the API
// never returns executable tags. Removal can join fragments into a new tag, so it repeats.
function stripDangerousMarkup(text: string): string {
  let current = text;
  for (let pass = 0; pass < MAX_STRIP_PASSES; pass += 1) {
    const stripped = stripPass(current);
    if (stripped === current) return stripped;
    current = stripped;
  }
  return current.replaceAll('<', '');
}

function sanitizeLink(attrs: unknown): RichTextMark | null {
  if (!isRecord(attrs) || !isSafeUrl(attrs['href'], SAFE_LINK)) return null;
  const blank = attrs['target'] === '_blank';
  return {
    type: 'link',
    attrs: {
      href: cleanText(attrs['href']),
      ...stringAttrs(attrs, ['title']),
      ...(blank ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
    },
  };
}

function sanitizeMark(mark: unknown): RichTextMark | null {
  if (!isRecord(mark)) return null;
  if (mark['type'] === 'link') return sanitizeLink(mark['attrs']);
  return typeof mark['type'] === 'string' && SIMPLE_MARKS.has(mark['type'])
    ? { type: mark['type'] }
    : null;
}

function sanitizeMarks(marks: unknown): { marks?: RichTextMark[] } {
  if (!Array.isArray(marks)) return {};
  const kept = marks.map(sanitizeMark).filter((mark) => mark !== null);
  return kept.length > 0 ? { marks: kept } : {};
}

function sanitizeText(node: Record<string, unknown>, inCode: boolean): RichTextNode[] {
  if (typeof node['text'] !== 'string') return [];
  const clean = cleanText(node['text']);
  const text = inCode ? clean : stripDangerousMarkup(clean);
  return text === '' ? [] : [{ type: 'text', text, ...sanitizeMarks(node['marks']) }];
}

function sanitizeImage(node: Record<string, unknown>): RichTextNode[] {
  const attrs = attrsOf(node);
  if (!isSafeUrl(attrs['src'], SAFE_IMAGE)) return [];
  const mediaId = attrs['mediaId'];
  return [
    {
      type: 'image',
      attrs: {
        src: cleanText(attrs['src']),
        ...stringAttrs(attrs, ['alt', 'title']),
        ...(typeof mediaId === 'string' && UUID.test(mediaId) ? { mediaId } : {}),
      },
    },
  ];
}

function headingLevel(level: unknown): number {
  return typeof level === 'number' ? Math.min(Math.max(Math.trunc(level), 2), 4) : 2;
}

function blockAttrs(type: string, attrs: Attrs): { attrs?: Attrs } {
  if (type === 'heading') return { attrs: { level: headingLevel(attrs['level']) } };
  if (type === 'orderedList') {
    const { start } = attrs;
    return Number.isInteger(start) && (start as number) >= 1 ? { attrs: { start } } : {};
  }
  if (type === 'codeBlock') {
    const { language } = attrs;
    return typeof language === 'string' && CODE_LANGUAGE.test(language)
      ? { attrs: { language } }
      : {};
  }
  return {};
}

function sanitizeChildren(
  content: unknown,
  depth: number,
  walk: Walk,
  inCode: boolean,
): RichTextNode[] {
  if (!Array.isArray(content)) return [];
  if (depth > MAX_DEPTH) reject('Content is nested too deeply');
  return content.flatMap((child: unknown) => sanitizeNode(child, depth, walk, inCode));
}

function sanitizeNode(node: unknown, depth: number, walk: Walk, inCode: boolean): RichTextNode[] {
  if (!isRecord(node)) return [];
  walk.nodes += 1;
  if (walk.nodes > MAX_NODES) reject('Content is too large');

  const type = String(node['type']);
  if (type === 'text') return sanitizeText(node, inCode);
  if (type === 'image') return sanitizeImage(node);
  if (LEAVES.has(type)) return [{ type }];
  if (WITH_CHILDREN.has(type)) {
    const content = sanitizeChildren(node['content'], depth + 1, walk, type === 'codeBlock');
    return [{ type, ...blockAttrs(type, attrsOf(node)), content }];
  }
  // Unknown wrapper: the wrapper goes, but what it held is judged on its own.
  return sanitizeChildren(node['content'], depth + 1, walk, inCode);
}

// SEC-04: everything not explicitly allowed is removed before storage.
export function sanitizeRichText(input: unknown): RichTextNode {
  if (!isRecord(input) || input['type'] !== 'doc') reject('Body must be a rich text document');
  return { type: 'doc', content: sanitizeChildren(input['content'], 1, { nodes: 0 }, false) };
}
