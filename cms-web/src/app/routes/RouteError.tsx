import Button from '@mui/material/Button';
import { useRouteError } from 'react-router';
import { StatusScreen } from '../../design-system/components/StatusScreen';
import { ErrorIcon } from '../../design-system/icons';
import { ApiError } from '../../shared/api/api-error';
import { common } from '../../shared/i18n/common.messages';
import { format } from '../../shared/i18n/format';

// 03-DESIGN 14.3: the screen for anything that escapes a page, including a chunk that fails to load.
export function RouteError() {
  const error = useRouteError();
  const requestId = error instanceof ApiError ? error.requestId : null;
  return (
    <StatusScreen
      icon={<ErrorIcon color="error" />}
      title={common.errors.serverTitle}
      description={common.errors.server}
      detail={requestId === null ? null : format(common.errors.requestId, { id: requestId })}
      action={
        <Button
          variant="contained"
          onClick={() => {
            window.location.reload();
          }}
        >
          {common.reload}
        </Button>
      }
    />
  );
}
