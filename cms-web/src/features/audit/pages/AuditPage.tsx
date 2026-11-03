import Button from '@mui/material/Button';
import { useMutation, useQuery } from '@tanstack/react-query';
import { EmptyState } from '../../../design-system/components/EmptyState';
import { PageHeader } from '../../../design-system/components/PageHeader';
import { AuditIcon, DownloadIcon } from '../../../design-system/icons';
import { api, unwrap } from '../../../shared/api/client';
import type { AuditQuery, AuditRow, Paged } from '../../../shared/api/types';
import { useUserDirectory } from '../../../shared/audit/useUserDirectory';
import { saveBlob } from '../../../shared/browser/download';
import { QueryBoundary } from '../../../shared/components/QueryBoundary';
import { useClampPage } from '../../../shared/hooks/useClampPage';
import { useQueryParams } from '../../../shared/hooks/useQueryParams';
import { common } from '../../../shared/i18n/common.messages';
import { toAuditFilter } from '../audit-filters';
import { auditPageMessages as m } from '../audit.messages';
import { AuditFilters } from '../components/AuditFilters';
import { AuditTable } from '../components/AuditTable';

type AuditFilter = Omit<AuditQuery, 'page' | 'page_size'>;

function listEvents(query: AuditQuery): Promise<Paged<AuditRow>> {
  return unwrap(api.GET('/api/admin/audit', { params: { query } }));
}

async function exportEvents(query: AuditFilter): Promise<void> {
  const blob = await unwrap<Blob>(
    api.GET('/api/admin/audit/export.csv', { params: { query }, parseAs: 'blob' }),
  );
  saveBlob(blob, m.exportFile);
}

// 03-DESIGN 12.7. The API returns newest first and offers no other order (ADR-0013).
export function AuditPage() {
  const { params, update, page, setPage } = useQueryParams();
  const filter = toAuditFilter(params);
  const users = useUserDirectory(true);
  const query = useQuery({
    queryKey: ['audit', 'list', filter, page],
    queryFn: () => listEvents({ ...filter, page }),
  });
  useClampPage(query.data, setPage);
  const exportCsv = useMutation({ mutationFn: () => exportEvents(filter) });

  return (
    <>
      <PageHeader
        title={m.title}
        action={
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            loading={exportCsv.isPending}
            onClick={() => {
              exportCsv.mutate();
            }}
          >
            {m.exportCsv}
          </Button>
        }
      />
      <AuditFilters
        params={params}
        users={users}
        onChange={(name, value) => {
          update({ [name]: value });
        }}
      />
      <QueryBoundary query={query}>
        {({ data, pagination }) =>
          data.length === 0 ? (
            <EmptyState
              icon={<AuditIcon />}
              title={m.empty}
              action={
                <Button
                  onClick={() => {
                    update({
                      actor_id: undefined,
                      action: undefined,
                      target_type: undefined,
                      from: undefined,
                      to: undefined,
                    });
                  }}
                >
                  {common.clearFilters}
                </Button>
              }
            />
          ) : (
            <AuditTable rows={data} users={users} pagination={pagination} onPage={setPage} />
          )
        }
      </QueryBoundary>
    </>
  );
}
