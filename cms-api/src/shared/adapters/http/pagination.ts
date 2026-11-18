import { z } from 'zod';
import type { PagedResult } from '../../kernel/paged-result.js';

export const pageQuery = z.object({
  page: z.coerce.number().optional(),
  page_size: z.coerce.number().optional(),
});

export function pageOptions(query: z.output<typeof pageQuery>): {
  page?: number;
  pageSize?: number;
} {
  return {
    ...(query.page === undefined ? {} : { page: query.page }),
    ...(query.page_size === undefined ? {} : { pageSize: query.page_size }),
  };
}

// The list envelope from 02-SRS 7.3.
export function toListResponse<T, R>(result: PagedResult<T>, toItem: (item: T) => R) {
  return {
    data: result.items.map(toItem),
    pagination: {
      page: result.page,
      page_size: result.pageSize,
      total: result.total,
      total_pages: result.totalPages,
    },
  };
}
