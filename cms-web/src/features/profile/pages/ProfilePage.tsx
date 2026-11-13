import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { PageHeader } from '../../../design-system/components/PageHeader';
import { useCurrentUser } from '../../../shared/stores/session.store';
import { parseThemeMode, useUiStore } from '../../../shared/stores/ui.store';
import { ChangePasswordContainer } from '../components/ChangePasswordContainer';
import { profileMessages as m } from '../profile.messages';

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <Card elevation={1}>
      <CardContent>
        <Typography variant="titleLarge" component="h2" sx={{ display: 'block', mb: 2 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <Typography variant="bodyMedium" component="p">
      <strong>{label}</strong> {value}
    </Typography>
  );
}

function ThemeChooser() {
  const mode = useUiStore((state) => state.themeMode);
  const setMode = useUiStore((state) => state.setThemeMode);
  return (
    <FormControl>
      <FormLabel id="theme-label">{m.theme}</FormLabel>
      <RadioGroup
        row
        aria-labelledby="theme-label"
        value={mode}
        onChange={(event) => {
          setMode(parseThemeMode(event.target.value));
        }}
      >
        <FormControlLabel value="light" control={<Radio />} label={m.light} />
        <FormControlLabel value="dark" control={<Radio />} label={m.dark} />
        <FormControlLabel value="system" control={<Radio />} label={m.system} />
      </RadioGroup>
    </FormControl>
  );
}

// 03-DESIGN 12.9
export function ProfilePage() {
  const { name, email, role } = useCurrentUser();
  return (
    <>
      <PageHeader title={m.title} />
      <Stack spacing={3}>
        <Section title={m.accountTitle}>
          <Field label={m.name} value={name} />
          <Field label={m.email} value={email} />
          <Field label={m.role} value={m.roles[role]} />
        </Section>
        <Section title={m.passwordTitle}>
          <ChangePasswordContainer />
        </Section>
        <Section title={m.appearanceTitle}>
          <ThemeChooser />
          <Typography variant="bodyMedium" component="p" sx={{ mt: 2 }}>
            <strong>{m.language}</strong> {m.languageSoon}
          </Typography>
        </Section>
      </Stack>
    </>
  );
}
