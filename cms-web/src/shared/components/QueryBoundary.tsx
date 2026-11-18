import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { TableSkeleton } from '../../design-system/components/Skeletons';
import { common } from '../i18n/common.messages';
import { QueryError } from './PageErrors';

export interface QueryBoundaryProps<T> {
  readonly query: UseQueryResult<T>;
  readonly skeleton?: ReactNode;
  children(data: T): ReactNode;
}

// 03-DESIGN 14.2 and 14.3: every page loads and fails the same way.
export function QueryBoundary<T>({ query, skeleton, children }: QueryBoundaryProps<T>) {
  if (query.isPending) return skeleton ?? <TableSkeleton label={common.loading} />;
  if (query.isError) {
    return (
      <QueryError
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  return children(query.data);
}
