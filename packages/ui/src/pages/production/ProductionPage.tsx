import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SalesHelpService } from '@nihal-ice-factory/shared-services';
import type { ResponsePayloadRecord } from '@nihal-ice-factory/shared-models';
import { Button, Card, PageHeader, PageLoader, useToast } from '../../components';
import { buildAuthConfig, logout } from '../../lib/auth';
import './styles/production.css';

interface PlanRow {
  deliveryDate: string;
  unit: string;
  iceTypeId: number;
  iceTypeName: string;
  bookedQty: number;
  orders: number;
  inStockNow: number;
  shortfall: number;
}

const dateLabel = (iso: string): string => {
  const today    = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  if (iso === today) return 'Today';
  if (iso === tomorrow) return 'Tomorrow';
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

/**
 * What to produce, and by when: upcoming advance bookings grouped by
 * delivery date vs what's sellable right now.
 */
const ProductionPage: React.FC = () => {
  const navigate = useNavigate();
  const toast    = useToast();
  const svc      = useMemo(() => new SalesHelpService(), []);

  const [rows, setRows]       = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await svc.getProductionPlan(buildAuthConfig());
      if (!res?.status) throw new Error(res?.internalMessage || 'Failed to load production plan');
      const env  = res.data as ResponsePayloadRecord | null;
      const data = (env?.['data'] ?? env) as PlanRow[] | null;
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      const e = err as { response?: { status?: number } };
      if (e?.response?.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }
      toast.error('Failed to load production plan');
    } finally {
      setLoading(false);
    }
  }, [svc, navigate, toast]);

  useEffect(() => { load(); }, [load]);

  /* New advance bookings show up without a manual refresh */
  useEffect(() => {
    const onNotify = () => load(true);
    window.addEventListener('nif:notification', onNotify);
    return () => window.removeEventListener('nif:notification', onNotify);
  }, [load]);

  const stats = useMemo(() => ({
    bookedUnits: rows.reduce((s, r) => s + r.bookedQty, 0),
    shortfallUnits: rows.reduce((s, r) => s + r.shortfall, 0),
    datesCovered: new Set(rows.map((r) => r.deliveryDate)).size,
  }), [rows]);

  /* Group rows by delivery date for sectioned rendering */
  const byDate = useMemo(() => {
    const map = new Map<string, PlanRow[]>();
    for (const r of rows) {
      const list = map.get(r.deliveryDate) ?? [];
      list.push(r);
      map.set(r.deliveryDate, list);
    }
    return [...map.entries()];
  }, [rows]);

  return (
    <div className="prod-page">
      <PageHeader
        title="Production Plan"
        subtitle="Upcoming advance bookings vs what's in stock right now"
        actions={<Button variant="secondary" onClick={() => load()}>Refresh</Button>}
      />

      {!loading && rows.length > 0 && (
        <div className="prod-stats">
          <div className="prod-stat">
            <span className="prod-stat__label">Booked Units</span>
            <span className="prod-stat__value">{stats.bookedUnits}</span>
          </div>
          <div className="prod-stat">
            <span className="prod-stat__label">To Produce (shortfall)</span>
            <span className={`prod-stat__value ${stats.shortfallUnits > 0 ? 'prod-stat__value--short' : 'prod-stat__value--ok'}`}>
              {stats.shortfallUnits}
            </span>
          </div>
          <div className="prod-stat">
            <span className="prod-stat__label">Delivery Dates</span>
            <span className="prod-stat__value">{stats.datesCovered}</span>
          </div>
        </div>
      )}

      <Card title="Upcoming Deliveries" padded={loading || rows.length === 0}>
        {loading ? (
          <PageLoader size="sm" label="Loading production plan" />
        ) : rows.length === 0 ? (
          <div className="prod-empty">
            <p className="prod-empty__title">No upcoming advance bookings</p>
            <p className="prod-empty__sub">When customers book ice for future dates, the production needs appear here.</p>
          </div>
        ) : (
          <div className="prod-sections">
            {byDate.map(([date, dateRows]) => {
              const dayShort = dateRows.reduce((s, r) => s + r.shortfall, 0);
              return (
                <div key={date} className="prod-day">
                  <div className="prod-day__head">
                    <span className="prod-day__date">{dateLabel(date)}</span>
                    <span className="prod-day__iso">{date}</span>
                    {dayShort > 0 ? (
                      <span className="prod-day__flag prod-day__flag--short">Produce {dayShort} more</span>
                    ) : (
                      <span className="prod-day__flag prod-day__flag--ok">Covered by stock</span>
                    )}
                  </div>
                  <table className="prod-table">
                    <thead>
                      <tr>
                        <th>Plant</th>
                        <th>Ice Type</th>
                        <th className="prod-table__num">Booked</th>
                        <th className="prod-table__num">In Stock Now</th>
                        <th className="prod-table__num">Shortfall</th>
                        <th className="prod-table__num">Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dateRows.map((r) => (
                        <tr key={`${r.unit}-${r.iceTypeId}`} className={r.shortfall > 0 ? 'prod-row--short' : ''}>
                          <td>{r.unit}</td>
                          <td className="prod-type">{r.iceTypeName}</td>
                          <td className="prod-table__num"><b>{r.bookedQty}</b></td>
                          <td className="prod-table__num">{r.inStockNow}</td>
                          <td className={`prod-table__num ${r.shortfall > 0 ? 'prod-short' : 'prod-ok'}`}>
                            {r.shortfall > 0 ? r.shortfall : '✓'}
                          </td>
                          <td className="prod-table__num">{r.orders}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
            <p className="prod-note">
              "In Stock Now" is today's sellable stock — it may be consumed by same-day orders before
              the delivery date. Create batches in <a href="/inventory">Inventory</a> to cover shortfalls.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ProductionPage;
