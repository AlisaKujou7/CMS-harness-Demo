import { z } from 'zod';

// What each endpoint returns. Strict, so a field added to a response without being added here fails
// the contract test, which is what keeps the published specification honest (M-API-04).
const timestamp = z.iso.datetime();
const nullableTimestamp = timestamp.nullable();
const uuid = z.string();
const role = z.enum(['admin', 'editor', 'author']);
const contentStatus = z.enum(['draft', 'in_review', 'published', 'unpublished', 'archived']);
const contentType = z.enum(['article', 'page']);

export const errorEnvelope = z.strictObject({
  error: z.strictObject({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

const pagination = z.strictObject({
  page: z.number().int(),
  page_size: z.number().int(),
  total: z.number().int(),
  total_pages: z.number().int(),
});

export const single = <T extends z.ZodType>(schema: T) => z.strictObject({ data: schema });
export const listOf = <T extends z.ZodType>(schema: T) =>
  z.strictObject({ data: z.array(schema), pagination });
export const allOf = <T extends z.ZodType>(schema: T) => z.strictObject({ data: z.array(schema) });

export const healthStatus = z.strictObject({ status: z.string() });

export const currentUser = z.strictObject({
  id: uuid,
  email: z.string(),
  name: z.string(),
  role,
});

export const session = z.strictObject({
  access_token: z.string(),
  expires_in: z.number().int(),
  user: currentUser,
});

const apiKeyFields = {
  id: uuid,
  name: z.string(),
  prefix: z.string(),
  created_at: timestamp,
  last_used_at: nullableTimestamp,
  revoked_at: nullableTimestamp,
};
export const apiKey = z.strictObject(apiKeyFields);
export const createdApiKey = z.strictObject({
  ...apiKeyFields,
  key: z.string().describe('The full key. It is shown only this once.'),
});

export const user = z.strictObject({
  id: uuid,
  email: z.string(),
  name: z.string(),
  role,
  status: z.enum(['active', 'deactivated', 'invited']),
  last_login_at: nullableTimestamp,
  created_at: timestamp,
});

export const auditEvent = z.strictObject({
  id: uuid,
  occurred_at: timestamp,
  actor_id: uuid.nullable(),
  actor_ip: z.string().nullable(),
  action: z.string(),
  target_type: z.string().nullable(),
  target_id: uuid.nullable(),
  summary: z.unknown(),
});

const richText = z.unknown().describe('A ProseMirror JSON document');

const contentFields = {
  title: z.string(),
  slug: z.string(),
  body: richText,
  status: contentStatus,
  featured_image_id: uuid.nullable(),
  social_image_id: uuid.nullable(),
  seo_title: z.string().nullable(),
  seo_description: z.string().nullable(),
  tags: z.array(z.string()),
  category: z.string().nullable(),
  parent_id: uuid.nullable(),
};

export const content = z.strictObject({
  id: uuid,
  type: contentType,
  ...contentFields,
  effective_seo: z.strictObject({ title: z.string(), description: z.string() }),
  author_id: uuid,
  scheduled_at: nullableTimestamp,
  published_at: nullableTimestamp,
  review_note: z.string().nullable(),
  version: z.number().int(),
  created_at: timestamp,
  updated_at: timestamp,
});

export const contentListItem = z.strictObject({
  id: uuid,
  type: contentType,
  title: z.string(),
  slug: z.string(),
  status: contentStatus,
  author_id: uuid,
  author_name: z.string(),
  tags: z.array(z.string()),
  category: z.string().nullable(),
  scheduled_at: nullableTimestamp,
  published_at: nullableTimestamp,
  version: z.number().int(),
  created_at: timestamp,
  updated_at: timestamp,
});

export const contentStats = z.strictObject({
  draft: z.number().int(),
  in_review: z.number().int(),
  published: z.number().int(),
  unpublished: z.number().int(),
  archived: z.number().int(),
});

const versionFields = {
  id: uuid,
  version_no: z.number().int(),
  editor_id: uuid.nullable(),
  created_at: timestamp,
};
export const contentVersion = z.strictObject(versionFields);
export const contentVersionDetail = z.strictObject({
  ...versionFields,
  snapshot: z.strictObject(contentFields),
});

const mediaVariants = z.record(
  z.string(),
  z.strictObject({ url: z.url(), width: z.number().int(), height: z.number().int() }),
);

const mediaFields = {
  id: uuid,
  filename: z.string(),
  mime_type: z.string(),
  size_bytes: z.number().int(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  alt_text: z.string().nullable(),
  caption: z.string().nullable(),
  url: z.url().describe('A signed URL that stops working after a while, so fetch it when needed'),
  variants: mediaVariants,
};

const adminMediaFields = {
  ...mediaFields,
  variant_status: z.enum(['pending', 'ready', 'failed', 'none']),
  uploaded_by: uuid,
  uploader_name: z.string().nullable(),
  created_at: timestamp,
};

export const media = z.strictObject(adminMediaFields);
export const mediaDetail = z.strictObject({ ...adminMediaFields, usage_count: z.number().int() });
export const presignedUpload = z.strictObject({
  upload_url: z.url(),
  storage_key: z.string(),
  expires_in: z.number().int(),
  headers: z
    .record(z.string(), z.string())
    .describe('Send these with the upload. They are part of the signature.'),
});

export const publicMedia = z.strictObject(mediaFields);

const publicCommon = {
  id: uuid,
  title: z.string(),
  slug: z.string(),
  featured_image: publicMedia.nullable(),
  published_at: timestamp,
  updated_at: timestamp,
};
const articleFields = {
  ...publicCommon,
  author_name: z.string(),
  tags: z.array(z.string()),
  category: z.string().nullable(),
};
const pageFields = { ...publicCommon, parent_id: uuid.nullable() };
const detailFields = {
  body: richText,
  seo: z.strictObject({
    title: z.string(),
    description: z.string(),
    social_image: publicMedia.nullable(),
  }),
};

export const publicArticle = z.strictObject(articleFields);
export const publicArticleDetail = z.strictObject({ ...articleFields, ...detailFields });
export const publicPage = z.strictObject(pageFields);
export const publicPageDetail = z.strictObject({ ...pageFields, ...detailFields });
