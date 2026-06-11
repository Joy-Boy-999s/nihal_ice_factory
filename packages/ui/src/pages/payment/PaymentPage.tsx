import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PaymentHelpService, SalesHelpService } from '@nihal-ice-factory/shared-services';
import type { CreateOrderResponse, PaymentRecord, PaymentStatus, ResponsePayloadRecord } from '@nihal-ice-factory/shared-models';
import { Button, Card, PageHeader, PageLoader, useToast } from '../../components';
import { buildAuthConfig, logout } from '../../lib/auth';
import { formatCurrency } from '../../lib/pricing';
import './styles/payment.css';

/* ── Razorpay window type ── */
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

/* ── Local types ── */
interface SaleInfo {
  id: number;
  name: string;
  mobile: string;
  shop: string;
  unit: string;
  totalAmount: number;
  date: string;
  time: string;
}

type PageStatus = 'loading' | 'ready' | 'processing' | 'paid' | 'failed' | 'error';

const RAZORPAY_CDN = 'https://checkout.razorpay.com/v1/checkout.js';

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('razorpay-cdn')) { resolve(); return; }
    const script = document.createElement('script');
    script.id   = 'razorpay-cdn';
    script.src  = RAZORPAY_CDN;
    script.onload  = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout script'));
    document.head.appendChild(script);
  });
}

/* ── Component ── */
const PaymentPage: React.FC = () => {
  const navigate      = useNavigate();
  const toast         = useToast();
  const { saleId }    = useParams<{ saleId: string }>();
  const saleIdNum     = Number(saleId);

  const paymentService = useMemo(() => new PaymentHelpService(), []);
  const salesService   = useMemo(() => new SalesHelpService(), []);

  const [pageStatus,  setPageStatus]  = useState<PageStatus>('loading');
  const [sale,        setSale]        = useState<SaleInfo | null>(null);
  const [paymentRec,  setPaymentRec]  = useState<(PaymentRecord & { status: PaymentStatus }) | null>(null);
  const [errorMsg,    setErrorMsg]    = useState('');

  const authConfig = buildAuthConfig();
  const abortedRef = useRef(false);

  /* ── Auth helper ── */
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

  /* ── Load sale info + payment status on mount ── */
  useEffect(() => {
    abortedRef.current = false;

    const load = async () => {
      if (!saleIdNum || isNaN(saleIdNum)) {
        setErrorMsg('Invalid sale ID.');
        setPageStatus('error');
        return;
      }
      try {
        const [saleRes, statusRes] = await Promise.all([
          salesService.getPrintData(saleIdNum, authConfig),
          paymentService.getPaymentStatus(saleIdNum, authConfig),
        ]);

        if (abortedRef.current) return;

        if (!saleRes?.status) throw new Error(saleRes?.internalMessage || 'Sale not found');

        // Unwrap nested envelope (same pattern as home page)
        const envelope = saleRes.data as ResponsePayloadRecord | null;
        const nested   = (envelope?.['data'] ?? envelope) as SaleInfo | null;
        if (!nested) throw new Error('Sale data is empty');
        setSale(nested);

        if (statusRes?.status && statusRes.data) {
          const envelope2 = statusRes.data as ResponsePayloadRecord | null;
          const rec       = (envelope2?.['data'] ?? envelope2) as (PaymentRecord & { status: PaymentStatus }) | null;
          if (rec) setPaymentRec(rec);
          if (rec?.status === 'PAID') { setPageStatus('paid'); return; }
        }

        setPageStatus('ready');
      } catch (err) {
        if (abortedRef.current) return;
        if (!handleAuthError(err)) {
          const msg = err instanceof Error ? err.message : 'Failed to load sale';
          setErrorMsg(msg);
          setPageStatus('error');
        }
      }
    };

    void load();
    return () => { abortedRef.current = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleIdNum]);

  /* ── Initiate payment ── */
  const handlePay = async () => {
    if (!sale) return;
    setPageStatus('processing');
    try {
      await loadRazorpayScript();

      const res = await paymentService.createOrder(saleIdNum, authConfig);
      if (!res?.status) throw new Error(res?.internalMessage || 'Could not create payment order');

      const envelope = res.data as ResponsePayloadRecord | null;
      const orderData = (envelope?.['data'] ?? envelope) as CreateOrderResponse | null;
      if (!orderData?.orderId) throw new Error('Invalid order data from server');

      const rzp = new window.Razorpay({
        key:         orderData.keyId,
        amount:      orderData.amount,
        currency:    orderData.currency,
        name:        'Nihal Ice Factory',
        description: orderData.description,
        order_id:    orderData.orderId,
        prefill: {
          name:    orderData.customerName,
          contact: orderData.customerMobile,
        },
        theme: { color: '#2563eb' },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id:   string;
          razorpay_signature:  string;
        }) => {
          try {
            const verifyRes = await paymentService.verifyPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature,
              authConfig,
            );

            if (!verifyRes?.status) throw new Error(verifyRes?.internalMessage || 'Signature verification failed');

            const verEnv = verifyRes.data as ResponsePayloadRecord | null;
            const rec = (verEnv?.['data'] ?? verEnv) as (PaymentRecord & { status: PaymentStatus }) | null;
            if (rec) setPaymentRec(rec);

            setPageStatus('paid');
            toast.success('Payment successful!');
          } catch (verifyErr) {
            if (!handleAuthError(verifyErr)) {
              const msg = verifyErr instanceof Error ? verifyErr.message : 'Verification failed';
              setErrorMsg(msg);
              setPageStatus('failed');
              toast.error(msg);
            }
          }
        },
        modal: {
          ondismiss: () => {
            // User closed the checkout — revert to ready
            setPageStatus('ready');
          },
        },
      });

      rzp.open();
    } catch (err) {
      if (!handleAuthError(err)) {
        const msg = err instanceof Error ? err.message : 'Payment initiation failed';
        setErrorMsg(msg);
        setPageStatus('failed');
        toast.error(msg);
      }
    }
  };

  /* ── Badge helper ── */
  const StatusBadge: React.FC<{ status: PaymentStatus | string }> = ({ status }) => {
    const map: Record<string, { cls: string; label: string }> = {
      PAID:          { cls: 'paid',          label: 'Paid'        },
      PENDING:       { cls: 'pending',       label: 'Pending'     },
      FAILED:        { cls: 'failed',        label: 'Failed'      },
      NOT_INITIATED: { cls: 'not-initiated', label: 'Not Paid'    },
    };
    const { cls, label } = map[status] ?? { cls: 'not-initiated', label: status };
    return (
      <span className={`payment-status-badge payment-status-badge--${cls}`}>
        {label}
      </span>
    );
  };

  /* ── Render ── */
  if (pageStatus === 'loading') {
    return (
      <div className="payment-page">
        <PageHeader title="Payment" subtitle="Loading sale details…" />
        <Card title="Payment">
          <PageLoader size="sm" label="Loading sale details" />
        </Card>
      </div>
    );
  }

  if (pageStatus === 'error') {
    return (
      <div className="payment-page">
        <PageHeader title="Payment" />
        <Card title="Error">
          <p style={{ color: 'var(--color-error)', padding: '1rem 0' }}>{errorMsg || 'Something went wrong.'}</p>
          <Button variant="secondary" onClick={() => navigate('/')}>Back to Sales</Button>
        </Card>
      </div>
    );
  }

  if (pageStatus === 'paid') {
    return (
      <div className="payment-page">
        <PageHeader title="Payment" subtitle={`Sale #${saleIdNum}`} actions={
          <Button variant="secondary" onClick={() => navigate('/')}>Back to Sales</Button>
        } />
        <Card title="Payment Status">
          <div className="payment-success">
            <div className="payment-success__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="payment-success__title">Payment Successful</h2>
            <p className="payment-success__sub">
              {sale ? `${sale.name} — ${formatCurrency(sale.totalAmount)}` : 'Your payment has been processed.'}
            </p>
            <StatusBadge status="PAID" />

            {paymentRec?.razorpayPaymentId && (
              <div className="payment-ref" style={{ maxWidth: 420 }}>
                <div className="payment-ref__row">
                  <span className="payment-ref__label">Payment ID</span>
                  <span className="payment-ref__value">{paymentRec.razorpayPaymentId}</span>
                </div>
                <div className="payment-ref__row">
                  <span className="payment-ref__label">Order ID</span>
                  <span className="payment-ref__value">{paymentRec.razorpayOrderId}</span>
                </div>
                <div className="payment-ref__row">
                  <span className="payment-ref__label">Amount</span>
                  <span className="payment-ref__value">{formatCurrency(Number(paymentRec.amount))}</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <Button onClick={() => navigate('/')}>Back to Sales</Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="payment-page">
      <PageHeader
        title="Pay for Sale"
        subtitle={`Sale #${saleIdNum}`}
        actions={
          <Button variant="secondary" onClick={() => navigate('/')}>Back to Sales</Button>
        }
      />

      <Card title="Sale Summary">
        {sale && (
          <div className="payment-summary">
            <div className="payment-summary__row">
              <span className="payment-summary__label">Customer</span>
              <span className="payment-summary__value">{sale.name}</span>
            </div>
            <div className="payment-summary__row">
              <span className="payment-summary__label">Shop</span>
              <span className="payment-summary__value">{sale.shop}</span>
            </div>
            <div className="payment-summary__row">
              <span className="payment-summary__label">Mobile</span>
              <span className="payment-summary__value">{sale.mobile}</span>
            </div>
            <div className="payment-summary__row">
              <span className="payment-summary__label">Unit</span>
              <span className="payment-summary__value">{sale.unit}</span>
            </div>
            <div className="payment-summary__row">
              <span className="payment-summary__label">Date</span>
              <span className="payment-summary__value">{sale.date} at {sale.time}</span>
            </div>
            <div className="payment-summary__row">
              <span className="payment-summary__label">Payment Status</span>
              <StatusBadge status={paymentRec?.status ?? 'NOT_INITIATED'} />
            </div>
            <div className="payment-summary__row" style={{ gridColumn: '1 / -1' }}>
              <span className="payment-summary__label">Total Amount</span>
              <span className="payment-summary__amount">{formatCurrency(sale.totalAmount)}</span>
            </div>
          </div>
        )}

        {pageStatus === 'failed' && errorMsg && (
          <p style={{ color: 'var(--color-error)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            {errorMsg}
          </p>
        )}

        <div className="payment-actions">
          <Button
            onClick={handlePay}
            loading={pageStatus === 'processing'}
            disabled={pageStatus === 'processing'}
          >
            {pageStatus === 'failed' ? 'Retry Payment' : 'Pay with Razorpay'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/')}>Cancel</Button>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
          Secured by Razorpay. Accepts UPI, Credit/Debit cards, Net Banking &amp; Wallets.
        </p>
      </Card>
    </div>
  );
};

export default PaymentPage;
