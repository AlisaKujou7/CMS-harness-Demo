import { zodResolver } from '@hookform/resolvers/zod';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link as RouterLink } from 'react-router';
import { z } from 'zod';
import { FormBanner } from '../../../design-system/components/FormBanner';
import { emailField } from '../../../shared/forms/validation';
import { errorToMessage } from '../../../shared/streams/global-errors.stream';
import { requestPasswordReset } from '../api/auth.api';
import { authMessages as m } from '../auth.messages';
import { AuthCard } from '../components/AuthCard';

const schema = z.object({ email: emailField });
type ForgotValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const { register, handleSubmit, formState } = useForm<ForgotValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
  });
  const mutation = useMutation({
    mutationFn: ({ email }: ForgotValues) => requestPasswordReset(email),
    meta: { handlesErrors: true },
  });

  return (
    <AuthCard title={m.forgotTitle} subtitle={m.forgotSubtitle}>
      {mutation.isSuccess ? <FormBanner tone="info" message={m.forgotDone} /> : null}
      {mutation.isError ? <FormBanner message={errorToMessage(mutation.error)} /> : null}
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
          error={formState.errors.email !== undefined}
          helperText={formState.errors.email?.message}
        />
        <Button type="submit" variant="contained" fullWidth loading={mutation.isPending}>
          {m.sendLink}
        </Button>
        <Link component={RouterLink} to="/login" variant="labelLarge">
          {m.backToLogin}
        </Link>
      </Stack>
    </AuthCard>
  );
}
