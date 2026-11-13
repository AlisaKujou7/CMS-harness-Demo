import { acceptInvitation } from '../api/auth.api';
import { authMessages as m } from '../auth.messages';
import { TokenPasswordScreen } from '../components/TokenPasswordScreen';
import { useTokenPassword } from '../hooks/useTokenPassword';

export function AcceptInvitationPage() {
  const state = useTokenPassword(acceptInvitation);
  return (
    <TokenPasswordScreen
      {...state}
      title={m.inviteTitle}
      subtitle={m.inviteSubtitle}
      missingTokenMessage={m.inviteMissingToken}
      doneMessage={m.inviteDone}
    />
  );
}
