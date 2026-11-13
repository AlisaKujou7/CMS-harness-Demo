export interface MediaReferenceReport {
  readonly missing: readonly string[];
  readonly notImages: readonly string[];
}

// The media module's answer, reached through the composition root.
export interface MediaCatalog {
  inspectImages(ids: readonly string[]): Promise<MediaReferenceReport>;
}
