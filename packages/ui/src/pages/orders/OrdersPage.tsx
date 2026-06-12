import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SalesHelpService } from '@nihal-ice-factory/shared-services';
import type { ResponsePayloadRecord } from '@nihal-ice-factory/shared-models';
import { Button, Card, PageHeader, PageLoader, useToast } from '../../components';
import { buildAuthConfig, logout } from '../../lib/auth';
import { formatCurrency } from '../../lib/pricing';
import { FulfillModal } from './components/FulfillModal';
import './styles/orders.css';

/* ── Types ── */
export type PaymentStatus     = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'NOT_INITIATED';
export type FulfillmentStatus = 'PENDING' | 'FULFILLED' | 'CANCELLED';

export interface OrderItem { iceTypeId: number; iceTypeName: string; quantity: number; price: number; subtotal: number }

export interface CustomerOrder {
  id: number;
  date: string;
  time: string;
  unit: string;
  name: string;
  mobile: string;
  shop: string;
  items: OrderItem[];
  totalUnits: number;
  totalAmount: number;
  orderType: 'NORMAL' | 'ADVANCE';
  deliveryDate: string | null;
  payMode: 'ONLINE' | 'COD' | null;
  fulfillmentStatus: FulfillmentStatus;
  fulfilledBy: string | null;
  fulfilledAt: string | null;
  paymentStatus: PaymentStatus;
  payment: { razorpayPaymentId?: string } | null;
}

type OrderFilter = 'ALL' | 'PENDING' | 'ADVANCE' | 'FULFILLED';

/* ── Badges ── */
const PayBadge: React.FC<{ order: CustomerOrder }> = ({ order }) => {
  if (order.paymentStatus === 'REFUNDED') return <span className="op-badge op-badge--refunded">Refunded</span>;
  if (order.paymentStatus === 'PAID') return <span className="op-badge op-badge--paid">Paid</span>;
  if (order.fulfillmentStatus === 'CANCELLED') return <span className="op-badge op-badge--cancelled">—</span>;
  if (order.payMode === 'COD')        return <span className="op-badge op-badge--cod">COD — collect payment</span>;
  if (order.paymentStatus === 'FAILED') return <span className="op-badge op-badge--failed">Payment failed</span>;
  return <span className="op-badge op-badge--unpaid">Unpaid</span>;
};

const FulfillBadge: React.FC<{ status: FulfillmentStatus }> = ({ status }) => {
  const map: Record<FulfillmentStatus, { cls: string; label: string }> = {
    PENDING:   { cls: 'pending',   label: 'Awaiting fulfillment' },
    FULFILLED: { cls: 'fulfilled', label: 'Fulfilled' },
    CANCELLED: { cls: 'cancelled', label: 'Cancelled' },
  };
  const { cls, label } = map[status] ?? map.PENDING;
  return <span className={`op-badge op-badge--${cls}`}>{label}</span>;
};

/* ── Component ── */
const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const toast    = useToast();
  const svc      = useMemo(() => new SalesHelpService(), []);

  const [orders, setOrders]     = useState<CustomerOrder[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<OrderFilter>('ALL');
  const [fulfilling, setFulfilling] = useState<CustomerOrder | null>(null);

  const handleAuthError = useCallback((err: unknown): boolean => {
    const e = err as { response?: { status?: number } };
    if (e?.response?.status === 401) {
      logout();
      toast.error('Session expired. Please sign in again.');
      navigate('/login', { replace: true });
      return true;
    }
    return false;
  }, [navigate, toast]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await svc.getCustomerOrders(buildAuthConfig());
      if (!res?.status) throw new Error(res?.internalMessage || 'Failed to load orders');
      const env  = res.data as ResponsePayloadRecord | null;
      const data = (env?.['data'] ?? env) as CustomerOrder[] | null;
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      if (!handleAuthError(err)) toast.error('Failed to load customer orders');
    } finally {
      setLoading(false);
    }
  }, [svc, handleAuthError, toast]);

  useEffect(() => { load(); }, [load]);

  /* Refetch silently when a notification arrives (new order, payment, cancel) */
  useEffect(() => {
    const onNotify = () => load(true);
    window.addEventListener('nif:notification', onNotify);
    return () => window.removeEventListener('nif:notification', onNotify);
  }, [load]);

  /* ── Stats + filters ── */
  const today = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => ({
    pending:   orders.filter((o) => o.fulfillmentStatus === 'PENDING').length,
    advance:   orders.filter((o) => o.orderType === 'ADVANCE' && o.fulfillmentStatus === 'PENDING').length,
    unpaidCod: orders.filter((o) => o.payMode === 'COD' && o.paymentStatus !== 'PAID' && o.fulfillmentStatus !== 'CANCELLED').length,
    fulfilledToday: orders.filter((o) => o.fulfilledAt && String(o.fulfilledAt).slice(0, 10) === today).length,
  }), [orders, today]);

  const visible = useMemo(() => {
    switch (filter) {
      case 'PENDING':   return orders.filter((o) => o.fulfillmentStatus === 'PENDING');
      case 'ADVANCE':   return orders.filter((o) => o.orderType === 'ADVANCE');
      case 'FULFILLED': return orders.filter((o) => o.fulfillmentStatus === 'FULFILLED');
      default:          return orders;
    }
  }, [orders, filter]);

  const filterTabs: { key: OrderFilter; label: string }[] = [
    { key: 'ALL',       label: `All (${orders.length})` },
    { key: 'PENDING',   label: `Pending (${stats.pending})` },
    { key: 'ADVANCE',   label: 'Advance' },
    { key: 'FULFILLED', label: 'Fulfilled' },
  ];

  return (
    <div className="op-page">
      <PageHeader
        title="Customer Orders"
        subtitle="Orders placed by customers for your plants — fulfill them from inventory slots"
        actions={<Button variant="secondary" onClick={() => load()}>Refresh</Button>}
      />

      {!loading && orders.length > 0 && (
        <div className="op-stats">
          <div className="op-stat">
            <span className="op-stat__label">Awaiting Fulfillment</span>
            <span className="op-stat__value op-stat__value--pending">{stats.pending}</span>
          </div>
          <div className="op-stat">
            <span className="op-stat__label">Advance Bookings</span>
            <span className="op-stat__value op-stat__value--advance">{stats.advance}</span>
          </div>
          <div className="op-stat">
            <span className="op-stat__label">COD to Collect</span>
            <span className="op-stat__value op-stat__value--cod">{stats.unpaidCod}</span>
          </div>
          <div className="op-stat">
            <span className="op-stat__label">Fulfilled Today</span>
            <span className="op-stat__value op-stat__value--done">{stats.fulfilledToday}</span>
          </div>
        </div>
      )}

      <Card
        title="Orders"
        padded={loading || visible.length === 0}
        actions={
          !loading && orders.length > 0 ? (
            <div className="op-filters" role="tablist" aria-label="Filter orders">
              {filterTabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === t.key}
                  className={`op-filter${filter === t.key ? ' op-filter--active' : ''}`}
                  onClick={() => setFilter(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          ) : undefined
        }
      >
        {loading ? (
          <PageLoader size="sm" label="Loading customer orders" />
        ) : visible.length === 0 ? (
          <div className="op-empty">
            <p className="op-empty__title">
              {orders.length === 0 ? 'No customer orders yet' : 'Nothing matches this filter'}
            </p>
            <p className="op-empty__sub">
              {orders.length === 0
                ? 'When customers order ice for your plants, the orders appear here.'
                : 'Try a different filter.'}
            </p>
          </div>
        ) : (
          <div className="op-grid">
            {visible.map((order) => {
              const activeItems = (order.items ?? []).filter((i) => i.quantity > 0);
              const isAdvance   = order.orderType === 'ADVANCE';
              const canFulfill  = order.fulfillmentStatus === 'PENDING';
              return (
                <div key={order.id} className={`op-card${canFulfill ? ' op-card--pending' : ''}`}>
                  <div className="op-card__header">
                    <div className="op-card__head-info">
                      <div className="op-card__id">
                        Order #{order.id}
                        {isAdvance && (
                          <span className="op-badge op-badge--advance">
                            Advance · {order.deliveryDate ?? '—'}
                          </span>
                        )}
                      </div>
                      <div className="op-card__meta">
                        {order.date} at {order.time} · {order.unit}
                      </div>
                    </div>
                    <FulfillBadge status={order.fulfillmentStatus} />
                  </div>

                  <div className="op-card__customer">
                    <span className="op-card__customer-name">{order.name}</span>
                    <span className="op-card__customer-info">{order.mobile} · {order.shop}</span>
                  </div>

                  {activeItems.length > 0 && (
                    <div className="op-card__items">
                      {activeItems.map((item, idx) => (
                        <span key={idx} className="op-card__chip">
                          {item.iceTypeName} <b>× {item.quantity}</b>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="op-card__footer">
                    <div className="op-card__amount-block">
                      <span className="op-card__amount">{formatCurrency(Number(order.totalAmount))}</span>
                      <PayBadge order={order} />
                    </div>
                    <div className="op-card__actions">
                      {order.fulfillmentStatus === 'FULFILLED' && order.fulfilledBy && (
                        <span className="op-card__fulfilled-by">by {order.fulfilledBy}</span>
                      )}
                      {canFulfill && (
                        <Button size="sm" onClick={() => setFulfilling(order)}>
                          Fulfill
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {fulfilling && (
        <FulfillModal
          order={fulfilling}
          onClose={() => setFulfilling(null)}
          onFulfilled={() => {
            setFulfilling(null);
            load(true);
          }}
        />
      )}
    </div>
  );
};

export default OrdersPage;
