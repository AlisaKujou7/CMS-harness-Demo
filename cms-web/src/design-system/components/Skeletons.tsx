import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';

export interface SkeletonProps {
  readonly label: string;
  readonly count?: number;
}

const indexes = (count: number) => Array.from({ length: count }, (_, index) => index);

// 03-DESIGN 14.2: shapes that match the layout about to appear.
export function TableSkeleton({ label, count = 5 }: SkeletonProps) {
  return (
    <Box role="status" aria-busy="true" aria-label={label}>
      {indexes(count).map((index) => (
        <Skeleton key={index} variant="rounded" height={44} sx={{ mb: 1 }} />
      ))}
    </Box>
  );
}

export function CardsSkeleton({ label, count = 4 }: SkeletonProps) {
  return (
    <Box
      role="status"
      aria-busy="true"
      aria-label={label}
      sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 3 }}
    >
      {indexes(count).map((index) => (
        <Skeleton key={index} variant="rounded" height={120} />
      ))}
    </Box>
  );
}
