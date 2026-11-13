import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

export interface StatusScreenProps {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly detail?: string | null;
  readonly action?: ReactNode;
}

// 03-DESIGN 14.3: the centered card for a page that could not be shown.
export function StatusScreen({ icon, title, description, detail, action }: StatusScreenProps) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
      <Card
        variant="outlined"
        sx={{ p: 4, maxWidth: 480, textAlign: 'center', '& > svg': { fontSize: 48 } }}
      >
        {icon}
        <Typography variant="headlineSmall" component="h1" sx={{ display: 'block', mt: 2 }}>
          {title}
        </Typography>
        <Typography variant="bodyMedium" color="text.secondary" component="p" sx={{ mt: 1 }}>
          {description}
        </Typography>
        {detail == null ? null : (
          <Typography variant="bodySmall" color="text.secondary" component="p" sx={{ mt: 1 }}>
            {detail}
          </Typography>
        )}
        {action === undefined ? null : <Box sx={{ mt: 3 }}>{action}</Box>}
      </Card>
    </Box>
  );
}
