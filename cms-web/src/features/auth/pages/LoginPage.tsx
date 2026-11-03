import { zodResolver } from '@hookform/resolvers/zod';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { FormBanner } from '../../../design-system/components/FormBanner';
import { hasStatus } from '../../../shared/api/api-error';
import { formMessages } from '../../../shared/forms/forms.messages';
import { PasswordField } from '../../../shared/forms/PasswordField';
import { emailField } from '../../../shared/forms/validation';
import { useSessionStore } from '../../../shared/stores/session.store';
import { errorToMessage } from '../../../shared/streams/global-errors.stream';
import { login } from '../api/auth.api';
import { authMessages as m } from '../auth.messages';
import { AuthCard } from '../components/AuthCard';

const schema = z.object({
  email: emailField,
  password: z.string().min(1, formMessages.required),
});
type LoginValues = z.infer<typeof schema>;

function failureMessage(error: unknown): string {
  return hasStatus(error, 401) ? m.badCredentials : errorToMessage(error);
}

// Only a path inside this app, so a crafted link cannot send someone elsewhere after sign-in.
export function safeReturnPath(from: unknown): string {
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/';
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, handleSubmit, formState } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
  });
  const { errors } = formState;
  const mutation = useMutation({
    mutationFn: ({ email, password }: LoginValues) => login(email, password),
    meta: { handlesErrors: true },
    onSuccess: (session) => {
      useSessionStore.getState().start(session);
      void navigate(safeReturnPath((location.state as { from?: unknown } | null)?.from), {
        replace: true,
      });
    },
  });

  return (
    <AuthCard title={m.loginTitle} subtitle={m.loginSubtitle} large>
      {mutation.isError ? <FormBanner message={failureMessage(mutation.error)} /> : null}
      <Stack
        component="form"
        noValidate
        spacing={2}
        onSubmit={(event) => {
          void handleSubmit((values) => {
            mutation.mutate(values);
          })(event);
        }}
      >
        <TextField
          {...register('email')}
          variant="filled"
          label={m.email}
          type="email"
          autoComplete="username"
          error={errors.email !== undefined}
          helperText={errors.email?.message}
        />
        <PasswordField
          {...register('password')}
          variant="filled"
          label={m.password}
          autoComplete="current-password"
          error={errors.password !== undefined}
          helperText={errors.password?.message}
        />
        <Link component={RouterLink} to="/forgot-password" variant="labelLarge">
          {m.forgotLink}
        </Link>
        <Button type="submit" variant="contained" fullWidth loading={mutation.isPending}>
          {m.signIn}
        </Button>
      </Stack>
    </AuthCard>
  );
}
