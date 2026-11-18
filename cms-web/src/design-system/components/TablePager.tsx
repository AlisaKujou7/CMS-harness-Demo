import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

export interface TablePagerProps {
  readonly page: number;
  readonly totalPages: number;
  readonly label: string;
  readonly navLabel: string;
  readonly previousLabel: string;
  readonly nextLabel: string;
  onPage(page: number): void;
}

// 03-DESIGN 12.3
export function TablePager(props: TablePagerProps) {
  const { page, totalPages, label, navLabel, previousLabel, nextLabel, onPage } = props;
  return (
    <Box
      component="nav"
      aria-label={navLabel}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 1.5,
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      <Typography variant="bodyMedium">{label}</Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          disabled={page <= 1}
          onClick={() => {
            onPage(page - 1);
          }}
        >
          {previousLabel}
        </Button>
        <Button
          disabled={page >= totalPages}
          onClick={() => {
            onPage(page + 1);
          }}
        >
          {nextLabel}
        </Button>
      </Box>
    </Box>
  );
}
