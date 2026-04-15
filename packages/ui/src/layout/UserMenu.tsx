import React, { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon, LogoutIcon, UserIcon } from './nav-icons';

interface UserMenuProps {
  role: string;
  onLogout: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ role, onLogout }) => {
  const [open, setOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent): void => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initial = role.charAt(0).toUpperCase() || 'U';
  const displayName = role === 'ADMIN' ? 'Administrator' : 'Operator';

  return (
    <div className="app-shell__user-menu" ref={containerRef}>
      <button
        type="button"
        className={`app-shell__user-trigger ${open ? 'app-shell__user-trigger--open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="app-shell__user-avatar" aria-hidden>
          {initial}
        </span>
        <span className="app-shell__user-meta">
          <span className="app-shell__user-name">{displayName}</span>
          <span className="app-shell__user-role">{role}</span>
        </span>
        <ChevronDownIcon className="app-shell__user-chevron" />
      </button>

      {open && (
        <div className="app-shell__user-dropdown" role="menu">
          <div className="app-shell__user-dropdown-header">
            <span className="app-shell__user-avatar app-shell__user-avatar--lg" aria-hidden>
              {initial}
            </span>
            <div>
              <div className="app-shell__user-name">{displayName}</div>
              <div className="app-shell__user-role">{role}</div>
            </div>
          </div>
          <button
            type="button"
            className="app-shell__user-dropdown-item"
            role="menuitem"
            disabled
          >
            <UserIcon />
            <span>Profile</span>
          </button>
          <button
            type="button"
            className="app-shell__user-dropdown-item app-shell__user-dropdown-item--danger"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <LogoutIcon />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
};
