import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useState } from 'react';
import { Link as RouterLink, NavLink, Outlet, useNavigate, useNavigation } from 'react-router';
import { LogoutIcon, MenuIcon, ProfileIcon, SearchIcon } from '../../design-system/icons';
import { IdleSessionContainer } from '../../features/auth/components/IdleSessionContainer';
import { PrivacyNoticeContainer } from '../../features/auth/components/PrivacyNoticeContainer';
import { useLogout } from '../../features/auth/hooks/useLogout';
import { OfflineNotice, StillWorkingNotice } from '../../shared/components/ActivityNotices';
import { common } from '../../shared/i18n/common.messages';
import { useCurrentUser } from '../../shared/stores/session.store';
import { useUiStore } from '../../shared/stores/ui.store';
import { messages } from '../messages';
import { navItemsFor } from '../navigation';

const RAIL_WIDTH = 80;

function NavItems({ vertical, onNavigate }: { readonly vertical: boolean; onNavigate?(): void }) {
  const { role } = useCurrentUser();
  return (
    <Box
      component="nav"
      aria-label={messages.mainNav}
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 0.5 }}
    >
      {navItemsFor(role).map((item) => (
        <Box
          key={item.to}
          component={NavLink}
          to={item.to}
          {...(item.end === true ? { end: true } : {})}
          {...(onNavigate ? { onClick: onNavigate } : {})}
          sx={{
            display: 'flex',
            flexDirection: vertical ? 'column' : 'row',
            alignItems: 'center',
            gap: vertical ? 0.5 : 2,
            minHeight: 56,
            px: vertical ? 0.5 : 2,
            py: 1,
            borderRadius: 3,
            textDecoration: 'none',
            textAlign: 'center',
            color: 'text.secondary',
            typography: 'labelMedium',
            '&.active': { bgcolor: 'md.secondaryContainer', color: 'md.onSecondaryContainer' },
            '&:hover': { bgcolor: 'action.hover' },
            '&:focus-visible': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: 2,
            },
          }}
        >
          {item.icon}
          {item.label}
        </Box>
      ))}
    </Box>
  );
}

function AccountMenu() {
  const { name } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => {
    setAnchor(null);
  };
  return (
    <>
      <IconButton
        aria-label={messages.account}
        aria-haspopup="menu"
        onClick={(event) => {
          setAnchor(event.currentTarget);
        }}
      >
        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14 }}>
          {name.slice(0, 1).toUpperCase()}
        </Avatar>
      </IconButton>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={close}>
        <MenuItem
          onClick={() => {
            close();
            void navigate('/settings/profile');
          }}
        >
          <ListItemIcon>
            <ProfileIcon />
          </ListItemIcon>
          {messages.profile}
        </MenuItem>
        <MenuItem
          onClick={() => {
            close();
            void logout();
          }}
        >
          <ListItemIcon>
            <LogoutIcon />
          </ListItemIcon>
          {messages.logout}
        </MenuItem>
      </Menu>
    </>
  );
}

// 03-DESIGN 10.2, 10.3, 11.1 and 17.2
export function AppShell() {
  const wide = useMediaQuery('(min-width:840px)');
  const drawerOpen = useUiStore((state) => state.drawerOpen);
  const setDrawerOpen = useUiStore((state) => state.setDrawerOpen);
  const loading = useNavigation().state === 'loading';
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'md.surface' }}>
      <Link
        href="#main"
        sx={{
          position: 'absolute',
          left: -9999,
          zIndex: 2000,
          p: 1,
          bgcolor: 'background.paper',
          '&:focus': { left: 8, top: 8 },
        }}
      >
        {common.skipToContent}
      </Link>
      <AppBar position="sticky" elevation={0} color="inherit" sx={{ bgcolor: 'md.surface' }}>
        <Toolbar sx={{ minHeight: 64, gap: 1 }}>
          {wide ? null : (
            <IconButton
              aria-label={messages.openMenu}
              edge="start"
              onClick={() => {
                setDrawerOpen(true);
              }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="titleLarge" component="p" sx={{ flexGrow: 1 }}>
            {messages.appTitle}
          </Typography>
          <IconButton component={RouterLink} to="/content/articles" aria-label={messages.search}>
            <SearchIcon />
          </IconButton>
          <AccountMenu />
        </Toolbar>
        {loading ? (
          <LinearProgress sx={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} />
        ) : null}
      </AppBar>
      <Box sx={{ display: 'flex' }}>
        {wide ? (
          <Box sx={{ width: RAIL_WIDTH, flexShrink: 0 }}>
            <NavItems vertical />
          </Box>
        ) : (
          <Drawer
            open={drawerOpen}
            onClose={() => {
              setDrawerOpen(false);
            }}
            slotProps={{ paper: { sx: { width: 360, maxWidth: '85%' } } }}
          >
            <NavItems
              vertical={false}
              onNavigate={() => {
                setDrawerOpen(false);
              }}
            />
          </Drawer>
        )}
        <Box
          component="main"
          id="main"
          tabIndex={-1}
          sx={{ flexGrow: 1, minWidth: 0, maxWidth: 1440, mx: 'auto', p: 3, outline: 'none' }}
        >
          <Outlet />
        </Box>
      </Box>
      <OfflineNotice />
      <StillWorkingNotice />
      <PrivacyNoticeContainer />
      <IdleSessionContainer />
    </Box>
  );
}
