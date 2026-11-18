import type {
  ApiKeyRow,
  AuditRow,
  ContentDetail,
  ContentListRow,
  MediaDetail,
  MediaRow,
  Pagination,
  UserRow,
} from '../../src/shared/api/types';

export const ID = {
  content: '11111111-1111-4111-8111-111111111111',
  media: '22222222-2222-4222-8222-222222222222',
  user: '33333333-3333-4333-8333-333333333333',
  other: '44444444-4444-4444-8444-444444444444',
};

const AT = '2026-05-15T12:00:00.000Z';

export function aPage(overrides: Partial<Pagination> = {}): Pagination {
  return { page: 1, page_size: 25, total: 1, total_pages: 1, ...overrides };
}

export function aListRow(overrides: Partial<ContentListRow> = {}): ContentListRow {
  return {
    id: ID.content,
    type: 'article',
    title: 'Q2 Report',
    slug: 'q2-report',
    status: 'draft',
    author_id: ID.user,
    author_name: 'Alice',
    tags: [],
    category: null,
    scheduled_at: null,
    published_at: null,
    version: 1,
    created_at: AT,
    updated_at: AT,
    ...overrides,
  };
}

export function aContent(overrides: Partial<ContentDetail> = {}): ContentDetail {
  return {
    id: ID.content,
    type: 'article',
    title: 'Q2 Report',
    slug: 'q2-report',
    body: { type: 'doc', content: [] },
    status: 'draft',
    featured_image_id: null,
    social_image_id: null,
    seo_title: null,
    seo_description: null,
    tags: [],
    category: null,
    parent_id: null,
    effective_seo: { title: 'Q2 Report', description: '' },
    author_id: ID.user,
    scheduled_at: null,
    published_at: null,
    review_note: null,
    version: 1,
    created_at: AT,
    updated_at: AT,
    ...overrides,
  };
}

export function aMedia(overrides: Partial<MediaRow> = {}): MediaRow {
  return {
    id: ID.media,
    filename: 'hero.jpg',
    mime_type: 'image/jpeg',
    size_bytes: 1_258_291,
    width: 1920,
    height: 1080,
    alt_text: 'A hero',
    caption: null,
    url: 'https://cdn.example.com/hero.jpg?sig=1',
    variants: {
      thumbnail: { url: 'https://cdn.example.com/hero-t.webp?sig=1', width: 320, height: 180 },
    },
    variant_status: 'ready',
    uploaded_by: ID.user,
    uploader_name: 'Alice',
    created_at: AT,
    ...overrides,
  };
}

export function aMediaDetail(overrides: Partial<MediaDetail> = {}): MediaDetail {
  return { ...aMedia(), usage_count: 0, ...overrides };
}

export function aUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: ID.user,
    email: 'alice@example.com',
    name: 'Alice',
    role: 'editor',
    status: 'active',
    last_login_at: AT,
    created_at: AT,
    ...overrides,
  };
}

export function anAuditEvent(overrides: Partial<AuditRow> = {}): AuditRow {
  return {
    id: ID.other,
    occurred_at: AT,
    actor_id: ID.user,
    actor_ip: '127.0.0.1',
    action: 'content.publish',
    target_type: 'content',
    target_id: ID.content,
    summary: {},
    ...overrides,
  };
}

export function anApiKey(overrides: Partial<ApiKeyRow> = {}): ApiKeyRow {
  return {
    id: ID.other,
    name: 'Production Web',
    prefix: 'cmsk_a1b2c3',
    created_at: AT,
    last_used_at: null,
    revoked_at: null,
    ...overrides,
  };
}
