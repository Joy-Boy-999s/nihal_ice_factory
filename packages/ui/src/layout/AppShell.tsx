import React, { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { logout, useAuth } from '../lib/auth';
import { ChevronLeftIcon, ChevronRightIcon, MenuIcon, SnowflakeIcon } from './nav-icons';
import { NAV_SECTIONS, type NavSection } from './nav-items';
import { UserMenu } from './UserMenu';
import { ThemeToggle } from '../components';
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
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (isCustomerRole) return !!item.customerOnly;
        return !item.customerOnly && (!item.adminOnly || role === 'ADMIN');
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
            <SnowflakeIcon width={22} height={22} />
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
