import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuditHelpService } from '@nihal-ice-factory/shared-services';
import type { AuditEntry } from '@nihal-ice-factory/shared-services';
import type { ResponsePayloadRecord } from '@nihal-ice-factory/shared-models';
import { Button, Card, PageHeader, PageLoader, useToast } from '../../components';
import { buildAuthConfig, logout } from '../../lib/auth';
import './styles/audit.css';

const ACTION_LABELS: Record<string, string> = {
  USER_CREATED:    'User created',
  USER_DELETED:    'User deleted',
  ROLE_CHANGED:    'Role changed',
  SALE_UPDATED:    'Sale updated',
  SALE_DELETED:    'Sale deleted',
  SALES_DELETED:   'Sales deleted',
  CASH_RECORDED:   'Cash recorded',
  ORDER_CANCELLED: 'Order cancelled',
};

const actionClass = (action: string): string => {
  if (action.includes('DELET') || action.includes('CANCEL')) return 'audit-action--danger';
  if (action.includes('ROLE') || action.includes('CREATED')) return 'audit-action--warn';
  return 'audit-action--info';
};

const AuditPage: React.FC = () => {
  const navigate = useNavigate();
  const toast    = useToast();
  const svc      = useMemo(() => new AuditHelpService(), []);

  const [rows, setRows]       = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await svc.list(200, buildAuthConfig());
      if (!res?.status) throw new Error(res?.internalMessage || 'Failed to load audit log');
      const env  = res.data as ResponsePayloadRecord | null;
      const data = (env?.['data'] ?? env) as AuditEntry[] | null;
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      const e = err as { response?: { status?: number } };
      if (e?.response?.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }
      toast.error('Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [svc, navigate, toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="audit-page">
      <PageHeader
        title="Audit Log"
        subtitle="Who did what — sensitive actions across the system"
        actions={<Button variant="secondary" onClick={load}>Refresh</Button>}
      />

      <Card title={`Recent Actions (${rows.length})`} padded={loading || rows.length === 0}>
        {loading ? (
          <PageLoader size="sm" label="Loading audit log" />
        ) : rows.length === 0 ? (
          <div className="audit-empty">
            <p className="audit-empty__title">No audit entries yet</p>
            <p className="audit-empty__sub">Sensitive actions (user changes, deletions, cash collections, cancellations) will appear here.</p>
          </div>
        ) : (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="audit-when">{new Date(r.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                    <td className="audit-who">{r.username}</td>
                    <td>
                      <span className={`audit-action ${actionClass(r.action)}`}>
                        {ACTION_LABELS[r.action] ?? r.action}
                      </span>
                    </td>
                    <td className="audit-target">{r.entity}{r.entityId ? ` #${r.entityId}` : ''}</td>
                    <td className="audit-detail">{r.detail ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AuditPage;
