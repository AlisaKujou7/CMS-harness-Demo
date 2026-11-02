// The media module's answer, reached through the composition root.
export interface MediaCatalog {
  // Of the given ids, those that do not exist.
  findMissing(ids: readonly string[]): Promise<readonly string[]>;
}
