import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UserHelpService } from '@nihal-ice-factory/shared-services';
import { ChevronDownIcon, LogoutIcon, UserIcon } from './nav-icons';
import { Button, Field, Input, Modal, useToast } from '../components';
import { buildAuthConfig } from '../lib/auth';

interface UserMenuProps {
  role: string;
  onLogout: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ role, onLogout }) => {
  const [open, setOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const toast = useToast();
  const userService = useMemo(() => new UserHelpService(), []);

  /* ── Change password modal ── */
  const [pwOpen, setPwOpen]     = useState(false);
  const [current, setCurrent]   = useState('');
  const [next, setNext]         = useState('');
  const [confirm, setConfirm]   = useState('');
  const [pwError, setPwError]   = useState('');
  const [saving, setSaving]     = useState(false);

  const closePwModal = () => {
    setPwOpen(false);
    setCurrent(''); setNext(''); setConfirm(''); setPwError('');
  };

  const handleChangePassword = async () => {
    setPwError('');
    if (!current) { setPwError('Enter your current password'); return; }
    if (next.length < 8) { setPwError('New password must be at least 8 characters'); return; }
    if (next !== confirm) { setPwError('New passwords do not match'); return; }

    setSaving(true);
    try {
      const res = await userService.changePassword(current, next, buildAuthConfig());
      if (!res?.status) throw new Error(res?.internalMessage || 'Could not change password');
      toast.success('Password changed');
      closePwModal();
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Could not change password');
    } finally {
      setSaving(false);
    }
  };

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
  const displayName =
    role === 'ADMIN' ? 'Administrator' : role === 'CUSTOMER' ? 'Customer' : 'Operator';

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
              <div className="app-shell__user-dropdown-fullname">{displayName}</div>
              <div className="app-shell__user-dropdown-role">{role}</div>
            </div>
          </div>
          <button
            type="button"
            className="app-shell__user-dropdown-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setPwOpen(true);
            }}
          >
            <UserIcon />
            <span>Change password</span>
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

      <Modal
        open={pwOpen}
        size="sm"
        title="Change Password"
        onClose={closePwModal}
        footer={
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', width: '100%' }}>
            <Button variant="secondary" onClick={closePwModal} disabled={saving}>Cancel</Button>
            <Button onClick={handleChangePassword} loading={saving}>Update Password</Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Field label="Current Password" required>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </Field>
          <Field label="New Password" required hint="At least 8 characters">
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Confirm New Password" required>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </Field>
          {pwError && (
            <p style={{ margin: 0, color: 'var(--color-error, #dc2626)', fontSize: '0.85rem' }}>{pwError}</p>
          )}
        </div>
      </Modal>
    </div>
  );
};
