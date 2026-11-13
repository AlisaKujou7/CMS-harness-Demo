import { resetPassword } from '../api/auth.api';
import { authMessages as m } from '../auth.messages';
import { TokenPasswordScreen } from '../components/TokenPasswordScreen';
import { useTokenPassword } from '../hooks/useTokenPassword';

export function ResetPasswordPage() {
  const state = useTokenPassword(resetPassword);
  return (
    <TokenPasswordScreen
      {...state}
      title={m.resetTitle}
      missingTokenMessage={m.resetMissingToken}
      doneMessage={m.resetDone}
    />
  );
}
