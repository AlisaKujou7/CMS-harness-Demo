export interface MediaUploaded {
  readonly type: 'MediaUploaded';
  readonly mediaId: string;
  readonly needsVariants: boolean;
}

export interface MediaDeleted {
  readonly type: 'MediaDeleted';
  readonly mediaId: string;
}
