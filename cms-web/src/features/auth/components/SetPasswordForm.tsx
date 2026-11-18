import { zodResolver } from '@hookform/resolvers/zod';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { formMessages } from '../../../shared/forms/forms.messages';
import { PasswordField } from '../../../shared/forms/PasswordField';
import { newPasswordField } from '../../../shared/forms/validation';
import { authMessages as m } from '../auth.messages';

const schema = z
  .object({ password: newPasswordField, confirm: z.string() })
  .refine((values) => values.password === values.confirm, {
    message: formMessages.passwordsDiffer,
    path: ['confirm'],
  });
type PasswordValues = z.infer<typeof schema>;

export interface SetPasswordFormProps {
  readonly pending: boolean;
  onSubmit(password: string): void;
}

export function SetPasswordForm({ pending, onSubmit }: SetPasswordFormProps) {
  const { register, handleSubmit, formState } = useForm<PasswordValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
  });
  const { errors } = formState;
  return (
    <Stack
      component="form"
      noValidate
      spacing={2}
      onSubmit={(event) => {
        void handleSubmit(({ password }) => {
          onSubmit(password);
        })(event);
      }}
    >
      <PasswordField
        {...register('password')}
        variant="filled"
        label={m.newPassword}
        autoComplete="new-password"
        error={errors.password !== undefined}
        helperText={errors.password?.message ?? formMessages.passwordHelp}
      />
      <PasswordField
        {...register('confirm')}
        variant="filled"
        label={m.confirmPassword}
        autoComplete="new-password"
        error={errors.confirm !== undefined}
        helperText={errors.confirm?.message}
      />
      <Button type="submit" variant="contained" fullWidth loading={pending}>
        {m.setPassword}
      </Button>
    </Stack>
  );
}
