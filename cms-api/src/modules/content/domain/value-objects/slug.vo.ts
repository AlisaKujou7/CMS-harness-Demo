import { InvalidSlugError } from '../errors/content.errors.js';

const PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_LENGTH = 200;
// Leaves room for a numeric suffix when an auto-generated slug is taken.
const MAX_GENERATED_LENGTH = 180;

export class Slug {
  private constructor(readonly value: string) {}

  static create(input: string): Slug {
    const normalized = input.trim().toLowerCase();
    if (normalized.length > MAX_LENGTH || !PATTERN.test(normalized)) throw new InvalidSlugError();
    return new Slug(normalized);
  }

  // FR-CONTENT-02. A title with no Latin letters or digits, such as one in Thai, has nothing to
  // transliterate here, so it takes the fallback and the author can edit the slug afterwards.
  static fromTitle(title: string, fallback: string): Slug {
    const slug = title
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, MAX_GENERATED_LENGTH)
      .replace(/^-|-$/g, '');
    return Slug.create(slug === '' ? fallback : slug);
  }
}
