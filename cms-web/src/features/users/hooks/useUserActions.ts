import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UserRow } from '../../../shared/api/types';
import { format } from '../../../shared/i18n/format';
import { notify } from '../../../shared/stores/ui.store';
import { deactivateUser, deleteUser, resendInvite, resetUserPassword } from '../api/users.api';
import { userMessages as m } from '../users.messages';

type UserAction = (id: string) => Promise<unknown>;

function useAction(action: UserAction, successMessage: (user: UserRow) => string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (user: UserRow) => action(user.id),
    onSuccess: (_result, user) => {
      notify.success(successMessage(user));
      return queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUserActions() {
  return {
    deactivate: useAction(deactivateUser, () => m.deactivated),
    remove: useAction(deleteUser, () => m.deleted),
    resetPassword: useAction(resetUserPassword, ({ email }) => format(m.resetSent, { email })),
    resendInvite: useAction(resendInvite, ({ email }) => format(m.inviteResent, { email })),
  };
}
