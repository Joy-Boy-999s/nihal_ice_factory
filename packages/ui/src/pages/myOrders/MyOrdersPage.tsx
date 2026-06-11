import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerHelpService } from '@nihal-ice-factory/shared-services';
import type { ResponsePayloadRecord } from '@nihal-ice-factory/shared-models';
import { Button, Card, PageHeader, useToast } from '../../components';
import { buildAuthConfig, logout } from '../../lib/auth';
import { formatCurrency } from '../../lib/pricing';
import './styles/my-orders.css';

/* ── Types ── */
type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'NOT_INITIATED';

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
  paymentStatus: PaymentStatus;
  payment: { razorpayPaymentId?: string; razorpayOrderId?: string } | null;
}

/* ── Status badge ── */
const StatusBadge: React.FC<{ status: PaymentStatus }> = ({ status }) => {
  const map: Record<PaymentStatus, { cls: string; label: string }> = {
    PAID:          { cls: 'paid',          label: 'Paid'        },
    PENDING:       { cls: 'pending',       label: 'Pending'     },
    FAILED:        { cls: 'failed',        label: 'Failed'      },
    NOT_INITIATED: { cls: 'not-initiated', label: 'Unpaid'      },
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

  return (
    <div className="my-orders-page">
      <PageHeader
        title="My Orders"
        subtitle="Your ice order history with payment status"
        actions={
          <Button onClick={() => navigate('/shop')}>Place New Order</Button>
        }
      />

      <Card title={`Orders (${orders.length})`} padded={loading || orders.length === 0}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
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
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.25rem 0' }}>
            {orders.map((order) => {
              const activeItems = (order.items ?? []).filter((i) => i.quantity > 0);
              const isPaid      = order.paymentStatus === 'PAID';
              const canPay      = !isPaid;
              return (
                <div key={order.id} className="order-card">
                  <div className="order-card__header">
                    <div>
                      <div className="order-card__id">Order #{order.id}</div>
                      <div className="order-card__meta">{order.date} at {order.time} &bull; {order.unit}</div>
                    </div>
                    <StatusBadge status={order.paymentStatus} />
                  </div>

                  {activeItems.length > 0 && (
                    <div className="order-card__items">
                      {activeItems.map((item, idx) => (
                        <span key={idx} className="order-card__item-chip">
                          {item.iceTypeName} × {item.quantity}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="order-card__footer">
                    <div className="order-card__amount">{formatCurrency(Number(order.totalAmount))}</div>
                    <div className="order-card__actions">
                      {canPay && (
                        <Button size="sm" onClick={() => navigate(`/payment/${order.id}`)}>
                          Pay Now
                        </Button>
                      )}
                      {isPaid && order.payment?.razorpayPaymentId && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          Ref: {order.payment.razorpayPaymentId.slice(-8)}
                        </span>
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
