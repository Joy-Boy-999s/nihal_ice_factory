import React from 'react';
import {
  AddSaleIcon,
  DashboardIcon,
  FactoryIcon,
  PriceTagIcon,
  SalesIcon,
} from './nav-icons';

export interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  adminOnly?: boolean;
  end?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Operations',
    items: [
      { label: 'Sales', to: '/', icon: SalesIcon, end: true },
      { label: 'Add Sale', to: '/addsales', icon: AddSaleIcon },
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
      { label: 'Plant Master', to: '/plant-master', icon: FactoryIcon, adminOnly: true },
      { label: 'Price Master', to: '/ice-price-master', icon: PriceTagIcon, adminOnly: true },
    ],
  },
];
