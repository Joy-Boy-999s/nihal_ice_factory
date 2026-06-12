import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SalesHelpService } from '@nihal-ice-factory/shared-services';
import type { ResponsePayloadRecord } from '@nihal-ice-factory/shared-models';
import { Button, Card, PageHeader, PageLoader, useToast } from '../../components';
import { buildAuthConfig, logout } from '../../lib/auth';
import { formatCurrency } from '../../lib/pricing';
import './styles/credit.css';

interface CreditRow {
  customerId: string;
  name: string;
  mobile: string;
  orders: number;
  unpaidOrders: number;
  billed: number;
  paid: number;
  outstanding: number;
  oldestUnpaidDate: string | null;
}

/**
 * Khata view: who owes what across the operator's plants. Collection happens
 * on the Orders page (Mark Paid) — this is the bird's-eye balance sheet.
 */
const CreditPage: React.FC = () => {
  const navigate = useNavigate();
  const toast    = useToast();
  const svc      = useMemo(() => new SalesHelpService(), []);

  const [rows, setRows]       = useState<CreditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery]     = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await svc.getCreditSummary(buildAuthConfig());
      if (!res?.status) throw new Error(res?.internalMessage || 'Failed to load credit summary');
      const env  = res.data as ResponsePayloadRecord | null;
      const data = (env?.['data'] ?? env) as CreditRow[] | null;
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      const e = err as { response?: { status?: number } };
      if (e?.response?.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }
      toast.error('Failed to load credit summary');
    } finally {
      setLoading(false);
    }
  }, [svc, navigate, toast]);

  useEffect(() => { load(); }, [load]);

  /* Refresh when payments land (Mark Paid fires a notification to customers,
     but operator actions update via this page's own refresh button too) */
  useEffect(() => {
    const onNotify = () => load(true);
    window.addEventListener('nif:notification', onNotify);
    return () => window.removeEventListener('nif:notification', onNotify);
  }, [load]);

  const totals = useMemo(() => ({
    outstanding: rows.reduce((s, r) => s + r.outstanding, 0),
    customersWithDues: rows.filter((r) => r.outstanding > 0).length,
    billed: rows.reduce((s, r) => s + r.billed, 0),
    collected: rows.reduce((s, r) => s + r.paid, 0),
  }), [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.mobile.includes(q))
      : rows;
    return filtered;
  }, [rows, query]);

  return (
    <div className="credit-page">
      <PageHeader
        title="Credit / Khata"
        subtitle="Outstanding balances per customer across your plants"
        actions={<Button variant="secondary" onClick={() => load()}>Refresh</Button>}
      />

      {!loading && rows.length > 0 && (
        <div className="credit-stats">
          <div className="credit-stat">
            <span className="credit-stat__label">Total Outstanding</span>
            <span className="credit-stat__value credit-stat__value--due">{formatCurrency(totals.outstanding)}</span>
          </div>
          <div className="credit-stat">
            <span className="credit-stat__label">Customers with Dues</span>
            <span className="credit-stat__value">{totals.customersWithDues}</span>
          </div>
          <div className="credit-stat">
            <span className="credit-stat__label">Total Billed</span>
            <span className="credit-stat__value">{formatCurrency(totals.billed)}</span>
          </div>
          <div className="credit-stat">
            <span className="credit-stat__label">Collected</span>
            <span className="credit-stat__value credit-stat__value--paid">{formatCurrency(totals.collected)}</span>
          </div>
        </div>
      )}

      <Card
        title="Customers"
        padded={loading || visible.length === 0}
        actions={
          rows.length > 0 ? (
            <input
              className="credit-search"
              placeholder="Search name or mobile…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          ) : undefined
        }
      >
        {loading ? (
          <PageLoader size="sm" label="Loading credit summary" />
        ) : visible.length === 0 ? (
          <div className="credit-empty">
            <p className="credit-empty__title">
              {rows.length === 0 ? 'No customer orders yet' : 'No customers match your search'}
            </p>
            <p className="credit-empty__sub">
              {rows.length === 0
                ? 'Balances appear here once customers start ordering.'
                : 'Try a different name or mobile number.'}
            </p>
          </div>
        ) : (
          <div className="credit-table-wrap">
            <table className="credit-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="credit-table__num">Orders</th>
                  <th className="credit-table__num">Unpaid</th>
                  <th className="credit-table__num">Billed</th>
                  <th className="credit-table__num">Paid</th>
                  <th className="credit-table__num">Outstanding</th>
                  <th>Oldest Due</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.customerId} className={r.outstanding > 0 ? 'credit-row--due' : ''}>
                    <td>
                      <div className="credit-cust">
                        <span className="credit-cust__name">{r.name}</span>
                        <span className="credit-cust__mobile">{r.mobile}</span>
                      </div>
                    </td>
                    <td className="credit-table__num">{r.orders}</td>
                    <td className="credit-table__num">{r.unpaidOrders > 0 ? r.unpaidOrders : '—'}</td>
                    <td className="credit-table__num">{formatCurrency(r.billed)}</td>
                    <td className="credit-table__num credit-amount--paid">{formatCurrency(r.paid)}</td>
                    <td className={`credit-table__num ${r.outstanding > 0 ? 'credit-amount--due' : ''}`}>
                      {r.outstanding > 0 ? formatCurrency(r.outstanding) : '—'}
                    </td>
                    <td>{r.oldestUnpaidDate ?? '—'}</td>
                    <td>
                      {r.unpaidOrders > 0 && (
                        <Button size="sm" variant="ghost" onClick={() => navigate('/orders')}>
                          Collect →
                        </Button>
                      )}
                    </td>
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

export default CreditPage;
