import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { logout, useAuth } from '../lib/auth';
import './AppShell.css';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Sales', to: '/', icon: '🧾' },
  { label: 'Add Sale', to: '/addsales', icon: '➕' },
  { label: 'Dashboard', to: '/dashboard', icon: '📊', adminOnly: true },
];

export const AppShell: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { role } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || role === 'ADMIN'
  );

  return (
    <div
      className={`app-shell ${collapsed ? 'app-shell--collapsed' : ''} ${
        mobileOpen ? 'app-shell--mobile-open' : ''
      }`}
    >
      <aside className="app-shell__sidebar">
        <div className="app-shell__brand">
          <span className="app-shell__brand-icon">❄</span>
          {!collapsed && <span className="app-shell__brand-name">Ice Factory</span>}
        </div>
        <nav className="app-shell__nav">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `app-shell__nav-link ${isActive ? 'app-shell__nav-link--active' : ''}`
              }
              onClick={() => setMobileOpen(false)}
            >
              <span className="app-shell__nav-icon" aria-hidden>
                {item.icon}
              </span>
              {!collapsed && <span className="app-shell__nav-label">{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          className="app-shell__collapse"
          onClick={() => setCollapsed((c) => !c)}
          aria-label="Toggle sidebar"
        >
          {collapsed ? '›' : '‹'}
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
            aria-label="Open menu"
          >
            ☰
          </button>
          <div className="app-shell__topbar-title">KP Ice Factory ERP</div>
          <div className="app-shell__topbar-right">
            <div className="app-shell__user">
              <span className="app-shell__user-avatar">{role.charAt(0)}</span>
              <span className="app-shell__user-role">{role}</span>
            </div>
            <button
              type="button"
              className="app-shell__logout"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </header>
        <main className="app-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
