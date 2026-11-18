import { z } from 'zod';
import { AppError } from '../../kernel/app-error.js';

export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input ?? {});
  if (result.success) return result.data;

  // A failed parse always has at least one issue.
  const { message, path } = result.error.issues[0] as z.core.$ZodIssue;
  throw new AppError({
    kind: 'validation',
    code: 'VALIDATION_ERROR',
    message,
    details: { field: String(path[0] ?? '') },
  });
}

export const instant = z.iso.datetime({ offset: true }).transform((value) => new Date(value));
// PostgreSQL refuses NUL in a query parameter, which would otherwise surface as a 500.
export const filterText = z
  .string()
  .max(200)
  .regex(/^[^\0]*$/);

const idSchema = z.object({ id: z.uuid() });

export function parseId(id: string): string {
  return parseInput(idSchema, { id }).id;
}
