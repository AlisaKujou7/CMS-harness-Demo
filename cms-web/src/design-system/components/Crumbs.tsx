import MuiBreadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router';

export interface Crumb {
  readonly label: string;
  readonly href?: string;
}

export interface CrumbsProps {
  readonly label: string;
  readonly items: readonly Crumb[];
}

// 03-DESIGN 11.3: each link reachable, and the current item is not a link.
export function Crumbs({ label, items }: CrumbsProps) {
  return (
    <MuiBreadcrumbs aria-label={label} sx={{ mb: 2 }}>
      {items.map((item) =>
        item.href === undefined ? (
          <Typography
            key={item.label}
            variant="bodyMedium"
            color="text.primary"
            aria-current="page"
          >
            {item.label}
          </Typography>
        ) : (
          <Link
            key={item.label}
            component={RouterLink}
            to={item.href}
            variant="bodyMedium"
            color="text.secondary"
          >
            {item.label}
          </Link>
        ),
      )}
    </MuiBreadcrumbs>
  );
}
