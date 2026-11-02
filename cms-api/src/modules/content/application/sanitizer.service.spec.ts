import { describe, expect, it } from 'vitest';
import { InvalidContentError } from '../domain/errors/content.errors.js';
import { sanitizeRichText } from './sanitizer.service.js';

const doc = (...content: unknown[]) => ({ type: 'doc', content });
const paragraph = (...content: unknown[]) => ({ type: 'paragraph', content });
const text = (value: string, marks?: unknown[]) => ({
  type: 'text',
  text: value,
  ...(marks ? { marks } : {}),
});
const inParagraph = (node: unknown) => sanitizeRichText(doc(paragraph(node)));
const firstInline = (node: unknown) => inParagraph(node).content?.[0]?.content?.[0];

describe('sanitizeRichText (SEC-04)', () => {
  describe('document shape', () => {
    it.each([
      ['a string', '<p>hi</p>'],
      ['null', null],
      ['an array', []],
      ['a number', 1],
      ['the wrong root', { type: 'paragraph' }],
      ['no type', {}],
    ])('rejects %s as the body', (_name, input) => {
      expect(() => sanitizeRichText(input)).toThrow(InvalidContentError);
    });

    it('reports the body field', () => {
      try {
        sanitizeRichText('x');
        expect.unreachable();
      } catch (error) {
        expect((error as InvalidContentError).details).toEqual({ field: 'body' });
      }
    });

    it('accepts an empty document', () => {
      expect(sanitizeRichText({ type: 'doc' })).toEqual({ type: 'doc', content: [] });
    });

    it('rejects nesting deeper than 32 levels rather than recursing without limit', () => {
      let node: unknown = text('deep');
      for (let i = 0; i < 40; i += 1) node = { type: 'blockquote', content: [node] };

      expect(() => sanitizeRichText(doc(node))).toThrow(InvalidContentError);
    });

    it('accepts nesting at the limit', () => {
      let node: unknown = paragraph();
      for (let i = 0; i < 30; i += 1) node = { type: 'blockquote', content: [node] };

      expect(() => sanitizeRichText(doc(node))).not.toThrow();
    });

    it('rejects a document with too many nodes', () => {
      const many = Array.from({ length: 100_001 }, () => ({ type: 'horizontalRule' }));

      expect(() => sanitizeRichText(doc(...many))).toThrow(InvalidContentError);
    });

    it('ignores non-array content', () => {
      expect(sanitizeRichText({ type: 'doc', content: 'nope' })).toEqual({
        type: 'doc',
        content: [],
      });
    });

    it('drops children that are not objects', () => {
      expect(sanitizeRichText(doc('text', null, 5, paragraph()))).toEqual(doc(paragraph()));
    });
  });

  describe('allowed structure (FR-CONTENT-15)', () => {
    it('keeps every supported block and inline', () => {
      const input = doc(
        { type: 'heading', attrs: { level: 2 }, content: [text('H')] },
        paragraph(
          text('b', [{ type: 'bold' }]),
          text('i', [{ type: 'italic' }]),
          text('u', [{ type: 'underline' }]),
          text('s', [{ type: 'strike' }]),
          text('c', [{ type: 'code' }]),
          { type: 'hardBreak' },
        ),
        { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('a'))] }] },
        {
          type: 'orderedList',
          attrs: { start: 3 },
          content: [{ type: 'listItem', content: [paragraph(text('b'))] }],
        },
        { type: 'blockquote', content: [paragraph(text('q'))] },
        { type: 'codeBlock', attrs: { language: 'ts' }, content: [text('const a = 1;')] },
        { type: 'horizontalRule' },
        {
          type: 'image',
          attrs: {
            src: 'https://cdn.example.com/a.png',
            alt: 'A',
            title: 'T',
            mediaId: '11111111-1111-4111-8111-111111111111',
          },
        },
      );

      expect(sanitizeRichText(input)).toEqual(input);
    });

    it.each([2, 3, 4])('keeps heading level %i', (level) => {
      const node = { type: 'heading', attrs: { level }, content: [] };

      expect(sanitizeRichText(doc(node)).content?.[0]).toEqual(node);
    });

    it.each([
      [1, 2],
      [0, 2],
      [5, 4],
      [6, 4],
      ['x', 2],
      [undefined, 2],
    ])('moves heading level %s to %i (H2 to H4 only)', (level, expected) => {
      const result = sanitizeRichText(doc({ type: 'heading', attrs: { level }, content: [] }));

      expect(result.content?.[0]?.attrs).toEqual({ level: expected });
    });
  });

  describe('disallowed nodes', () => {
    it.each(['script', 'iframe', 'style', 'object', 'embed', 'svg', 'video', 'foo'])(
      'removes a %s node that has no children',
      (type) => {
        expect(sanitizeRichText(doc({ type }))).toEqual(doc());
      },
    );

    it('keeps the allowed children of an unknown wrapper', () => {
      const input = doc({ type: 'details', content: [paragraph(text('keep'))] });

      expect(sanitizeRichText(input)).toEqual(doc(paragraph(text('keep'))));
    });

    it('removes a nested doc rather than trusting it', () => {
      expect(sanitizeRichText(doc({ type: 'doc', content: [paragraph()] }))).toEqual(
        doc(paragraph()),
      );
    });
  });

  describe('attributes', () => {
    it('drops event handlers and styles', () => {
      const result = sanitizeRichText(
        doc({
          type: 'paragraph',
          attrs: { onclick: 'alert(1)', style: 'x', class: 'y' },
          content: [],
        }),
      );

      expect(result.content?.[0]).toEqual(paragraph());
    });

    it('drops unknown image attributes', () => {
      const result = sanitizeRichText(
        doc({ type: 'image', attrs: { src: '/a.png', onerror: 'alert(1)', srcset: 'x' } }),
      );

      expect(result.content?.[0]?.attrs).toEqual({ src: '/a.png' });
    });

    it('ignores non-string image text attributes', () => {
      const result = sanitizeRichText(
        doc({ type: 'image', attrs: { src: '/a.png', alt: { x: 1 }, title: 5, mediaId: 7 } }),
      );

      expect(result.content?.[0]?.attrs).toEqual({ src: '/a.png' });
    });

    it('drops an image media id that is not a UUID', () => {
      const result = sanitizeRichText(
        doc({ type: 'image', attrs: { src: '/a.png', mediaId: 'x"><script>' } }),
      );

      expect(result.content?.[0]?.attrs).toEqual({ src: '/a.png' });
    });

    it.each(['ts', 'c++', 'objective-c', 'x_1'])('keeps the code language %s', (language) => {
      const result = sanitizeRichText(doc({ type: 'codeBlock', attrs: { language }, content: [] }));

      expect(result.content?.[0]?.attrs).toEqual({ language });
    });

    it.each(['a b', '"><script>', 'x'.repeat(33), 5])('drops the code language %s', (language) => {
      const result = sanitizeRichText(doc({ type: 'codeBlock', attrs: { language }, content: [] }));

      expect(result.content?.[0]).toEqual({ type: 'codeBlock', content: [] });
    });

    it.each([0, -1, 1.5, '2'])('drops the list start %s', (start) => {
      const result = sanitizeRichText(doc({ type: 'orderedList', attrs: { start }, content: [] }));

      expect(result.content?.[0]).toEqual({ type: 'orderedList', content: [] });
    });

    it('keeps a list start of 1', () => {
      const result = sanitizeRichText(
        doc({ type: 'orderedList', attrs: { start: 1 }, content: [] }),
      );

      expect(result.content?.[0]?.attrs).toEqual({ start: 1 });
    });
  });

  describe('link marks', () => {
    const link = (attrs: unknown) => text('x', [{ type: 'link', attrs }]);

    it.each([
      'https://example.com/a?b=1#c',
      'http://example.com',
      'HTTPS://EXAMPLE.COM',
      'mailto:a@example.com',
      '/relative/path',
      '#section',
    ])('keeps %s', (href) => {
      expect(firstInline(link({ href }))?.marks).toEqual([{ type: 'link', attrs: { href } }]);
    });

    it.each([
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      ' javascript:alert(1)',
      'java\nscript:alert(1)',
      'java\tscript:alert(1)',
      '\u0001javascript:alert(1)',
      'javascript&#58;alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      '//evil.example.com',
      '\\\\evil.example.com',
      'relative/without/slash',
      '',
    ])('removes the link with href %j but keeps the text', (href) => {
      expect(firstInline(link({ href }))).toEqual(text('x'));
    });

    it('removes a link with no href', () => {
      expect(firstInline(link({}))).toEqual(text('x'));
    });

    it('removes a link with no attrs', () => {
      expect(firstInline(text('x', [{ type: 'link' }]))).toEqual(text('x'));
    });

    it('keeps a safe target with a safe rel, and a title', () => {
      const marks = firstInline(
        link({ href: '/a', target: '_blank', title: 'T', rel: 'opener', onclick: 'x' }),
      )?.marks;

      expect(marks).toEqual([
        {
          type: 'link',
          attrs: { href: '/a', title: 'T', target: '_blank', rel: 'noopener noreferrer' },
        },
      ]);
    });

    it('drops any other target', () => {
      const marks = firstInline(link({ href: '/a', target: 'x' }))?.marks;

      expect(marks).toEqual([{ type: 'link', attrs: { href: '/a' } }]);
    });
  });

  describe('marks', () => {
    it('removes unknown marks and keeps allowed ones', () => {
      const node = firstInline(text('x', [{ type: 'bold' }, { type: 'evil' }, 'nope', null]));

      expect(node).toEqual(text('x', [{ type: 'bold' }]));
    });

    it('omits the marks key when none survive', () => {
      expect(firstInline(text('x', [{ type: 'evil' }]))).toEqual(text('x'));
    });

    it('drops attributes on simple marks', () => {
      const node = firstInline(text('x', [{ type: 'bold', attrs: { onclick: 'x' } }]));

      expect(node).toEqual(text('x', [{ type: 'bold' }]));
    });

    it('ignores marks that are not an array', () => {
      expect(firstInline({ type: 'text', text: 'x', marks: 'bold' })).toEqual(text('x'));
    });
  });

  describe('image sources', () => {
    it.each(['https://cdn.example.com/a.png', 'http://x.example/a.png', '/media/a.png'])(
      'keeps %s',
      (src) => {
        expect(sanitizeRichText(doc({ type: 'image', attrs: { src } })).content).toHaveLength(1);
      },
    );

    it.each([
      'javascript:alert(1)',
      'data:image/svg+xml,<svg onload=alert(1)>',
      'mailto:a@example.com',
      '#x',
      '//evil.example.com/a.png',
      '',
      5,
    ])('removes an image with source %j', (src) => {
      expect(sanitizeRichText(doc({ type: 'image', attrs: { src } })).content).toEqual([]);
    });

    it('removes an image with no attrs', () => {
      expect(sanitizeRichText(doc({ type: 'image' })).content).toEqual([]);
    });
  });

  describe('text', () => {
    it('removes a text node with no string value', () => {
      expect(sanitizeRichText(doc(paragraph({ type: 'text', text: 5 })))).toEqual(doc(paragraph()));
    });

    it('removes a text node whose value becomes empty', () => {
      expect(sanitizeRichText(doc(paragraph(text('<script>x</script>'))))).toEqual(
        doc(paragraph()),
      );
    });

    it('never stores a script tag from the 02-SRS 11.2 acceptance test', () => {
      const result = sanitizeRichText(doc(paragraph(text('a<script>alert(1)</script>b'))));

      expect(JSON.stringify(result)).not.toMatch(/<script/i);
      expect(firstInline(text('a<script>alert(1)</script>b'))).toEqual(text('ab'));
    });

    it.each([
      ['<SCRIPT SRC=//x></SCRIPT>', ''],
      ['<script>a</script><script>b</script>c', 'c'],
      ['<scr<script></script>ipt>alert(1)</script>', ''],
      ['<iframe src=x></iframe>y', 'y'],
      ['<style>x</style>y', 'y'],
      ['<object data=x></object>y', 'y'],
      ['<embed src=x>y', 'y'],
      ['<script>unterminated', ''],
    ])('strips the dangerous markup %s', (input, expected) => {
      const result = sanitizeRichText(
        doc({ type: 'blockquote', content: [paragraph(text(input))] }),
      );
      const inline = result.content?.[0]?.content?.[0]?.content?.[0];

      expect(inline?.text ?? '').toBe(expected);
    });

    it('leaves ordinary angle brackets alone', () => {
      expect(firstInline(text('1 < 2 and <b>bold</b>'))).toEqual(text('1 < 2 and <b>bold</b>'));
    });

    it('keeps markup inside a code block, where showing it is the point', () => {
      const block = { type: 'codeBlock', content: [text('<script>alert(1)</script>')] };

      expect(sanitizeRichText(doc(block)).content?.[0]).toEqual(block);
    });

    it('drops extra keys on nodes', () => {
      const result = sanitizeRichText(doc({ type: 'paragraph', content: [], evil: true }));

      expect(result.content?.[0]).toEqual(paragraph());
    });
  });

  describe('markup split to survive stripping', () => {
    const textOf = (text: string) => {
      const result = sanitizeRichText({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
      });
      return result.content?.[0]?.content?.[0]?.text ?? '';
    };

    it.each([
      ['a stray end tag', '</script>safe', 'safe'],
      ['an unterminated tag', 'before<script src=x', 'before'],
      ['an unterminated end tag', '<script>x</script', ''],
      ['another element inside the removed one', '<script>a<iframe>b</script>c', 'c'],
      ['a different end tag inside', '<script>a</style>b</script>c', 'c'],
    ])('handles %s', (_name, input, expected) => {
      expect(textOf(input)).toBe(expected);
    });

    it('gives up on angle brackets when removal keeps forming new tags', () => {
      let nested = '<embed>';
      for (let level = 0; level < 7; level += 1) nested = `<em${nested}bed>`;

      expect(textOf(nested)).not.toContain('<');
    });
  });

  it('strips text directly under the document too', () => {
    const result = sanitizeRichText({
      type: 'doc',
      content: [{ type: 'text', text: '<script>x</script>ok' }],
    });

    expect(result.content).toEqual([{ type: 'text', text: 'ok' }]);
  });

  it('counts unknown wrappers towards the depth limit', () => {
    let node: object = { type: 'text', text: 'deep' };
    for (let level = 0; level < 40; level += 1) node = { type: 'wrapper', content: [node] };

    expect(() => sanitizeRichText({ type: 'doc', content: [node] })).toThrow(InvalidContentError);
  });

  it('keeps a language only on a code block', () => {
    const result = sanitizeRichText({
      type: 'doc',
      content: [{ type: 'paragraph', attrs: { language: 'ts' }, content: [] }],
    });

    expect(result.content).toEqual([{ type: 'paragraph', content: [] }]);
  });

  it('limits how long a URL may be', () => {
    const hrefOf = (href: string) => {
      const result = sanitizeRichText({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href } }] }],
          },
        ],
      });
      return result.content?.[0]?.content?.[0]?.marks;
    };

    expect(hrefOf(`/${'a'.repeat(2047)}`)).toHaveLength(1);
    expect(hrefOf(`/${'a'.repeat(2048)}`)).toBeUndefined();
  });

  it('makes a URL safe to store as JSON', () => {
    const result = sanitizeRichText({
      type: 'doc',
      content: [{ type: 'image', attrs: { src: '/a\ud83d.png' } }],
    });

    expect(result.content).toEqual([{ type: 'image', attrs: { src: '/a\ufffd.png' } }]);
  });

  it('removes what PostgreSQL could not store from text and attributes', () => {
    const result = sanitizeRichText({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'a\0b\ud83d' }] },
        { type: 'codeBlock', content: [{ type: 'text', text: 'c\0d' }] },
        { type: 'image', attrs: { src: '/x.png', alt: 'e\0f' } },
      ],
    });

    expect(result.content).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'ab\ufffd' }] },
      { type: 'codeBlock', content: [{ type: 'text', text: 'cd' }] },
      { type: 'image', attrs: { src: '/x.png', alt: 'ef' } },
    ]);
  });
});
