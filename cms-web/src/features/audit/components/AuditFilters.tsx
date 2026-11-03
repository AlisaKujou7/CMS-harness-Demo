import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import type { UserRow } from '../../../shared/api/types';
import { auditActionLabels } from '../../../shared/audit/audit.messages';
import { auditPageMessages as m } from '../audit.messages';

export interface AuditFiltersProps {
  readonly params: URLSearchParams;
  readonly users: readonly UserRow[];
  onChange(name: string, value: string): void;
}

const ACTIONS = Object.keys(auditActionLabels).sort();
const TARGETS = Object.entries(m.targets);
const DATE_SLOT = { inputLabel: { shrink: true } };

// 03-DESIGN 12.7 and FR-AUDIT-05
export function AuditFilters({ params, users, onChange }: AuditFiltersProps) {
  const bind = (name: string) => ({
    size: 'small' as const,
    value: params.get(name) ?? '',
    onChange: (event: { target: { value: string } }) => {
      onChange(name, event.target.value);
    },
    sx: { minWidth: 160, flex: 1 },
  });
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
      <TextField select label={m.filterActor} {...bind('actor_id')}>
        <MenuItem value="">{m.anyone}</MenuItem>
        {users.map((user) => (
          <MenuItem key={user.id} value={user.id}>
            {user.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField select label={m.filterAction} {...bind('action')}>
        <MenuItem value="">{m.any}</MenuItem>
        {ACTIONS.map((action) => (
          <MenuItem key={action} value={action}>
            {action}
          </MenuItem>
        ))}
      </TextField>
      <TextField select label={m.filterTarget} {...bind('target_type')}>
        <MenuItem value="">{m.any}</MenuItem>
        {TARGETS.map(([value, label]) => (
          <MenuItem key={value} value={value}>
            {label}
          </MenuItem>
        ))}
      </TextField>
      <TextField type="date" label={m.filterFrom} slotProps={DATE_SLOT} {...bind('from')} />
      <TextField type="date" label={m.filterTo} slotProps={DATE_SLOT} {...bind('to')} />
    </Box>
  );
}
