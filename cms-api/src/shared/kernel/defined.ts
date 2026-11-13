// Drops undefined values, so an absent optional stays absent rather than becoming an explicit key.
export function defined<T extends object>(input: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
}
