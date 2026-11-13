import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { ArticleIcon } from '../../../design-system/icons';
import { authMessages as m } from '../auth.messages';

export interface AuthCardProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly large?: boolean;
  readonly children: ReactNode;
}

// 03-DESIGN 12.1
export function AuthCard({ title, subtitle, large = false, children }: AuthCardProps) {
  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: 2,
        bgcolor: 'md.surface',
      }}
    >
      <Card elevation={1} sx={{ width: 400, maxWidth: '100%', p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <ArticleIcon color="primary" sx={{ fontSize: 64 }} titleAccess={m.logoLabel} />
          <Typography
            variant={large ? 'displayMedium' : 'headlineMedium'}
            component="h1"
            sx={{ display: 'block', mt: 3 }}
          >
            {title}
          </Typography>
          {subtitle === undefined ? null : (
            <Typography variant="bodyMedium" color="text.secondary" component="p" sx={{ mt: 1 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {children}
      </Card>
    </Box>
  );
}
