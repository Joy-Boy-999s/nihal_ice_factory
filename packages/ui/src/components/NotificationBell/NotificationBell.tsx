import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationHelpService } from '@nihal-ice-factory/shared-services';
import type { AppNotification } from '@nihal-ice-factory/shared-services';
import type { ResponsePayloadRecord } from '@nihal-ice-factory/shared-models';
import { buildAuthConfig, getRole, getToken } from '../../lib/auth';
import { useToast } from '../Toast/Toast';
import { logger } from '../../lib/logger';
import './NotificationBell.css';

const MAX_VISIBLE = 30;

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const toast    = useToast();
  const svc      = useMemo(() => new NotificationHelpService(), []);

  const [items, setItems]       = useState<AppNotification[]>([]);
  const [unread, setUnread]     = useState(0);
  const [open, setOpen]         = useState(false);
  const panelRef                = useRef<HTMLDivElement | null>(null);
  const esRef                   = useRef<EventSource | null>(null);
  const retryRef                = useRef(0);

  /* ── Initial load ── */
  const load = useCallback(async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        svc.list(MAX_VISIBLE, buildAuthConfig()),
        svc.unreadCount(buildAuthConfig()),
      ]);
      const listEnv  = listRes?.data as ResponsePayloadRecord | null;
      const list     = (listEnv?.['data'] ?? listEnv) as AppNotification[] | null;
      if (Array.isArray(list)) setItems(list);

      const countEnv = countRes?.data as ResponsePayloadRecord | null;
      const count    = (countEnv?.['data'] ?? countEnv) as { count?: number } | null;
      if (typeof count?.count === 'number') setUnread(count.count);
    } catch {
      /* bell is non-critical */
    }
  }, [svc]);

  useEffect(() => { load(); }, [load]);

  /* ── SSE live stream with reconnect ── */
  useEffect(() => {
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const token = getToken();
      if (!token || stopped) return;

      const es = new EventSource(svc.getStreamUrl(token));
      esRef.current = es;

      es.addEventListener('notification', (e: MessageEvent) => {
        retryRef.current = 0;
        try {
          const n = JSON.parse(e.data) as AppNotification;
          if (!n?.id) return;
          setItems((prev) => [n, ...prev.filter((p) => p.id !== n.id)].slice(0, MAX_VISIBLE));
          setUnread((u) => u + 1);
          toast.info(n.title);
          // Let open pages (Orders / My Orders) refetch without a manual refresh
          window.dispatchEvent(new CustomEvent('nif:notification', { detail: n }));
        } catch { /* malformed event — ignore */ }
      });

      es.onerror = () => {
        es.close();
        if (stopped) return;
        const delay = Math.min(30_000, 2_000 * 2 ** retryRef.current++);
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      esRef.current?.close();
    };
  }, [svc, toast]);

  /* ── Close on outside click ── */
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleOpen = () => {
    setOpen((o) => !o);
    if (!open) load();
  };

  const handleMarkAll = async () => {
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try { await svc.markAllRead(buildAuthConfig()); } catch { /* refetch will correct */ }
  };

  const handleClickItem = async (n: AppNotification) => {
    setOpen(false);
    if (!n.isRead) {
      setUnread((u) => Math.max(0, u - 1));
      setItems((prev) => prev.map((p) => (p.id === n.id ? { ...p, isRead: true } : p)));
      svc.markRead(n.id, buildAuthConfig()).catch(() => logger.warn(`markRead failed for notification ${n.id}`));
    }
    // Staff jump to the Orders page; customers to their orders
    const isCustomer = getRole() === 'CUSTOMER';
    navigate(isCustomer ? '/my-orders' : '/orders');
  };

  return (
    <div className="notif-bell" ref={panelRef}>
      <button
        type="button"
        className="notif-bell__btn"
        onClick={handleOpen}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="notif-bell__badge">{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="notif-bell__panel" role="dialog" aria-label="Notifications">
          <div className="notif-bell__head">
            <span className="notif-bell__head-title">Notifications</span>
            {unread > 0 && (
              <button type="button" className="notif-bell__mark-all" onClick={handleMarkAll}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notif-bell__list">
            {items.length === 0 ? (
              <div className="notif-bell__empty">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ opacity: 0.35 }}>
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <p>No notifications yet</p>
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`notif-bell__item${n.isRead ? '' : ' notif-bell__item--unread'}`}
                  onClick={() => handleClickItem(n)}
                >
                  <span className="notif-bell__item-dot" aria-hidden />
                  <span className="notif-bell__item-body">
                    <span className="notif-bell__item-title">{n.title}</span>
                    <span className="notif-bell__item-text">{n.body}</span>
                    <span className="notif-bell__item-time">{relativeTime(n.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
