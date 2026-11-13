import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { type MouseEvent, type ReactNode, useState } from 'react';
import { MoreIcon } from '../../design-system/icons';

export interface RowAction {
  readonly label: string;
  readonly icon: ReactNode;
  readonly danger?: boolean;
  run(): void;
}

export interface RowMenuProps {
  readonly label: string;
  readonly actions: readonly RowAction[];
}

// 03-DESIGN 10.10. A row may open on click, so pressing its menu must not count as that.
export function RowMenu({ label, actions }: RowMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const stop = (event: MouseEvent) => {
    event.stopPropagation();
  };
  return (
    <>
      <IconButton
        aria-label={label}
        aria-haspopup="menu"
        onClick={(event) => {
          stop(event);
          setAnchor(event.currentTarget);
        }}
      >
        <MoreIcon />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClick={stop}
        onClose={() => {
          setAnchor(null);
        }}
      >
        {actions.map((action) => (
          <MenuItem
            key={action.label}
            sx={action.danger === true ? { color: 'error.main' } : {}}
            onClick={() => {
              setAnchor(null);
              action.run();
            }}
          >
            <ListItemIcon sx={{ color: 'inherit' }}>{action.icon}</ListItemIcon>
            <ListItemText>{action.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
