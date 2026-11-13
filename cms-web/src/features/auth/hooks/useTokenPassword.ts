import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { errorToMessage } from '../../../shared/streams/global-errors.stream';

type SubmitPassword = (token: string, password: string) => Promise<unknown>;

export function useTokenPassword(submit: SubmitPassword) {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const mutation = useMutation({
    mutationFn: (password: string) => submit(token, password),
    meta: { handlesErrors: true },
  });
  return {
    hasToken: token !== '',
    done: mutation.isSuccess,
    pending: mutation.isPending,
    errorMessage: mutation.isError ? errorToMessage(mutation.error) : null,
    onSubmit: (password: string) => {
      mutation.mutate(password);
    },
  };
}
