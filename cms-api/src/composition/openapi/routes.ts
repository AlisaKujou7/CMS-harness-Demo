import {
  finalizeMediaRequest,
  mediaDeleteQuery,
  mediaListQuery,
  presignMediaRequest,
  updateMediaRequest,
} from '../../modules/media/adapters/in/http/media.controller.js';
import { articleListQuery } from '../../modules/public-api/adapters/in/http/public.controller.js';
import { pageQuery } from '../../shared/adapters/http/pagination.js';
import * as c from './contract-schemas.js';
import type { ApiRoute } from './route-types.js';
import { ADMIN_ROUTES } from './routes-admin.js';
import { AUTH_ROUTES } from './routes-auth.js';
import { CONTENT_ROUTES } from './routes-content.js';

export type { ApiRoute, Auth } from './route-types.js';

const MEDIA = '/api/admin/media';
const PUBLIC = '/api/v1';
const any = { tag: 'Media', auth: 'bearer' } as const;
const one = `${MEDIA}/{id}`;

const MEDIA_ROUTES: readonly ApiRoute[] = [
  {
    ...any,
    method: 'post',
    path: `${MEDIA}/presign`,
    id: 'presignUpload',
    summary: 'Get a URL to upload a file directly to storage',
    body: presignMediaRequest,
    status: 200,
    response: c.single(c.presignedUpload),
  },
  {
    ...any,
    method: 'post',
    path: MEDIA,
    id: 'finalizeMedia',
    summary: 'Check an uploaded file and add it to the library',
    body: finalizeMediaRequest,
    status: 201,
    response: c.single(c.media),
  },
  {
    ...any,
    method: 'get',
    path: MEDIA,
    id: 'listMedia',
    summary: 'List media',
    query: mediaListQuery,
    status: 200,
    response: c.listOf(c.media),
  },
  {
    ...any,
    method: 'get',
    path: one,
    id: 'getMedia',
    summary: 'Get media, with how much content uses it',
    status: 200,
    response: c.single(c.mediaDetail),
  },
  {
    ...any,
    method: 'patch',
    path: one,
    id: 'updateMedia',
    summary: 'Update alt text and caption. Authors only their own',
    body: updateMediaRequest,
    status: 200,
    response: c.single(c.media),
  },
  {
    ...any,
    method: 'delete',
    path: one,
    id: 'deleteMedia',
    summary: 'Delete media. Authors only their own, and force is for Admins',
    query: mediaDeleteQuery,
    status: 204,
  },
];

const publicRead = { tag: 'Public API', auth: 'apiKey', method: 'get', status: 200 } as const;

const PUBLIC_ROUTES: readonly ApiRoute[] = [
  {
    ...publicRead,
    path: `${PUBLIC}/articles`,
    id: 'listArticles',
    summary: 'List published articles, newest first',
    query: articleListQuery,
    response: c.listOf(c.publicArticle),
  },
  {
    ...publicRead,
    path: `${PUBLIC}/articles/{slug}`,
    id: 'getArticle',
    summary: 'Get a published article',
    response: c.single(c.publicArticleDetail),
  },
  {
    ...publicRead,
    path: `${PUBLIC}/pages`,
    id: 'listPages',
    summary: 'List published pages, newest first',
    query: pageQuery,
    response: c.listOf(c.publicPage),
  },
  {
    ...publicRead,
    path: `${PUBLIC}/pages/{slug}`,
    id: 'getPage',
    summary: 'Get a published page',
    response: c.single(c.publicPageDetail),
  },
  {
    ...publicRead,
    path: `${PUBLIC}/media/{id}`,
    id: 'getPublicMedia',
    summary: 'Get media that published content uses',
    response: c.single(c.publicMedia),
  },
];

const healthRead = {
  tag: 'Health',
  auth: 'none',
  method: 'get',
  status: 200,
  response: c.healthStatus,
} as const;

const HEALTH_ROUTES: readonly ApiRoute[] = [
  { ...healthRead, path: '/healthz', id: 'getLiveness', summary: 'Whether the process is running' },
  {
    ...healthRead,
    path: '/readyz',
    id: 'getReadiness',
    summary: 'Whether it can serve requests. 503 if not',
  },
];

export const API_ROUTES: readonly ApiRoute[] = [
  ...AUTH_ROUTES,
  ...ADMIN_ROUTES,
  ...CONTENT_ROUTES,
  ...MEDIA_ROUTES,
  ...PUBLIC_ROUTES,
  ...HEALTH_ROUTES,
];
