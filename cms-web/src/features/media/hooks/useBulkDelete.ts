import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from '../../../shared/i18n/format';
import { deleteMedia } from '../../../shared/media/media.api';
import { notify } from '../../../shared/stores/ui.store';
import { libraryMessages as m } from '../media-library.messages';

// 03-DESIGN 12.5. The API deletes one at a time, and one refusal does not stop the others.
export function useBulkDelete(onDone: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: readonly string[]) => {
      const results = await Promise.allSettled(ids.map((id) => deleteMedia(id, false)));
      return results.filter((result) => result.status === 'fulfilled').length;
    },
    onSuccess: (deleted, ids) => {
      const kept = ids.length - deleted;
      if (kept === 0) notify.success(format(m.bulkDone, { count: deleted }));
      else notify.error(format(m.bulkPartial, { deleted, kept }));
      onDone();
      return queryClient.invalidateQueries({ queryKey: ['media'] });
    },
  });
}
