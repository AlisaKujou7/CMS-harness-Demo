const MAX_STRIP_PASSES = 5;

// What starts a tag in an HTML parser: "<" and then one of these.
const TAG_START = /<[a-z/!?]/gi;
// A "<" that could still become a tag when a consumer joins this text to what follows it.
const DANGLING_START = /<(?=[a-z/!?]|$)/gi;
// These hold what they enclose as code or a nested document, so the content goes with the tag.
const ELEMENT_WITH_CONTENT = /^<(script|style|iframe|object)\b/i;
const LONGEST_ELEMENT_OPENING = 8;

// PostgreSQL stores neither NUL nor a lone surrogate in text or jsonb, and would answer with a 500.
export function cleanText(input: string): string {
  return input.toWellFormed().replaceAll('\0', '');
}

function endOfElement(text: string, name: string, from: number, unclosed: Set<string>): number {
  if (unclosed.has(name)) return from;
  const closing = new RegExp(`</${name}`, 'gi');
  closing.lastIndex = from;
  const found = closing.exec(text);
  if (!found) {
    unclosed.add(name);
    return from;
  }
  const end = text.indexOf('>', found.index);
  return end === -1 ? text.length : end + 1;
}

// One pass, linear in the text: positions only move forward, and elements already known to have
// no end tag are not searched for again. An element with no end tag loses only its tag, so writing
// "the <style> tag" in prose does not delete the rest of the paragraph.
function removeTags(text: string): string {
  const unclosed = new Set<string>();
  let output = '';
  let position = 0;
  for (const { index } of text.matchAll(TAG_START)) {
    if (index < position) continue;
    const tagEnd = text.indexOf('>', index);
    if (tagEnd === -1) break;
    output += text.slice(position, index);
    position = tagEnd + 1;
    const opening = text.slice(index, index + LONGEST_ELEMENT_OPENING);
    const name = ELEMENT_WITH_CONTENT.exec(opening)?.[1]?.toLowerCase();
    if (name !== undefined) position = endOfElement(text, name, position, unclosed);
  }
  return (output + text.slice(position)).replace(DANGLING_START, '');
}

// SEC-04: a consumer could render any stored text as HTML, and no list of dangerous tags is ever
// complete, so no tag survives. Formatting lives in marks, so a real tag in text has no meaning.
// Matching runs on the text itself, because changing case can change a string's length and move
// every index. Removal can join fragments into a new tag, so it repeats.
export function stripMarkup(text: string): string {
  let current = text;
  for (let pass = 0; pass < MAX_STRIP_PASSES; pass += 1) {
    const stripped = removeTags(current);
    if (stripped === current) return stripped;
    current = stripped;
  }
  return current.replaceAll('<', '');
}

export function safeText(input: string): string {
  return stripMarkup(cleanText(input));
}
