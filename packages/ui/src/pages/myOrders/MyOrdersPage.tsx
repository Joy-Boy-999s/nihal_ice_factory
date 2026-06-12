import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerHelpService } from '@nihal-ice-factory/shared-services';
import type { ResponsePayloadRecord } from '@nihal-ice-factory/shared-models';
import { Button, Card, PageHeader, PageLoader, useToast } from '../../components';
import { buildAuthConfig, logout } from '../../lib/auth';
import { formatCurrency } from '../../lib/pricing';
import './styles/my-orders.css';

/* ── Types ── */
type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'NOT_INITIATED';
type OrderFilter   = 'ALL' | 'PAID' | 'UNPAID';

interface OrderItem { iceTypeName: string; quantity: number; price: number; subtotal: number }

interface CustomerOrder {
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
  orderType?: 'NORMAL' | 'ADVANCE';
  deliveryDate?: string | null;
  payMode?: 'ONLINE' | 'COD' | null;
  fulfillmentStatus?: 'PENDING' | 'FULFILLED' | 'CANCELLED';
  paymentStatus: PaymentStatus;
  payment: { razorpayPaymentId?: string; razorpayOrderId?: string } | null;
}

/* ── Status badge ── */
const StatusBadge: React.FC<{ status: PaymentStatus }> = ({ status }) => {
  const map: Record<PaymentStatus, { cls: string; label: string }> = {
    PAID:          { cls: 'paid',          label: 'Paid'     },
    PENDING:       { cls: 'pending',       label: 'Pending'  },
    FAILED:        { cls: 'failed',        label: 'Failed'   },
    REFUNDED:      { cls: 'refunded',      label: 'Refunded' },
    NOT_INITIATED: { cls: 'not-initiated', label: 'Unpaid'   },
  };
  const { cls, label } = map[status] ?? { cls: 'not-initiated', label: status };
  return <span className={`order-status order-status--${cls}`}>{label}</span>;
};

/* ── Component ── */
const MyOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const toast    = useToast();
  const svc      = useMemo(() => new CustomerHelpService(), []);

  const [orders,  setOrders]  = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<OrderFilter>('ALL');
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const handleCancel = async (order: CustomerOrder) => {
    const refundNote = order.paymentStatus === 'PAID'
      ? ' Your payment will be refunded.'
      : '';
    if (!window.confirm(`Cancel order #${order.id}?${refundNote}`)) return;

    setCancellingId(order.id);
    try {
      const res = await svc.cancelOrder(order.id, buildAuthConfig());
      if (!res?.status) throw new Error(res?.internalMessage || 'Could not cancel order');
      const env  = res.data as ResponsePayloadRecord | null;
      const data = (env?.['data'] ?? env) as { paymentStatus?: PaymentStatus; refundId?: string | null } | null;

      setOrders((prev) => prev.map((o) => o.id === order.id
        ? { ...o, fulfillmentStatus: 'CANCELLED', paymentStatus: data?.paymentStatus ?? o.paymentStatus }
        : o,
      ));
      toast.success(data?.refundId ? 'Order cancelled — refund initiated' : 'Order cancelled');
    } catch (err) {
      if (!handleAuthError(err)) {
        toast.error(err instanceof Error ? err.message : 'Could not cancel order');
      }
    } finally {
      setCancellingId(null);
    }
  };

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await svc.getMyOrders(buildAuthConfig());
        if (cancelled) return;
        if (!res?.status) throw new Error(res?.internalMessage || 'Failed to load orders');

        const env  = res.data as ResponsePayloadRecord | null;
        const data = (env?.['data'] ?? env) as CustomerOrder[] | null;
        setOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        if (cancelled) return;
        if (!handleAuthError(err)) toast.error('Failed to load orders');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [svc, handleAuthError, toast]);

  /* Silent refetch when a notification arrives (order fulfilled / cancelled) */
  useEffect(() => {
    const onNotify = async () => {
      try {
        const res = await svc.getMyOrders(buildAuthConfig());
        if (!res?.status) return;
        const env  = res.data as ResponsePayloadRecord | null;
        const data = (env?.['data'] ?? env) as CustomerOrder[] | null;
        if (Array.isArray(data)) setOrders(data);
      } catch { /* background refresh — ignore failures */ }
    };
    window.addEventListener('nif:notification', onNotify);
    return () => window.removeEventListener('nif:notification', onNotify);
  }, [svc]);

  /* ── Derived stats + filtered list ── */
  const stats = useMemo(() => {
    const paid   = orders.filter((o) => o.paymentStatus === 'PAID');
    const unpaid = orders.length - paid.length;
    const spent  = paid.reduce((s, o) => s + Number(o.totalAmount), 0);
    return { total: orders.length, paid: paid.length, unpaid, spent };
  }, [orders]);

  const visibleOrders = useMemo(() => {
    if (filter === 'PAID')   return orders.filter((o) => o.paymentStatus === 'PAID');
    if (filter === 'UNPAID') return orders.filter((o) => o.paymentStatus !== 'PAID');
    return orders;
  }, [orders, filter]);

  const filterTabs: { key: OrderFilter; label: string; count: number }[] = [
    { key: 'ALL',    label: 'All',    count: stats.total  },
    { key: 'PAID',   label: 'Paid',   count: stats.paid   },
    { key: 'UNPAID', label: 'Unpaid', count: stats.unpaid },
  ];

  return (
    <div className="my-orders-page">
      <PageHeader
        title="My Orders"
        subtitle="Your ice order history with payment status"
        actions={
          <Button onClick={() => navigate('/shop')}>Place New Order</Button>
        }
      />

      {/* ── Stats row ── */}
      {!loading && orders.length > 0 && (
        <div className="mo-stats">
          <div className="mo-stat">
            <span className="mo-stat__label">Total Orders</span>
            <span className="mo-stat__value">{stats.total}</span>
          </div>
          <div className="mo-stat">
            <span className="mo-stat__label">Paid</span>
            <span className="mo-stat__value mo-stat__value--paid">{stats.paid}</span>
          </div>
          <div className="mo-stat">
            <span className="mo-stat__label">Unpaid</span>
            <span className="mo-stat__value mo-stat__value--unpaid">{stats.unpaid}</span>
          </div>
          <div className="mo-stat">
            <span className="mo-stat__label">Total Spent</span>
            <span className="mo-stat__value mo-stat__value--spent">{formatCurrency(stats.spent)}</span>
          </div>
        </div>
      )}

      <Card
        title="Orders"
        padded={loading || visibleOrders.length === 0}
        actions={
          !loading && orders.length > 0 ? (
            <div className="mo-filters" role="tablist" aria-label="Filter orders">
              {filterTabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === t.key}
                  className={`mo-filter${filter === t.key ? ' mo-filter--active' : ''}`}
                  onClick={() => setFilter(t.key)}
                >
                  {t.label} <i>{t.count}</i>
                </button>
              ))}
            </div>
          ) : undefined
        }
      >
        {loading ? (
          <PageLoader size="sm" label="Loading your orders" />
        ) : orders.length === 0 ? (
          <div className="my-orders-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <p className="my-orders-empty__title">No orders yet</p>
            <p className="my-orders-empty__sub">Place your first ice order and it'll appear here.</p>
            <Button size="sm" onClick={() => navigate('/shop')}>Shop Now</Button>
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="my-orders-empty">
            <p className="my-orders-empty__title">No {filter === 'PAID' ? 'paid' : 'unpaid'} orders</p>
            <p className="my-orders-empty__sub">Try a different filter.</p>
          </div>
        ) : (
          <div className="mo-grid">
            {visibleOrders.map((order) => {
              const activeItems = (order.items ?? []).filter((i) => i.quantity > 0);
              const isPaid      = order.paymentStatus === 'PAID';
              const isCancelled = order.fulfillmentStatus === 'CANCELLED';
              const canCancel   = order.fulfillmentStatus === 'PENDING';
              return (
                <div key={order.id} className="order-card">
                  <div className="order-card__header">
                    <div className="order-card__head-info">
                      <div className="order-card__id">
                        Order #{order.id}
                        {order.orderType === 'ADVANCE' && (
                          <span className="order-tag order-tag--advance">
                            Advance · {order.deliveryDate ?? '—'}
                          </span>
                        )}
                        {order.payMode === 'COD' && !isPaid && (
                          <span className="order-tag order-tag--cod">Pay on delivery</span>
                        )}
                      </div>
                      <div className="order-card__meta">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        {order.date} at {order.time}
                        <span className="order-card__meta-sep">·</span>
                        {order.unit}
                      </div>
                    </div>
                    <div className="order-card__badges">
                      <StatusBadge status={order.paymentStatus} />
                      {order.fulfillmentStatus === 'PENDING' && (
                        <span className="order-status order-status--preparing">Preparing</span>
                      )}
                      {order.fulfillmentStatus === 'FULFILLED' && (
                        <span className="order-status order-status--ready">Handed over</span>
                      )}
                      {order.fulfillmentStatus === 'CANCELLED' && (
                        <span className="order-status order-status--cancelled">Cancelled</span>
                      )}
                    </div>
                  </div>

                  {activeItems.length > 0 && (
                    <div className="order-card__items">
                      {activeItems.map((item, idx) => (
                        <span key={idx} className="order-card__item-chip">
                          {item.iceTypeName} <b>× {item.quantity}</b>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="order-card__footer">
                    <div className="order-card__amount-block">
                      <span className="order-card__amount-label">Total</span>
                      <span className="order-card__amount">{formatCurrency(Number(order.totalAmount))}</span>
                    </div>
                    <div className="order-card__actions">
                      {canCancel && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCancel(order)}
                          loading={cancellingId === order.id}
                          disabled={cancellingId !== null}
                        >
                          Cancel
                        </Button>
                      )}
                      {!isPaid && !isCancelled && (
                        <Button size="sm" onClick={() => navigate(`/payment/${order.id}`)}>
                          Pay Now
                        </Button>
                      )}
                      {isPaid && !isCancelled && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => navigate(`/invoice/${order.id}`, { state: { order } })}
                        >
                          Get Invoice
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
    </div>
  );
};

export default MyOrdersPage;
