import React from 'react';
import {
  AddSaleIcon,
  ClipboardListIcon,
  DashboardIcon,
  FactoryIcon,
  PriceTagIcon,
  SalesIcon,
  ShoppingCartIcon,
  SnowflakeIcon,
  UsersIcon,
} from './nav-icons';

export interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  adminOnly?: boolean;
  customerOnly?: boolean;
  end?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  // ── Staff-facing ──────────────────────────────────────────────────────────
  {
    title: 'Operations',
    items: [
      { label: 'Sales',     to: '/',          icon: SalesIcon,      end: true },
      { label: 'Add Sale',  to: '/addsales',  icon: AddSaleIcon },
      { label: 'Orders',     to: '/orders',     icon: ClipboardListIcon },
      { label: 'Credit',     to: '/credit',     icon: PriceTagIcon },
      { label: 'Production', to: '/production', icon: FactoryIcon },
      { label: 'Inventory',  to: '/inventory',  icon: SnowflakeIcon },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: DashboardIcon, adminOnly: true },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Plant Master', to: '/plant-master',     icon: FactoryIcon,  adminOnly: true },
      { label: 'Price Master', to: '/ice-price-master', icon: PriceTagIcon, adminOnly: true },
      { label: 'Users',        to: '/user-management',  icon: UsersIcon,    adminOnly: true },
      { label: 'Audit Log',    to: '/audit',            icon: ClipboardListIcon, adminOnly: true },
    ],
  },

  // ── Customer-facing ───────────────────────────────────────────────────────
  {
    title: 'Shop',
    items: [
      { label: 'Order Ice', to: '/shop',      icon: ShoppingCartIcon, customerOnly: true },
      { label: 'My Orders', to: '/my-orders', icon: ClipboardListIcon, customerOnly: true },
    ],
  },
];
