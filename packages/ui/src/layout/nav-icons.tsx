import React from 'react';

type IconProps = React.SVGProps<SVGSVGElement>;

const baseProps: IconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export const SalesIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M4 7h16l-1.5 11a2 2 0 0 1-2 1.75h-9A2 2 0 0 1 5.5 18L4 7Z" />
    <path d="M8 7V5a4 4 0 0 1 8 0v2" />
  </svg>
);

export const AddSaleIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const DashboardIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps} {...props}>
    <rect x="3" y="3" width="8" height="10" rx="1.5" />
    <rect x="13" y="3" width="8" height="6" rx="1.5" />
    <rect x="13" y="11" width="8" height="10" rx="1.5" />
    <rect x="3" y="15" width="8" height="6" rx="1.5" />
  </svg>
);

export const MenuIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const ChevronLeftIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M15 18 9 12l6-6" />
  </svg>
);

export const ChevronRightIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps} {...props}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export const ChevronDownIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps} {...props}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const LogoutIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M15 17v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" />
    <path d="M20 12H9m11 0-3-3m3 3-3 3" />
  </svg>
);

export const SnowflakeIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M12 2v20" />
    <path d="M4.2 6 19.8 18" />
    <path d="M19.8 6 4.2 18" />
    <path d="M2 12h20" />
  </svg>
);

export const UserIcon: React.FC<IconProps> = (props) => (
  <svg {...baseProps} {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);
