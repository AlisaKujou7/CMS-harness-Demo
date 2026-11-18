import Button from '@mui/material/Button';
import { Link as RouterLink } from 'react-router';
import { FormBanner } from '../../../design-system/components/FormBanner';
import { authMessages as m } from '../auth.messages';
import { AuthCard } from './AuthCard';
import { SetPasswordForm } from './SetPasswordForm';

export interface TokenPasswordScreenProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly hasToken: boolean;
  readonly missingTokenMessage: string;
  readonly doneMessage: string;
  readonly done: boolean;
  readonly pending: boolean;
  readonly errorMessage: string | null;
  onSubmit(password: string): void;
}

// The password reset and the invitation are the same screen with different words.
export function TokenPasswordScreen(props: TokenPasswordScreenProps) {
  const { title, subtitle, hasToken, missingTokenMessage, doneMessage } = props;
  const { done, pending, errorMessage, onSubmit } = props;
  const finished = done || !hasToken;
  return (
    <AuthCard title={title} {...(subtitle === undefined ? {} : { subtitle })}>
      {hasToken ? null : <FormBanner message={missingTokenMessage} />}
      {done ? <FormBanner tone="info" message={doneMessage} /> : null}
      {errorMessage === null ? null : <FormBanner message={errorMessage} />}
      {finished ? (
        <Button component={RouterLink} to="/login" variant="contained" fullWidth>
          {m.backToLogin}
        </Button>
      ) : (
        <SetPasswordForm pending={pending} onSubmit={onSubmit} />
      )}
    </AuthCard>
  );
}
