interface ContentEventFields {
  readonly contentId: string;
  readonly contentType: string;
  readonly slug: string;
}

export interface ContentPublished extends ContentEventFields {
  readonly type: 'ContentPublished';
}

export interface ContentUnpublished extends ContentEventFields {
  readonly type: 'ContentUnpublished';
}

export interface ContentDeleted extends ContentEventFields {
  readonly type: 'ContentDeleted';
}

export type ContentEvent = ContentPublished | ContentUnpublished | ContentDeleted;
export type ContentEventType = ContentEvent['type'];
