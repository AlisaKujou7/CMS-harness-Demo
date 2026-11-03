import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

export interface StatCardProps {
  readonly label: string;
  readonly value: number;
  readonly icon: ReactNode;
}

// 03-DESIGN 12.2
export function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <Card elevation={1} sx={{ p: 3, display: 'flex', justifyContent: 'space-between' }}>
      <Box>
        <Typography variant="bodyMedium" color="text.secondary" component="p">
          {label}
        </Typography>
        <Typography variant="displaySmall" color="primary" component="p">
          {value}
        </Typography>
      </Box>
      <Box aria-hidden sx={{ color: 'text.secondary' }}>
        {icon}
      </Box>
    </Card>
  );
}
