import { describe, expect, it } from 'vitest';
import {
  collectMediaIds,
  isSafeLink,
  missingImages,
  sameDoc,
  storedUrlsOf,
  withCurrentUrls,
  withStoredUrls,
} from './rich-text';

const image = (mediaId: string, src = 'https://old/signed') => ({
  type: 'image',
  attrs: { src, mediaId, alt: 'A' },
});
const para = (...content: unknown[]) => ({ type: 'paragraph', content });
const doc = (...content: unknown[]) => ({ type: 'doc', content });
const text = (value: string, marks?: unknown[]) => ({
  type: 'text',
  text: value,
  ...(marks ? { marks } : {}),
});

describe('collectMediaIds', () => {
  it('finds images at any depth, once each', () => {
    const body = doc(
      image('a'),
      { type: 'blockquote', content: [para(image('b')), image('a')] },
      { type: 'image', attrs: { src: 'https://external' } },
    );

    expect(collectMediaIds(body)).toEqual(['a', 'b']);
  });

  it('copes with an empty document', () => {
    expect(collectMediaIds({ type: 'doc' })).toEqual([]);
  });
});

describe('current and stored URLs (ADR-0013)', () => {
  const body = doc(para(image('a')), image('gone'), image('unknown'));

  it('shows a current URL, and leaves a dead reference alone', () => {
    const urls = new Map<string, string | null>([
      ['a', 'https://new/signed'],
      ['gone', null],
    ]);

    expect(withCurrentUrls(body, urls)).toEqual(
      doc(para(image('a', 'https://new/signed')), image('gone'), image('unknown')),
    );
  });

  it('does not mutate what it was given', () => {
    const before = JSON.stringify(body);

    withCurrentUrls(body, new Map([['a', 'https://new']]));

    expect(JSON.stringify(body)).toBe(before);
  });

  it('remembers what is stored and puts it back on save', () => {
    const stored = storedUrlsOf(doc(image('a', 'https://stored')));
    const edited = doc(image('a', 'https://fresh'), image('new', 'https://picked'));

    expect(withStoredUrls(edited, stored)).toEqual(
      doc(image('a', 'https://stored'), image('new', 'https://picked')),
    );
  });

  it('leaves external images and other nodes out of it', () => {
    const external = doc({ type: 'image', attrs: { src: 'https://external' } }, para());

    expect(storedUrlsOf(external).size).toBe(0);
    expect(withStoredUrls(external, new Map())).toEqual(external);
  });
});

describe('sameDoc', () => {
  it.each([
    [
      'null attributes',
      para(text('a')),
      { type: 'paragraph', attrs: { x: null }, content: [text('a')] },
    ],
    ['a signed src on known media', image('a', 'https://one'), image('a', 'https://two')],
    [
      'the defaults the editor adds to a link',
      para(text('a', [{ type: 'link', attrs: { href: '/x' } }])),
      para(text('a', [{ type: 'link', attrs: { href: '/x', rel: 'noopener', class: null } }])),
    ],
    ['empty marks', text('a'), text('a', [])],
    [
      'an empty attribute list on a mark',
      text('a', [{ type: 'bold' }]),
      text('a', [{ type: 'bold', attrs: { x: null } }]),
    ],
    ['an empty content list', { type: 'paragraph' }, { type: 'paragraph', content: [] }],
  ])('ignores %s', (_name, a, b) => {
    expect(sameDoc(doc(a), doc(b))).toBe(true);
  });

  it('treats the lone empty paragraph of a new editor as empty', () => {
    expect(sameDoc(doc(), doc(para()))).toBe(true);
  });

  it.each([
    ['text', para(text('a')), para(text('b'))],
    ['marks', text('a'), text('a', [{ type: 'bold' }])],
    ['alt text', image('a'), { type: 'image', attrs: { src: 'x', mediaId: 'a', alt: 'B' } }],
    [
      'an external image src',
      { type: 'image', attrs: { src: 'https://one' } },
      { type: 'image', attrs: { src: 'https://two' } },
    ],
    [
      'a link target',
      text('a', [{ type: 'link', attrs: { href: '/x' } }]),
      text('a', [{ type: 'link', attrs: { href: '/y' } }]),
    ],
    ['a paragraph with text beside an empty one', para(), para(text('x'))],
  ])('notices a change to %s', (_name, a, b) => {
    expect(sameDoc(doc(a), doc(b))).toBe(false);
  });

  it('keeps two empty paragraphs as content', () => {
    expect(sameDoc(doc(), doc(para(), para()))).toBe(false);
  });

  it('copes with nodes that have no type', () => {
    expect(sameDoc({}, {})).toBe(true);
    expect(sameDoc(doc({ content: [] }), doc({}))).toBe(true);
    expect(sameDoc(doc(text('a', [{}])), doc(text('a', [{ type: '' }])))).toBe(true);
  });
});

describe('missingImages', () => {
  it('counts what a revert could not bring back', () => {
    expect(missingImages(doc(image('a'), image('b')), doc(image('a')))).toBe(1);
    expect(missingImages(doc(image('a')), doc(image('a')))).toBe(0);
  });
});

describe('isSafeLink', () => {
  it.each(['https://a.b', 'http://a.b', 'mailto:a@b.c', '/path', '#top'])('accepts %s', (href) => {
    expect(isSafeLink(href)).toBe(true);
  });

  it.each(['javascript:alert(1)', '//evil.example', 'data:text/html,x', 'a.b'])(
    'refuses %s',
    (href) => {
      expect(isSafeLink(href)).toBe(false);
    },
  );
});
