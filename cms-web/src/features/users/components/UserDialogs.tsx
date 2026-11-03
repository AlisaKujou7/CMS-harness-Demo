import { zodResolver } from '@hookform/resolvers/zod';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormBanner } from '../../../design-system/components/FormBanner';
import type { UserRole, UserRow } from '../../../shared/api/types';
import { common } from '../../../shared/i18n/common.messages';
import { emailField } from '../../../shared/forms/validation';
import { userMessages as m } from '../users.messages';

const ROLES: readonly UserRole[] = ['admin', 'editor', 'author'];
const role = z.enum(['admin', 'editor', 'author']);

const inviteSchema = z.object({ email: emailField, name: z.string().trim(), role });
export type InviteValues = z.infer<typeof inviteSchema>;

const editSchema = z.object({ name: z.string().trim().min(1, m.required), role });
export type EditValues = z.infer<typeof editSchema>;

interface DialogBaseProps {
  readonly pending: boolean;
  readonly error: string | null;
  onClose(): void;
}

function RoleSelect<T extends { role: UserRole }>({
  control,
}: {
  readonly control: ReturnType<typeof useForm<T>>['control'];
}) {
  return (
    <Controller
      control={control}
      name={'role' as never}
      render={({ field }) => (
        <TextField {...field} select label={m.role}>
          {ROLES.map((value) => (
            <MenuItem key={value} value={value}>
              {m.roles[value]}
            </MenuItem>
          ))}
        </TextField>
      )}
    />
  );
}

export interface InviteDialogProps extends DialogBaseProps {
  onSubmit(values: InviteValues): void;
}

export function InviteDialog({ pending, error, onClose, onSubmit }: InviteDialogProps) {
  const titleId = useId();
  const { register, handleSubmit, control, formState } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', name: '', role: 'author' },
  });
  return (
    <Dialog open onClose={onClose} aria-labelledby={titleId} fullWidth maxWidth="xs">
      <DialogTitle id={titleId}>{m.inviteTitle}</DialogTitle>
      <form
        noValidate
        onSubmit={(event) => {
          void handleSubmit(onSubmit)(event);
        }}
      >
        <DialogContent>
          {error === null ? null : <FormBanner message={error} />}
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              {...register('email')}
              label={m.email}
              type="email"
              error={formState.errors.email !== undefined}
              helperText={formState.errors.email?.message}
            />
            <TextField {...register('name')} label={m.optionalName} />
            <RoleSelect control={control} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={onClose}>{common.cancel}</Button>
          <Button type="submit" variant="contained" loading={pending}>
            {m.inviteSend}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export interface EditUserDialogProps extends DialogBaseProps {
  readonly user: UserRow;
  onSubmit(values: EditValues): void;
}

export function EditUserDialog({ user, pending, error, onClose, onSubmit }: EditUserDialogProps) {
  const titleId = useId();
  const { register, handleSubmit, control, formState } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: user.name, role: user.role },
  });
  return (
    <Dialog open onClose={onClose} aria-labelledby={titleId} fullWidth maxWidth="xs">
      <DialogTitle id={titleId}>{m.editUser}</DialogTitle>
      <form
        noValidate
        onSubmit={(event) => {
          void handleSubmit(onSubmit)(event);
        }}
      >
        <DialogContent>
          {error === null ? null : <FormBanner message={error} />}
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              {...register('name')}
              label={m.name}
              error={formState.errors.name !== undefined}
              helperText={formState.errors.name?.message}
            />
            <RoleSelect control={control} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={onClose}>{common.cancel}</Button>
          <Button type="submit" variant="contained" loading={pending}>
            {common.save}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
