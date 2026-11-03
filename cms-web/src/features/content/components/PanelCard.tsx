import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

export interface PanelCardProps {
  readonly title: string;
  readonly children: ReactNode;
}

export function PanelCard({ title, children }: PanelCardProps) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="titleMedium" component="h2" sx={{ display: 'block', mb: 2 }}>
          {title}
        </Typography>
        <Stack spacing={2}>{children}</Stack>
      </CardContent>
    </Card>
  );
}
