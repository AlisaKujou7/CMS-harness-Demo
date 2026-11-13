import { describe, expect, it } from 'vitest';
import { XmlSvgSanitizer } from './xml-svg-sanitizer.js';

const sanitizer = new XmlSvgSanitizer();
const NS = 'xmlns="http://www.w3.org/2000/svg"';
const clean = (svg: string) => {
  const result = sanitizer.sanitize(Buffer.from(svg));
  return result && Buffer.from(result).toString('utf8');
};
const inside = (body: string) => clean(`<svg ${NS}>${body}</svg>`);

describe('XmlSvgSanitizer (SEC-05)', () => {
  it('keeps a normal drawing intact', () => {
    const result = clean(
      `<?xml version="1.0"?><svg ${NS} viewBox="0 0 10 10"><title>Logo</title><defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/><text x="1">Hi &amp; bye</text><use href="#g"/></svg>`,
    );

    expect(result).toContain('viewBox="0 0 10 10"');
    expect(result).toContain('<title>Logo</title>');
    expect(result).toContain('fill="url(#g)"');
    expect(result).toContain('Hi &amp; bye');
    expect(result).toContain('<use href="#g"');
    expect(result).toContain('<stop offset="0" stop-color="#fff"');
  });

  it.each([
    ['a script element', '<script>alert(1)</script>'],
    ['a script in another case', '<SCRIPT>alert(1)</SCRIPT>'],
    ['a namespaced script', '<svg:script>alert(1)</svg:script>'],
    ['a style element', '<style>@import url(http://evil.test/a.css);</style>'],
    ['foreignObject', '<foreignObject><iframe src="http://evil.test"></iframe></foreignObject>'],
    ['an image', '<image href="http://evil.test/x.png"/>'],
    [
      'animation that sets a link',
      '<a><animate attributeName="href" to="javascript:alert(1)"/></a>',
    ],
    ['set', '<set attributeName="onmouseover" to="alert(1)"/>'],
    ['a link', '<a href="javascript:alert(1)"><text>x</text></a>'],
    ['CDATA that hides a script', '<text><![CDATA[<script>alert(1)</script>]]></text>'],
    ['a comment', '<!-- <script>alert(1)</script> -->'],
  ])('removes %s', (_name, body) => {
    const result = inside(`${body}<rect/>`);

    expect(result).toContain('<rect');
    expect(result).not.toMatch(/script|alert|evil|javascript|iframe|animate|<set|<image|<a\b/i);
  });

  it.each([
    ['an event handler', '<rect onload="alert(1)"/>'],
    ['an event handler in another case', '<rect ONCLICK="alert(1)"/>'],
    ['an external href', '<use href="http://evil.test/a.svg#x"/>'],
    ['an external xlink:href', '<use xlink:href="http://evil.test/a.svg#x"/>'],
    ['a javascript href', '<use href="javascript:alert(1)"/>'],
    ['a data href', '<use href="data:image/svg+xml,evil"/>'],
    ['an external url in fill', '<rect fill="url(http://evil.test/a.svg#x)"/>'],
    ['an external url in style', '<rect style="fill:url(http://evil.test/a)"/>'],
    [
      'a second url after an internal one',
      '<rect style="fill:url(#a);stroke:url(http://evil.test)"/>',
    ],
    ['an encoded url', '<rect fill="u&#114;l(http://evil.test)"/>'],
    ['a CSS escape', '<rect style="fill:\\75rl(http://evil.test)"/>'],
    ['a CSS import', '<rect style="@import \'http://evil.test\'"/>'],
    ['a CSS expression', '<rect style="width:expression(alert(1))"/>'],
  ])('removes %s', (_name, body) => {
    const result = inside(`${body}<rect/>`);

    expect(result).toContain('<rect');
    expect(result).not.toMatch(/alert|evil|javascript|data:/i);
  });

  it.each([
    ['image-set', '<rect style="background-image:image-set(\'https://evil.test/a.png\' 1x)"/>'],
    [
      'a fetching function on an allowed property',
      '<rect style="fill:image-set(\'https://evil.test\')"/>',
    ],
    ['a property off the list', '<rect style="cursor:pointer"/>'],
    ['a declaration with no property', '<rect style="evil"/>'],
  ])('removes %s from a style, and the empty attribute', (_name, body) => {
    const result = inside(body);

    expect(result).toContain('<rect');
    expect(result).not.toMatch(/style|evil|cursor/);
  });

  it('keeps the safe declarations of a style', () => {
    const result = inside(
      '<rect style="fill:rgb(1,2,3); cursor:pointer ;stroke:hsla(1,2%,3%,.5)"/>',
    );

    expect(result).toContain('style="fill:rgb(1,2,3);stroke:hsla(1,2%,3%,.5)"');
  });

  it('keeps a safe style', () => {
    expect(inside('<rect style="fill:#fff;stroke:url(#a)"/>')).toContain(
      'style="fill:#fff;stroke:url(#a)"',
    );
  });

  it('cannot be broken out of with a quote inside a value', () => {
    const result = inside(`<rect fill='x" onload="alert(1)'/>`);

    expect(result).toContain('&quot;');
    expect(clean(String(result))).not.toMatch(/onload="/);
  });

  it('removes the children of a removed element', () => {
    expect(inside('<script><rect id="inner"/></script>')).not.toContain('inner');
  });

  it('refuses entity declarations, including XXE and entity bombs', () => {
    expect(
      clean(
        `<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg ${NS}><text>&x;</text></svg>`,
      ),
    ).toBeNull();
    expect(
      clean(`<!DOCTYPE svg [<!ENTITY a "aaaa">]><svg ${NS}><text>&a;</text></svg>`),
    ).toBeNull();
  });

  it('drops a plain doctype', () => {
    expect(clean(`<!DOCTYPE svg><svg ${NS}/>`)).not.toContain('DOCTYPE');
  });

  it.each([
    ['broken XML', `<svg ${NS}><rect></svg>`],
    ['no svg root', '<html><body/></html>'],
    ['two roots', `<svg ${NS}/><svg ${NS}/>`],
    ['nothing', ''],
    ['plain text', 'hello'],
  ])('refuses %s', (_name, source) => {
    expect(clean(source)).toBeNull();
  });

  it('stops at an absurd depth instead of overflowing', () => {
    const depth = 100;
    const result = inside(`${'<g>'.repeat(depth)}<rect id="deep"/>${'</g>'.repeat(depth)}`);

    expect(result).not.toContain('deep');
  });

  it('ignores whitespace around the root', () => {
    expect(clean(`\n  <svg ${NS}><rect/></svg>\n`)).toContain('<rect');
  });
});
