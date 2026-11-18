import { TablePager } from '../../design-system/components/TablePager';
import type { Pagination } from '../api/types';
import { common } from '../i18n/common.messages';
import { format } from '../i18n/format';

export interface PagerProps {
  readonly pagination: Pagination;
  onPage(page: number): void;
}

export function Pager({ pagination, onPage }: PagerProps) {
  const { page, total_pages: totalPages } = pagination;
  const total = Math.max(totalPages, 1);
  return (
    <TablePager
      page={page}
      totalPages={total}
      label={format(common.pageOf, { page, total })}
      navLabel={common.pagination}
      previousLabel={common.previous}
      nextLabel={common.next}
      onPage={onPage}
    />
  );
}
