import XMLBuilder from 'fast-xml-builder';
import { XMLParser } from 'fast-xml-parser';
import { SyntaxValidator } from 'fast-xml-validator';
import type { SvgSanitizer } from '../../../application/ports/out/media-services.port.js';

const MAX_DEPTH = 64;
const ATTRIBUTES = ':@';
const TEXT = '#text';

// Allow-lists, because SEC-05 can only be met by keeping what is known to be safe. Anything else
// goes with its content: script, style, foreignObject, image, animate, set, and whatever comes next.
const ELEMENTS = new Set([
  'svg',
  'g',
  'defs',
  'symbol',
  'use',
  'title',
  'desc',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
  'mask',
  'pattern',
  'marker',
]);

const ATTRIBUTE_NAMES = new Set([
  'id',
  'class',
  'xmlns',
  'xmlns:xlink',
  'version',
  'viewBox',
  'preserveAspectRatio',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'fx',
  'fy',
  'dx',
  'dy',
  'd',
  'points',
  'width',
  'height',
  'transform',
  'gradientUnits',
  'gradientTransform',
  'patternUnits',
  'patternContentUnits',
  'patternTransform',
  'clipPathUnits',
  'maskUnits',
  'maskContentUnits',
  'markerWidth',
  'markerHeight',
  'markerUnits',
  'refX',
  'refY',
  'orient',
  'spreadMethod',
  'offset',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stop-color',
  'stop-opacity',
  'opacity',
  'clip-path',
  'clip-rule',
  'mask',
  'marker-start',
  'marker-mid',
  'marker-end',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-anchor',
  'dominant-baseline',
  'letter-spacing',
  'color',
  'display',
  'visibility',
  'style',
]);

const INTERNAL_REFERENCE = /^#[\w.:-]+$/;
const REFERENCE_ATTRIBUTES = new Set(['href', 'xlink:href']);
const ANY_URL = /url\s*\(/gi;
const INTERNAL_URL = /url\s*\(\s*['"]?#[\w.:-]+['"]?\s*\)/gi;
// A character reference or a CSS escape could spell out a URL or a scheme past the checks above.
const ENCODED = /[&\\]/;
const CSS_DANGER = /@import|expression\s*\(|behavior\s*:|-moz-binding/i;

type XmlNode = Record<string, unknown>;

function isSafeValue(value: string): boolean {
  if (ENCODED.test(value) || CSS_DANGER.test(value)) return false;
  return value.replace(INTERNAL_URL, '').search(ANY_URL) === -1;
}

function cleanAttributes(attributes: unknown): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const [name, value] of Object.entries((attributes ?? {}) as Record<string, string>)) {
    const allowed = REFERENCE_ATTRIBUTES.has(name)
      ? INTERNAL_REFERENCE.test(value)
      : ATTRIBUTE_NAMES.has(name) && isSafeValue(value);
    // The builder writes values as they are, and a value quoted with ' may hold a ".
    if (allowed) kept[name] = value.replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  }
  return kept;
}

function cleanNode(node: XmlNode, depth: number): XmlNode | null {
  if (TEXT in node) return { [TEXT]: node[TEXT] };
  const name = Object.keys(node).find((key) => key !== ATTRIBUTES);
  if (name === undefined || !ELEMENTS.has(name) || depth > MAX_DEPTH) return null;
  const attributes = cleanAttributes(node[ATTRIBUTES]);
  return {
    [name]: cleanNodes(node[name] as XmlNode[], depth + 1),
    ...(Object.keys(attributes).length > 0 ? { [ATTRIBUTES]: attributes } : {}),
  };
}

function cleanNodes(nodes: readonly XmlNode[], depth: number): XmlNode[] {
  return nodes.flatMap((node): XmlNode[] => {
    const cleaned = cleanNode(node, depth);
    return cleaned ? [cleaned] : [];
  });
}

function isWellFormed(source: string): boolean {
  try {
    SyntaxValidator.validate(source);
    return true;
  } catch {
    return false;
  }
}

// SEC-05. The output is rebuilt from an allow-list instead of having bad parts cut out of the
// input, so anything the parser did not understand is simply not there. Entities are never
// expanded, which also rules out XXE and entity expansion attacks.
export class XmlSvgSanitizer implements SvgSanitizer {
  private readonly parser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    attributeNamePrefix: '',
    processEntities: false,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
    ignoreDeclaration: true,
    ignorePiTags: true,
    // Named so CDATA stays a separate node, which no allow-list contains. Merged into text, its
    // raw "<" would be written straight back out as markup.
    cdataPropName: '__cdata',
  });

  private readonly builder = new XMLBuilder({
    preserveOrder: true,
    ignoreAttributes: false,
    attributeNamePrefix: '',
    processEntities: false,
    suppressEmptyNode: true,
  });

  sanitize(bytes: Uint8Array): Uint8Array | null {
    const source = Buffer.from(bytes).toString('utf8');
    if (/<!ENTITY/i.test(source) || !isWellFormed(source)) return null;

    const nodes = this.parser.parse(source) as XmlNode[];
    const elements = nodes.filter((node) => !(TEXT in node));
    const [root] = elements;
    if (elements.length !== 1 || !root || !('svg' in root)) return null;
    return Buffer.from(this.builder.build(cleanNodes([root], 0)), 'utf8');
  }
}
