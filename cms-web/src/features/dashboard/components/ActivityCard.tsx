import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router';
import { formatRelative } from '../../../shared/utils/time';
import type { ActivityItem } from '../activity';
import { dashboardMessages as m } from '../dashboard.messages';

export interface ActivityCardProps {
  readonly title: string;
  readonly items: readonly ActivityItem[];
  readonly showAuditLink: boolean;
}

export function ActivityCard({ title, items, showAuditLink }: ActivityCardProps) {
  return (
    <Card elevation={1}>
      <CardContent>
        <Typography variant="titleLarge" component="h2">
          {title}
        </Typography>
        {items.length === 0 ? (
          <Typography variant="bodyMedium" color="text.secondary" component="p" sx={{ mt: 2 }}>
            {m.noActivity}
          </Typography>
        ) : (
          <List>
            {items.map((item) => (
              <ListItem key={item.id} disableGutters>
                <ListItemText primary={item.text} secondary={formatRelative(item.at)} />
              </ListItem>
            ))}
          </List>
        )}
        {showAuditLink ? (
          <Button component={RouterLink} to="/audit">
            {m.viewAudit}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
