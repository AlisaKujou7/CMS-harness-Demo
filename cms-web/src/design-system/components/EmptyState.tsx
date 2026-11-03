import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly secondaryAction?: ReactNode;
}

// 03-DESIGN 14.1
export function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <Box sx={{ textAlign: 'center', py: 6, '& svg': { fontSize: 72, color: 'text.secondary' } }}>
      {icon}
      <Typography variant="titleLarge" component="h2" sx={{ display: 'block', mt: 2 }}>
        {title}
      </Typography>
      {description === undefined ? null : (
        <Typography variant="bodyMedium" color="text.secondary" component="p" sx={{ mt: 1 }}>
          {description}
        </Typography>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 3 }}>
        {action}
        {secondaryAction}
      </Box>
    </Box>
  );
}
