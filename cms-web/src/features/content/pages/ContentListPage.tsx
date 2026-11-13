import Button from '@mui/material/Button';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { EmptyState } from '../../../design-system/components/EmptyState';
import { PageHeader } from '../../../design-system/components/PageHeader';
import { AddIcon, ArticleIcon } from '../../../design-system/icons';
import type { ContentType } from '../../../shared/api/types';
import { QueryBoundary } from '../../../shared/components/QueryBoundary';
import { useClampPage } from '../../../shared/hooks/useClampPage';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import { useQueryParams } from '../../../shared/hooks/useQueryParams';
import { common } from '../../../shared/i18n/common.messages';
import { format } from '../../../shared/i18n/format';
import { useCurrentUser } from '../../../shared/stores/session.store';
import { listContent } from '../api/content.api';
import { ContentConfirmations } from '../components/ContentConfirmations';
import { ContentFilters } from '../components/ContentFilters';
import { ContentTable } from '../components/ContentTable';
import {
  authorsIn,
  clearedFilters,
  hasFilters,
  nextSort,
  sortFrom,
  tableSort,
  toContentQuery,
} from '../content-filters';
import { contentMessages as m } from '../content.messages';
import { useRowActions } from '../hooks/useRowActions';
import { editorPath, listPath } from '../types/content.types';

const SEARCH_DEBOUNCE_MS = 300;

function useSearchField(current: string, onSettled: (value: string) => void) {
  const [value, setValue] = useState(current);
  const settled = useDebouncedValue(value, SEARCH_DEBOUNCE_MS);
  useEffect(() => {
    if (settled !== current) onSettled(settled);
    // Only a settled change writes the URL. A URL change is not a reason to write it back.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- See above.
  }, [settled]);
  return [value, setValue] as const;
}

export interface ContentListPageProps {
  readonly type: ContentType;
}

// 03-DESIGN 12.3
export function ContentListPage({ type }: ContentListPageProps) {
  const navigate = useNavigate();
  const viewer = useCurrentUser();
  const { params, update, setPage } = useQueryParams();
  const [search, setSearch] = useSearchField(params.get('search') ?? '', (value) => {
    update({ search: value });
  });
  const filter = useMemo(
    () => toContentQuery(params, type, viewer.id, new Date()),
    // The 30 day window is fixed once per URL, or the query key would change on every render.
    [params, type, viewer.id],
  );
  const query = useQuery({
    queryKey: ['content', 'list', filter],
    queryFn: () => listContent(filter),
    placeholderData: keepPreviousData,
  });
  useClampPage(query.data, setPage);
  const { actionsFor, confirmations } = useRowActions(viewer);
  const newPath = `${listPath(type)}/new`;
  const newLabel = format(m.newItem, { type: m.types[type] });

  return (
    <>
      <PageHeader
        title={m.plural[type]}
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              void navigate(newPath);
            }}
          >
            {newLabel}
          </Button>
        }
      />
      <Tabs
        aria-label={m.list.tabs}
        value={type}
        sx={{ mb: 2 }}
        onChange={(_event, next: ContentType) => {
          void navigate(listPath(next));
        }}
      >
        <Tab value="article" label={m.plural.article} />
        <Tab value="page" label={m.plural.page} />
      </Tabs>
      <ContentFilters
        params={params}
        search={search}
        authors={authorsIn(query.data?.data ?? [])}
        onSearch={setSearch}
        onChange={update}
      />
      <QueryBoundary query={query}>
        {({ data, pagination }) =>
          data.length === 0 ? (
            <EmptyState
              icon={<ArticleIcon />}
              title={
                hasFilters(params)
                  ? m.list.noMatch
                  : format(m.list.emptyTitle, { type: m.plural[type].toLowerCase() })
              }
              {...(hasFilters(params) ? {} : { description: m.list.emptyBody })}
              action={
                hasFilters(params) ? (
                  <Button
                    onClick={() => {
                      setSearch('');
                      update(clearedFilters());
                    }}
                  >
                    {common.clearFilters}
                  </Button>
                ) : null
              }
              secondaryAction={
                <Button
                  variant="contained"
                  onClick={() => {
                    void navigate(newPath);
                  }}
                >
                  {newLabel}
                </Button>
              }
            />
          ) : (
            <ContentTable
              rows={data}
              pagination={pagination}
              sort={tableSort(sortFrom(params))}
              actionsFor={actionsFor}
              onOpen={(row) => {
                void navigate(editorPath(row.type, row.id));
              }}
              onSort={(key) => {
                update({ sort: nextSort(sortFrom(params), key) });
              }}
              onPage={setPage}
            />
          )
        }
      </QueryBoundary>
      <ContentConfirmations {...confirmations} />
    </>
  );
}
