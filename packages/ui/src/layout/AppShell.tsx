import React, { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { logout, useAuth } from '../lib/auth';
import { ChevronLeftIcon, ChevronRightIcon, MenuIcon } from './nav-icons';
import { NAV_SECTIONS, type NavSection } from './nav-items';
import { UserMenu } from './UserMenu';
import { ThemeToggle } from '../components';
import { NotificationBell } from '../components/NotificationBell/NotificationBell';
import './AppShell.css';

const findPageTitle = (pathname: string, sections: NavSection[]): string => {
  for (const section of sections) {
    for (const item of section.items) {
      if (item.end ? pathname === item.to : pathname.startsWith(item.to) && item.to !== '/') {
        return item.label;
      }
    }
  }
  if (pathname === '/') return 'Sales';
  return 'Workspace';
};

export const AppShell: React.FC = () => {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const { role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = (): void => {
    logout();
    navigate('/login', { replace: true });
  };

  const visibleSections = useMemo<NavSection[]>(() => {
    const isCustomerRole = role === 'CUSTOMER';
    const isAdmin = role === 'ADMIN';
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (isCustomerRole) return !!item.customerOnly;
        if (isAdmin) return true; // admins see all nav items
        return !item.customerOnly && !item.adminOnly;
      }),
    })).filter((section) => section.items.length > 0);
  }, [role]);

  const pageTitle = useMemo(
    () => findPageTitle(location.pathname, visibleSections),
    [location.pathname, visibleSections],
  );

  const shellClasses = [
    'app-shell',
    collapsed ? 'app-shell--collapsed' : '',
    mobileOpen ? 'app-shell--mobile-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={shellClasses}>
      <aside className="app-shell__sidebar" aria-label="Primary navigation">
        <div className="app-shell__brand">
          <span className="app-shell__brand-icon" aria-hidden>
            <svg viewBox="0 0 64 64" width="36" height="36">
              <defs>
                <linearGradient id="nif-brand-bg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" />
                  <stop offset="55%" stopColor="#4338ca" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
                <linearGradient id="nif-brand-shine" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
                <g id="nif-brand-arm" strokeLinecap="round">
                  <line x1="32" y1="30" x2="32" y2="13" />
                  <line x1="32" y1="17.5" x2="27" y2="13" />
                  <line x1="32" y1="17.5" x2="37" y2="13" />
                  <line x1="32" y1="24" x2="27.8" y2="20" />
                  <line x1="32" y1="24" x2="36.2" y2="20" />
                </g>
              </defs>
              <rect width="64" height="64" rx="14" fill="url(#nif-brand-bg)" />
              <rect width="64" height="32" rx="14" fill="url(#nif-brand-shine)" />
              <g stroke="#ffffff" strokeWidth="3" fill="none">
                <use href="#nif-brand-arm" />
                <use href="#nif-brand-arm" transform="rotate(60 32 32)" />
                <use href="#nif-brand-arm" transform="rotate(120 32 32)" />
                <use href="#nif-brand-arm" transform="rotate(180 32 32)" />
                <use href="#nif-brand-arm" transform="rotate(240 32 32)" />
                <use href="#nif-brand-arm" transform="rotate(300 32 32)" />
              </g>
              <circle cx="32" cy="32" r="3.4" fill="#ffffff" />
            </svg>
          </span>
          {!collapsed && (
            <span className="app-shell__brand-name">
              Nihal Ice Factory
              <small className="app-shell__brand-tag">ERP Suite</small>
            </span>
          )}
        </div>

        <nav className="app-shell__nav">
          {visibleSections.map((section) => (
            <div key={section.title} className="app-shell__nav-section">
              {!collapsed && (
                <div className="app-shell__nav-section-title">{section.title}</div>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `app-shell__nav-link ${isActive ? 'app-shell__nav-link--active' : ''}`
                    }
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="app-shell__nav-icon">
                      <Icon />
                    </span>
                    {!collapsed && <span className="app-shell__nav-label">{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <button
          type="button"
          className="app-shell__collapse"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </button>
      </aside>

      {mobileOpen && (
        <div
          className="app-shell__overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <div className="app-shell__main">
        <header className="app-shell__topbar">
          <button
            type="button"
            className="app-shell__mobile-toggle"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <MenuIcon width={22} height={22} />
          </button>

          <div className="app-shell__topbar-text">
            <span className="app-shell__topbar-eyebrow">Workspace</span>
            <h1 className="app-shell__topbar-title">{pageTitle}</h1>
          </div>

          <div className="app-shell__topbar-right">
            <NotificationBell />
            <ThemeToggle />
            <UserMenu role={role} onLogout={handleLogout} />
          </div>
        </header>

        <main className="app-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
