import Button from '@mui/material/Button';
import { Link as RouterLink } from 'react-router';
import { StatusScreen } from '../../design-system/components/StatusScreen';
import { ErrorIcon, WarningIcon } from '../../design-system/icons';
import { ApiError } from '../api/api-error';
import { common } from '../i18n/common.messages';
import { format } from '../i18n/format';

const dashboardLink = (
  <Button component={RouterLink} to="/" variant="contained">
    {common.errors.backToDashboard}
  </Button>
);

export function NotFoundScreen() {
  return (
    <StatusScreen
      icon={<WarningIcon color="action" />}
      title={common.errors.notFoundTitle}
      description={common.errors.notFoundBody}
      action={dashboardLink}
    />
  );
}

export function ForbiddenScreen() {
  return (
    <StatusScreen
      icon={<WarningIcon color="action" />}
      title={common.errors.forbiddenTitle}
      description={common.errors.forbiddenBody}
      action={dashboardLink}
    />
  );
}

export interface QueryErrorProps {
  readonly error: unknown;
  onRetry(): void;
}

// 03-DESIGN 14.3: what a page shows when its data would not load.
export function QueryError({ error, onRetry }: QueryErrorProps) {
  const apiError = error instanceof ApiError ? error : null;
  if (apiError?.status === 404) return <NotFoundScreen />;
  if (apiError?.status === 403) return <ForbiddenScreen />;
  const requestId = apiError?.requestId ?? null;
  return (
    <StatusScreen
      icon={<ErrorIcon color="error" />}
      title={common.errors.fetchTitle}
      description={common.errors.fetchBody}
      detail={requestId === null ? null : format(common.errors.requestId, { id: requestId })}
      action={
        <Button variant="contained" onClick={onRetry}>
          {common.retry}
        </Button>
      }
    />
  );
}
