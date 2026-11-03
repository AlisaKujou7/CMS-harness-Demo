import type { paths } from './schema.generated';

type Json<T> = T extends { content: { 'application/json': infer Body } } ? Body : never;
type Data<T> = Json<T> extends { data: infer Value } ? Value : never;

type ContentItem = paths['/api/admin/content/{id}'];
type Content = paths['/api/admin/content'];
type Users = paths['/api/admin/users'];
type Media = paths['/api/admin/media'];
type MediaOne = paths['/api/admin/media/{id}'];

export type ContentDetail = Data<ContentItem['get']['responses'][200]>;
export type ContentListRow = Data<Content['get']['responses'][200]>[number];
export type ContentListQuery = NonNullable<Content['get']['parameters']['query']>;
export type ContentType = ContentDetail['type'];
export type ContentStatus = ContentDetail['status'];
export type ContentCreateBody = Content['post']['requestBody']['content']['application/json'];
export type ContentPatchBody = ContentItem['patch']['requestBody']['content']['application/json'];
export type ContentStats = Data<paths['/api/admin/content/stats']['get']['responses'][200]>;
export type ContentVersionRow = Data<
  paths['/api/admin/content/{id}/versions']['get']['responses'][200]
>[number];
export type ContentVersionDetail = Data<
  paths['/api/admin/content/{id}/versions/{version}']['get']['responses'][200]
>;

export type MediaRow = Data<Media['get']['responses'][200]>[number];
export type MediaDetail = Data<MediaOne['get']['responses'][200]>;
export type MediaKind = NonNullable<NonNullable<Media['get']['parameters']['query']>['kind']>;
export type MediaPatchBody = NonNullable<
  MediaOne['patch']['requestBody']
>['content']['application/json'];
export type PresignedUpload = Data<paths['/api/admin/media/presign']['post']['responses'][200]>;

export type UserRow = Data<Users['get']['responses'][200]>[number];
export type UserRole = UserRow['role'];
export type UserStatus = UserRow['status'];
export type InviteBody = Users['post']['requestBody']['content']['application/json'];
export type UserPatchBody = NonNullable<
  paths['/api/admin/users/{id}']['patch']['requestBody']
>['content']['application/json'];

export type AuditRow = Data<paths['/api/admin/audit']['get']['responses'][200]>[number];
export type AuditQuery = NonNullable<paths['/api/admin/audit']['get']['parameters']['query']>;

export type ApiKeyRow = Data<paths['/api/admin/api-keys']['get']['responses'][200]>[number];
export type NewApiKey = Data<paths['/api/admin/api-keys']['post']['responses'][201]>;

export type AuthSession = Data<paths['/api/admin/auth/login']['post']['responses'][200]>;

export interface Pagination {
  readonly page: number;
  readonly page_size: number;
  readonly total: number;
  readonly total_pages: number;
}

export interface Paged<T> {
  readonly data: readonly T[];
  readonly pagination: Pagination;
}
