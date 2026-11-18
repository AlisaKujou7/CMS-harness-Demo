import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { spacing } from '../tokens/spacing';

export interface PageHeaderProps {
  readonly title: string;
  readonly action?: ReactNode;
}

export function PageHeader({ title, action }: PageHeaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: `${String(spacing(4))}px`,
        flexWrap: 'wrap',
        mb: `${String(spacing(6))}px`,
      }}
    >
      <Typography variant="headlineLarge" component="h1">
        {title}
      </Typography>
      {action}
    </Box>
  );
}
