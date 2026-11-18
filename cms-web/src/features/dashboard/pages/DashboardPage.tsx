import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router';
import { CardsSkeleton } from '../../../design-system/components/Skeletons';
import { StatCard } from '../../../design-system/components/StatCard';
import {
  AddIcon,
  ArticleIcon,
  CheckIcon,
  EditIcon,
  HourglassIcon,
  UploadIcon,
} from '../../../design-system/icons';
import type { ContentStats } from '../../../shared/api/types';
import { QueryBoundary } from '../../../shared/components/QueryBoundary';
import { format } from '../../../shared/i18n/format';
import { useCurrentUser } from '../../../shared/stores/session.store';
import { greetingKey } from '../../../shared/utils/time';
import { ActivityCard } from '../components/ActivityCard';
import { dashboardMessages as m } from '../dashboard.messages';
import { useContentStats, useRecentActivity } from '../hooks/useDashboard';

function totalOf(stats: ContentStats): number {
  return Object.values(stats).reduce((sum, count) => sum + count, 0);
}

function StatCards({ stats }: { readonly stats: ContentStats }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 3,
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
      }}
    >
      <StatCard label={m.total} value={totalOf(stats)} icon={<ArticleIcon />} />
      <StatCard label={m.published} value={stats.published} icon={<CheckIcon />} />
      <StatCard label={m.inReview} value={stats.in_review} icon={<HourglassIcon />} />
      <StatCard label={m.drafts} value={stats.draft} icon={<EditIcon />} />
    </Box>
  );
}

function QuickActions() {
  return (
    <Card elevation={1}>
      <CardContent>
        <Typography variant="titleLarge" component="h2" sx={{ display: 'block', mb: 2 }}>
          {m.quickTitle}
        </Typography>
        <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
          <Button component={RouterLink} to="/content/articles/new" startIcon={<AddIcon />}>
            {m.newArticle}
          </Button>
          <Button component={RouterLink} to="/content/pages/new" startIcon={<AddIcon />}>
            {m.newPage}
          </Button>
          <Button component={RouterLink} to="/media" startIcon={<UploadIcon />}>
            {m.uploadMedia}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

// 03-DESIGN 12.2
export function DashboardPage() {
  const { name, role } = useCurrentUser();
  const stats = useContentStats();
  const activity = useRecentActivity(role);
  const isAdmin = role === 'admin';
  const greeting = m.greeting[greetingKey(new Date().getHours())];
  return (
    <>
      <Typography variant="displaySmall" component="h1">
        {format(greeting, { name })}
      </Typography>
      <Typography variant="bodyMedium" color="text.secondary" component="p" sx={{ mb: 4 }}>
        {m.subtitle}
      </Typography>
      <QueryBoundary query={stats} skeleton={<CardsSkeleton label={m.loadingStats} />}>
        {(data) => <StatCards stats={data} />}
      </QueryBoundary>
      <Box sx={{ display: 'grid', gap: 3, mt: 3, gridTemplateColumns: { md: '2fr 1fr' } }}>
        <QueryBoundary query={activity}>
          {(items) => (
            <ActivityCard
              title={isAdmin ? m.activityTitle : m.contentTitle}
              items={items}
              showAuditLink={isAdmin}
            />
          )}
        </QueryBoundary>
        <QuickActions />
      </Box>
    </>
  );
}
