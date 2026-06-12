import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { CustomerHelpService } from '@nihal-ice-factory/shared-services';
import type { ResponsePayloadRecord } from '@nihal-ice-factory/shared-models';
import { Button, PageHeader, PageLoader, useToast } from '../../components';
import { buildAuthConfig, logout } from '../../lib/auth';
import { formatCurrency } from '../../lib/pricing';
import { COMPANY, gstBreakupFromInclusive } from '../../lib/company';
import './styles/invoice.css';

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
  discount?: number;
  totalAmount: number;
  paymentStatus: string;
  payment: { razorpayPaymentId?: string; razorpayOrderId?: string; amount?: number; createdAt?: string } | null;
}

const InvoicePage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const location    = useLocation();
  const navigate    = useNavigate();
  const toast       = useToast();
  const svc         = useMemo(() => new CustomerHelpService(), []);

  const [order, setOrder]   = useState<CustomerOrder | null>(
    (location.state as { order?: CustomerOrder } | null)?.order ?? null,
  );
  const [loading, setLoading] = useState(!order);

  useEffect(() => {
    if (order) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await svc.getMyOrders(buildAuthConfig());
        if (cancelled) return;
        if (!res?.status) throw new Error(res?.internalMessage || 'Failed to load order');
        const env  = res.data as ResponsePayloadRecord | null;
        const data = (env?.['data'] ?? env) as CustomerOrder[] | null;
        const found = Array.isArray(data) ? data.find((o) => String(o.id) === orderId) : null;
        if (!found) throw new Error('Order not found');
        setOrder(found);
      } catch (err) {
        if (cancelled) return;
        const e = err as { response?: { status?: number }; message?: string };
        if (e?.response?.status === 401) { logout(); navigate('/login', { replace: true }); return; }
        toast.error(e.message || 'Failed to load invoice');
        navigate(-1);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePrint = () => window.print();

  if (loading) return <PageLoader label="Loading invoice" />;
  if (!order) return null;

  const activeItems = (order.items ?? []).filter((i) => i.quantity > 0);
  const discount    = Number(order.discount ?? 0);
  const subtotal    = activeItems.reduce((s, i) => s + Number(i.subtotal), 0);
  const total       = Number(order.totalAmount);
  const isPaid      = order.paymentStatus === 'PAID';
  // Prices are GST-inclusive — derive the statutory breakup from the total
  const gst         = COMPANY.gstin ? gstBreakupFromInclusive(total) : null;

  return (
    <div className="inv-page">
      {/* Screen-only controls */}
      <div className="inv-controls no-print">
        <PageHeader
          title={`Invoice — Order #${order.id}`}
          subtitle={isPaid ? 'Payment confirmed' : 'Payment pending'}
          actions={
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Button variant="secondary" onClick={() => navigate(-1)}>← Back</Button>
              <Button onClick={handlePrint}>Print / Save PDF</Button>
            </div>
          }
        />
      </div>

      {/* Invoice document */}
      <div className="inv-doc">
        {/* Header */}
        <div className="inv-header">
          <div className="inv-header__brand">
            <div className="inv-header__logo">❄</div>
            <div>
              <div className="inv-header__company">{COMPANY.name}</div>
              <div className="inv-header__tagline">{COMPANY.tagline}</div>
              {COMPANY.address && <div className="inv-header__seller">{COMPANY.address}</div>}
              {COMPANY.gstin && <div className="inv-header__seller">GSTIN: {COMPANY.gstin}</div>}
            </div>
          </div>
          <div className="inv-header__meta">
            <div className="inv-header__title">
              {isPaid ? 'TAX INVOICE' : 'INVOICE'}
            </div>
            <div className="inv-header__detail">Invoice No: INV-{String(order.id).padStart(5, '0')}</div>
            <div className="inv-header__detail">Order #{order.id}</div>
            <div className="inv-header__detail">{order.date} at {order.time}</div>
            <div className="inv-header__detail">Plant: {order.unit}</div>
          </div>
        </div>

        <div className="inv-divider" />

        {/* Bill To */}
        <div className="inv-bill">
          <div className="inv-bill__label">Bill To</div>
          <div className="inv-bill__name">{order.name}</div>
          <div className="inv-bill__info">{order.mobile}</div>
          <div className="inv-bill__info">{order.shop}</div>
        </div>

        {/* Items table */}
        <table className="inv-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              {COMPANY.gstin && <th>HSN</th>}
              <th className="inv-table__right">Qty</th>
              <th className="inv-table__right">Unit Price</th>
              <th className="inv-table__right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {activeItems.map((item, idx) => (
              <tr key={idx}>
                <td className="inv-table__idx">{idx + 1}</td>
                <td>{item.iceTypeName}</td>
                {COMPANY.gstin && <td>{COMPANY.hsnCode}</td>}
                <td className="inv-table__right">{item.quantity}</td>
                <td className="inv-table__right">{formatCurrency(Number(item.price))}</td>
                <td className="inv-table__right">{formatCurrency(Number(item.subtotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="inv-totals">
          <div className="inv-totals__row">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="inv-totals__row inv-totals__row--discount">
              <span>Discount</span>
              <span>−{formatCurrency(discount)}</span>
            </div>
          )}
          {gst && (
            <>
              <div className="inv-totals__row inv-totals__row--tax">
                <span>Taxable Value</span>
                <span>{formatCurrency(gst.taxableValue)}</span>
              </div>
              <div className="inv-totals__row inv-totals__row--tax">
                <span>CGST @ {gst.ratePercent / 2}%</span>
                <span>{formatCurrency(gst.cgst)}</span>
              </div>
              <div className="inv-totals__row inv-totals__row--tax">
                <span>SGST @ {gst.ratePercent / 2}%</span>
                <span>{formatCurrency(gst.sgst)}</span>
              </div>
            </>
          )}
          <div className="inv-totals__row inv-totals__row--total">
            <span>Total{gst ? ' (incl. GST)' : ''}</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Payment info */}
        <div className="inv-divider" />
        <div className="inv-payment">
          <div className="inv-payment__status-row">
            <span className="inv-payment__label">Payment Status</span>
            <span className={`inv-payment__badge inv-payment__badge--${order.paymentStatus.toLowerCase()}`}>
              {isPaid ? 'PAID' : order.paymentStatus}
            </span>
          </div>
          {isPaid && order.payment?.razorpayPaymentId && (
            <div className="inv-payment__ref">
              <span className="inv-payment__label">Transaction Ref</span>
              <span className="inv-payment__value">{order.payment.razorpayPaymentId}</span>
            </div>
          )}
          {isPaid && order.payment?.razorpayOrderId && (
            <div className="inv-payment__ref">
              <span className="inv-payment__label">Order Ref</span>
              <span className="inv-payment__value">{order.payment.razorpayOrderId}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="inv-footer">
          {COMPANY.gstin && <p className="inv-footer__legal">This is a computer-generated invoice. Prices are inclusive of GST.</p>}
          <p>Thank you for your order! For queries contact us at your nearest Nihal Ice Factory outlet.</p>
          <p className="inv-footer__generated">Generated on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>
    </div>
  );
};

export default InvoicePage;
