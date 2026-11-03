import { zodResolver } from '@hookform/resolvers/zod';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormBanner } from '../../../design-system/components/FormBanner';
import { api, unwrap } from '../../../shared/api/client';
import { formMessages } from '../../../shared/forms/forms.messages';
import { PasswordField } from '../../../shared/forms/PasswordField';
import { applyServerFieldError, newPasswordField } from '../../../shared/forms/validation';
import { useSessionStore } from '../../../shared/stores/session.store';
import { notify } from '../../../shared/stores/ui.store';
import { errorToMessage } from '../../../shared/streams/global-errors.stream';
import { profileMessages as m } from '../profile.messages';

const schema = z
  .object({
    current: z.string().min(1, formMessages.required),
    password: newPasswordField,
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: formMessages.passwordsDiffer,
    path: ['confirm'],
  });
type PasswordValues = z.infer<typeof schema>;

const SERVER_FIELDS = { currentPassword: 'current', newPassword: 'password' } as const;

function submit({ current, password }: PasswordValues): Promise<unknown> {
  return unwrap(
    api.POST('/api/admin/auth/password/change', {
      body: { current_password: current, new_password: password },
    }),
  );
}

// FR-AUTH-05: this ends every session, this one included, so it signs out rather than failing later.
export function ChangePasswordContainer() {
  const queryClient = useQueryClient();
  const { register, handleSubmit, setError, formState } = useForm<PasswordValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
  });
  const { errors } = formState;
  const mutation = useMutation({
    mutationFn: submit,
    meta: { handlesErrors: true },
    onSuccess: () => {
      notify.success(m.changed);
      useSessionStore.getState().end();
      queryClient.clear();
    },
    onError: (error) => {
      applyServerFieldError(error, SERVER_FIELDS, setError);
    },
  });
  const onField = errors.current?.type === 'server' || errors.password?.type === 'server';
  return (
    <Stack
      component="form"
      noValidate
      spacing={2}
      sx={{ maxWidth: 480 }}
      onSubmit={(event) => {
        void handleSubmit((values) => {
          mutation.mutate(values);
        })(event);
      }}
    >
      {mutation.isError && !onField ? (
        <FormBanner message={errorToMessage(mutation.error)} />
      ) : null}
      <PasswordField
        {...register('current')}
        label={m.currentPassword}
        autoComplete="current-password"
        error={errors.current !== undefined}
        helperText={errors.current?.message}
      />
      <PasswordField
        {...register('password')}
        label={m.newPassword}
        autoComplete="new-password"
        error={errors.password !== undefined}
        helperText={errors.password?.message ?? formMessages.passwordHelp}
      />
      <PasswordField
        {...register('confirm')}
        label={m.confirmPassword}
        autoComplete="new-password"
        error={errors.confirm !== undefined}
        helperText={errors.confirm?.message}
      />
      <Button
        type="submit"
        variant="contained"
        loading={mutation.isPending}
        sx={{ alignSelf: 'flex-start' }}
      >
        {m.changePassword}
      </Button>
    </Stack>
  );
}
