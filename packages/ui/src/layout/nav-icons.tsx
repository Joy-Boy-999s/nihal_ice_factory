/**
 * Premium icon library — precision-crafted SVG icons at 24×24
 * Stroke: 1.75 · Linecap: round · Linejoin: round
 */
import React from 'react';

type IconProps = React.SVGProps<SVGSVGElement>;

const base: IconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

// ─────────── Navigation / Layout ───────────

export const SnowflakeIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    {/* 6 main arms */}
    <line x1="12" y1="2" x2="12" y2="22" />
    <line x1="3.34" y1="7" x2="20.66" y2="17" />
    <line x1="20.66" y1="7" x2="3.34" y2="17" />
    {/* Branch ticks — vertical arm */}
    <polyline points="9.5,5.5 12,8 14.5,5.5" />
    <polyline points="9.5,18.5 12,16 14.5,18.5" />
    {/* Branch ticks — upper-right arm */}
    <polyline points="18,6.5 15.5,9 18.4,10.6" />
    {/* Branch ticks — upper-left arm */}
    <polyline points="6,6.5 8.5,9 5.6,10.6" />
    {/* Branch ticks — lower-right arm */}
    <polyline points="18,17.5 15.5,15 18.4,13.4" />
    {/* Branch ticks — lower-left arm */}
    <polyline points="6,17.5 8.5,15 5.6,13.4" />
  </svg>
);

export const DashboardIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    {/* Bento-grid analytics layout */}
    <rect x="3" y="3" width="8" height="10" rx="1.5" />
    <rect x="13" y="3" width="8" height="5" rx="1.5" />
    <rect x="13" y="11" width="8" height="10" rx="1.5" />
    <rect x="3" y="16" width="8" height="5" rx="1.5" />
  </svg>
);

export const SalesIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    {/* Premium shopping bag */}
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

export const AddSaleIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    {/* Circle + cross — premium add */}
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

export const MenuIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="14" y2="18" />
  </svg>
);

export const ChevronLeftIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

export const ChevronRightIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export const ChevronDownIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// ─────────── User / Auth ───────────

export const UserIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export const LogoutIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export const ShieldIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

export const MailIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

export const LockIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    <circle cx="12" cy="16" r="1" fill="currentColor" strokeWidth="0" />
  </svg>
);

// ─────────── Actions ───────────

export const PlusIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const SearchIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export const DownloadIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export const PrinterIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
    <line x1="9" y1="18" x2="15" y2="18" />
    <line x1="9" y1="21" x2="12" y2="21" />
  </svg>
);

export const EditIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
  </svg>
);

export const TrashIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

export const RefreshIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

export const FilterIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

// ─────────── Data / Analytics ───────────

export const TrendingUpIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

export const BarChartIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
    <line x1="2" y1="20" x2="22" y2="20" />
  </svg>
);

export const PackageIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <path d="m12.89 1.45 8 4A2 2 0 0 1 22 7.24v9.53a2 2 0 0 1-1.11 1.79l-8 4a2 2 0 0 1-1.79 0l-8-4A2 2 0 0 1 2 16.77V7.24a2 2 0 0 1 1.11-1.79l8-4a2 2 0 0 1 1.78 0Z" />
    <polyline points="2.32 6.16 12 11 21.68 6.16" />
    <line x1="12" y1="22.76" x2="12" y2="11" />
    <line x1="7" y1="3.5" x2="17" y2="8.5" />
  </svg>
);

export const IndianRupeeIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <path d="M6 3h12" />
    <path d="M6 8h12" />
    <path d="m6 13 8.5 8" />
    <path d="M6 13h3" />
    <path d="M9 13c6.667 0 6.667-10 0-10" />
  </svg>
);

export const CalendarIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="8" y1="14" x2="8" y2="14" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="12" y1="14" x2="12" y2="14" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export const ClockIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export const PhoneIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.41a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.57 2.68h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 10.36a16 16 0 0 0 6.29 5.85l.92-.92a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 17.92Z" />
  </svg>
);

export const BuildingIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" />
    <path d="M9 21V12h6v9" />
  </svg>
);

export const PersonIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="6" r="4" />
    <path d="M3 21v-1a7 7 0 0 1 7-7h4a7 7 0 0 1 7 7v1" />
  </svg>
);

export const StoreIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
    <path d="M2 7h20" />
    <path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" />
  </svg>
);

export const CheckCircleIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

export const AlertCircleIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2.5" />
  </svg>
);

export const InfoIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" strokeWidth="2.5" />
  </svg>
);

export const XIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const ArrowRightIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

export const SparklesIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
  </svg>
);

export const SunIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2"  x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="4.22" y1="4.22"  x2="6.34" y2="6.34" />
    <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
    <line x1="2"  y1="12" x2="5"  y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
    <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
    <line x1="17.66" y1="6.34"  x2="19.78" y2="4.22" />
  </svg>
);

export const MoonIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
  </svg>
);

// ─────────── Settings / Master ───────────

export const UsersIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    {/* Group / users icon */}
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const FactoryIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    {/* Factory building with chimney */}
    <path d="M2 20V9l6-4v4l6-4v4l4-2v13H2Z" />
    <line x1="2" y1="20" x2="22" y2="20" />
    {/* Chimney */}
    <rect x="16" y="7" width="2.5" height="6" rx="0.5" />
    {/* Windows */}
    <rect x="4"  y="13" width="3" height="3" rx="0.5" />
    <rect x="9"  y="13" width="3" height="3" rx="0.5" />
    {/* Door */}
    <rect x="14" y="15" width="3" height="5" rx="0.5" />
  </svg>
);

export const PriceTagIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}>
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
    <line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);
