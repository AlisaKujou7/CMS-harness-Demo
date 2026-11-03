import type { ReactNode } from 'react';
import {
  ArticleIcon,
  AuditIcon,
  DashboardIcon,
  GroupIcon,
  KeyIcon,
  MediaIcon,
  SettingsIcon,
} from '../design-system/icons';
import type { UserRole } from '../shared/api/types';
import { messages } from './messages';

export interface NavItem {
  readonly label: string;
  readonly to: string;
  readonly icon: ReactNode;
  readonly adminOnly?: boolean;
  readonly end?: boolean;
}

// 03-DESIGN 10.3 and 11.2
const NAV_ITEMS: readonly NavItem[] = [
  { label: messages.nav.dashboard, to: '/', icon: <DashboardIcon />, end: true },
  { label: messages.nav.content, to: '/content', icon: <ArticleIcon /> },
  { label: messages.nav.media, to: '/media', icon: <MediaIcon /> },
  { label: messages.nav.users, to: '/users', icon: <GroupIcon />, adminOnly: true },
  { label: messages.nav.audit, to: '/audit', icon: <AuditIcon />, adminOnly: true },
  { label: messages.nav.apiKeys, to: '/api-keys', icon: <KeyIcon />, adminOnly: true },
  { label: messages.nav.settings, to: '/settings/profile', icon: <SettingsIcon /> },
];

export function navItemsFor(role: UserRole): readonly NavItem[] {
  return NAV_ITEMS.filter((item) => item.adminOnly !== true || role === 'admin');
}
