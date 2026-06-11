import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerHelpService } from '@nihal-ice-factory/shared-services';
import type { ResponsePayloadRecord } from '@nihal-ice-factory/shared-models';
import { Button, Card, Field, Input, PageHeader, PageLoader, useToast } from '../../components';
import { buildAuthConfig, logout } from '../../lib/auth';
import { formatCurrency } from '../../lib/pricing';
import './styles/shop.css';

/* ── Razorpay window type ── */
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: new (opts: Record<string, unknown>) => { open(): void };
  }
}

/* ── Domain types ── */
interface Plant  { id: number; plantName: string; isActive: boolean }
interface IceType { id: number; iceTypeName: string; iceTypeCode: string; plantUnit: string; price: number }
interface DiscountTier { id: number; minAmount: number; maxAmount: number; discountPercent: number }

interface OrderItem { iceTypeId: number; iceTypeName: string; price: number; quantity: string }

interface RazorpayOrderData {
  orderId: string; amount: number; currency: string; keyId: string;
  customerName: string; customerMobile: string; description: string;
}

interface PlaceOrderResult {
  saleId: number;
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
  totalAmount: number;
  items: unknown[];
  razorpay: RazorpayOrderData;
}

interface PaymentRecord { razorpayPaymentId: string; razorpayOrderId: string; amount: number }

type PageStatus = 'loading' | 'idle' | 'processing' | 'success' | 'error';

const RAZORPAY_CDN = 'https://checkout.razorpay.com/v1/checkout.js';
const MOBILE_RE    = /^[6-9]\d{9}$/;

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('razorpay-cdn')) { resolve(); return; }
    const s = document.createElement('script');
    s.id   = 'razorpay-cdn';
    s.src  = RAZORPAY_CDN;
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.head.appendChild(s);
  });
}

/* ── Component ── */
const ShopPage: React.FC = () => {
  const navigate    = useNavigate();
  const toast       = useToast();
  const svc         = useMemo(() => new CustomerHelpService(), []);
  const abortRef    = useRef(false);

  const [pageStatus,     setPageStatus]     = useState<PageStatus>('loading');
  const [plants,         setPlants]         = useState<Plant[]>([]);
  const [allIceTypes,    setAllIceTypes]    = useState<IceType[]>([]);
  const [discountTiers,  setDiscountTiers]  = useState<DiscountTier[]>([]);
  const [selectedUnit,   setSelectedUnit]   = useState('');
  const [orderItems,     setOrderItems]     = useState<OrderItem[]>([]);
  const [name,           setName]           = useState('');
  const [mobile,         setMobile]         = useState('');
  const [address,        setAddress]        = useState('');
  const [errors,         setErrors]         = useState<Record<string, string>>({});
  const [lastOrder,      setLastOrder]      = useState<PlaceOrderResult | null>(null);
  const [lastPayment,    setLastPayment]    = useState<PaymentRecord | null>(null);

  /* ── Auth error helper ── */
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

  /* ── Preload Razorpay script in background on mount ── */
  useEffect(() => { loadRazorpayScript().catch(() => {}); }, []);

  /* ── Fetch shop data on mount ── */
  useEffect(() => {
    abortRef.current = false;
    (async () => {
      try {
        const res = await svc.getShopData(buildAuthConfig());
        if (abortRef.current) return;
        if (!res?.status) throw new Error(res?.internalMessage || 'Failed to load shop');

        const env  = res.data as ResponsePayloadRecord | null;
        const data = (env?.['data'] ?? env) as { plants?: Plant[]; iceTypes?: IceType[]; discountTiers?: DiscountTier[] } | null;

        const plantList    = Array.isArray(data?.plants)         ? data!.plants         : [];
        const iceTypeList  = Array.isArray(data?.iceTypes)       ? data!.iceTypes       : [];
        const tierList     = Array.isArray(data?.discountTiers)  ? data!.discountTiers  : [];
        setPlants(plantList);
        setAllIceTypes(iceTypeList);
        setDiscountTiers(tierList);
        if (plantList.length > 0) selectPlant(plantList[0].plantName, iceTypeList);
        setPageStatus('idle');
      } catch (err) {
        if (abortRef.current) return;
        if (!handleAuthError(err)) setPageStatus('error');
      }
    })();
    return () => { abortRef.current = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectPlant = (unitName: string, iceTypes = allIceTypes) => {
    setSelectedUnit(unitName);
    const types = iceTypes.filter((t) => t.plantUnit === unitName);
    setOrderItems(types.map((t) => ({ iceTypeId: t.id, iceTypeName: t.iceTypeName, price: t.price, quantity: '0' })));
  };

  const setQty = (iceTypeId: number, val: string) => {
    if (val !== '' && !/^\d*$/.test(val)) return;
    setOrderItems((prev) => prev.map((i) => i.iceTypeId === iceTypeId ? { ...i, quantity: val } : i));
  };

  const bumpQty = (iceTypeId: number, delta: number) => {
    setOrderItems((prev) => prev.map((i) => {
      if (i.iceTypeId !== iceTypeId) return i;
      const next = Math.max(0, (Number(i.quantity) || 0) + delta);
      return { ...i, quantity: String(next) };
    }));
  };

  const activeItems = orderItems.filter((i) => Number(i.quantity) > 0);
  const subtotal    = activeItems.reduce((s, i) => s + Number(i.quantity) * i.price, 0);
  const totalUnits  = activeItems.reduce((s, i) => s + Number(i.quantity), 0);

  /* ── Live discount preview ── */
  const previewDiscount = useMemo(() => {
    if (subtotal <= 0 || discountTiers.length === 0) return { discountAmount: 0, discountPercent: 0 };
    const tier = discountTiers.find(
      (t) => subtotal >= Number(t.minAmount) && subtotal < Number(t.maxAmount),
    );
    if (!tier) return { discountAmount: 0, discountPercent: 0 };
    const pct = Number(tier.discountPercent);
    return {
      discountPercent: pct,
      discountAmount:  Math.round(subtotal * pct / 100 * 100) / 100,
    };
  }, [subtotal, discountTiers]);

  const payableAmount = subtotal - previewDiscount.discountAmount;

  /* ── "Add ₹X more to unlock Y% off" hint ── */
  const nextTierHint = useMemo(() => {
    if (discountTiers.length === 0 || subtotal <= 0) return null;
    const next = discountTiers
      .filter((t) => Number(t.minAmount) > subtotal && Number(t.discountPercent) > previewDiscount.discountPercent)
      .sort((a, b) => Number(a.minAmount) - Number(b.minAmount))[0];
    if (!next) return null;
    return {
      amountMore: Number(next.minAmount) - subtotal,
      percent:    Number(next.discountPercent),
    };
  }, [discountTiers, subtotal, previewDiscount.discountPercent]);

  /* ── Validation ── */
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim())           e.name    = 'Name is required';
    if (!mobile.trim())         e.mobile  = 'Mobile is required';
    else if (!MOBILE_RE.test(mobile)) e.mobile = 'Enter a valid 10-digit mobile';
    if (!address.trim())        e.address = 'Address / shop name is required';
    if (!selectedUnit)          e.unit    = 'Select a plant';
    if (activeItems.length === 0) e.items = 'Add at least one item';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ── Place order & pay ── */
  const handleOrderAndPay = async () => {
    if (!validate()) return;
    setPageStatus('processing');
    setErrors({});
    try {
      await loadRazorpayScript(); // already cached — instant if preloaded

      const res = await svc.placeOrder({
        unit: selectedUnit, name: name.trim(), mobile: mobile.trim(),
        address: address.trim(),
        items: activeItems.map((i) => ({ iceTypeId: i.iceTypeId, quantity: Number(i.quantity) })),
      }, buildAuthConfig());

      if (!res?.status) throw new Error(res?.internalMessage || 'Could not place order');

      const env  = res.data as ResponsePayloadRecord | null;
      const data = (env?.['data'] ?? env) as PlaceOrderResult | null;
      if (!data?.razorpay?.orderId) throw new Error('Invalid order response from server');

      setLastOrder(data);
      const rz = data.razorpay;

      const rzp = new window.Razorpay({
        key: rz.keyId, amount: rz.amount, currency: rz.currency,
        name: 'Nihal Ice Factory', description: rz.description,
        order_id: rz.orderId,
        prefill: { name: rz.customerName, contact: rz.customerMobile },
        theme: { color: '#2563eb' },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            const vRes = await svc.verifyPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature,
              buildAuthConfig(),
            );
            if (!vRes?.status) throw new Error(vRes?.internalMessage || 'Verification failed');
            const vEnv = vRes.data as ResponsePayloadRecord | null;
            const vData = (vEnv?.['data'] ?? vEnv) as PaymentRecord | null;
            if (vData) setLastPayment(vData);
            setPageStatus('success');
            toast.success('Order placed and payment received!');
          } catch (verr) {
            if (!handleAuthError(verr)) {
              toast.error(verr instanceof Error ? verr.message : 'Payment verification failed');
              setPageStatus('idle');
            }
          }
        },
        modal: { ondismiss: () => setPageStatus('idle') },
      });
      rzp.open();
    } catch (err) {
      if (!handleAuthError(err)) {
        toast.error(err instanceof Error ? err.message : 'Order failed');
        setPageStatus('idle');
      }
    }
  };

  /* ── Success screen ── */
  if (pageStatus === 'success') {
    return (
      <div className="shop-page">
        <PageHeader title="Order Ice" />
        <Card title="Order Confirmed">
          <div className="shop-success">
            <div className="shop-success__icon">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="shop-success__title">Order &amp; Payment Successful!</h2>
            <p className="shop-success__sub">
              Your ice order has been placed and payment received. We'll deliver soon.
            </p>
            {lastOrder && (
              <div className="shop-ref">
                <div className="shop-ref__row">
                  <span className="shop-ref__label">Order #</span>
                  <span className="shop-ref__value">{lastOrder.saleId}</span>
                </div>
                {lastOrder.discountAmount > 0 && (
                  <>
                    <div className="shop-ref__row">
                      <span className="shop-ref__label">Subtotal</span>
                      <span className="shop-ref__value">{formatCurrency(lastOrder.subtotal)}</span>
                    </div>
                    <div className="shop-ref__row">
                      <span className="shop-ref__label">Discount ({lastOrder.discountPercent}%)</span>
                      <span className="shop-ref__value" style={{ color: '#059669' }}>−{formatCurrency(lastOrder.discountAmount)}</span>
                    </div>
                  </>
                )}
                <div className="shop-ref__row">
                  <span className="shop-ref__label">Amount Paid</span>
                  <span className="shop-ref__value">{formatCurrency(lastOrder.totalAmount)}</span>
                </div>
                {lastPayment?.razorpayPaymentId && (
                  <div className="shop-ref__row">
                    <span className="shop-ref__label">Payment ID</span>
                    <span className="shop-ref__value">{lastPayment.razorpayPaymentId}</span>
                  </div>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button onClick={() => navigate('/my-orders')}>View My Orders</Button>
              {lastOrder && (
                <Button variant="secondary" onClick={() => navigate(`/invoice/${lastOrder.saleId}`)}>
                  Get Invoice
                </Button>
              )}
              <Button variant="secondary" onClick={() => {
                setPageStatus('idle');
                setLastOrder(null);
                setLastPayment(null);
                setName(''); setMobile(''); setAddress('');
                setOrderItems((prev) => prev.map((i) => ({ ...i, quantity: '0' })));
              }}>
                Place Another Order
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  /* ── Loading ── */
  if (pageStatus === 'loading') {
    return (
      <div className="shop-page">
        <PageHeader title="Order Ice" subtitle="Loading available ice types…" />
        <Card title="Shop"><PageLoader size="sm" label="Preparing your shop" /></Card>
      </div>
    );
  }

  /* ── Error ── */
  if (pageStatus === 'error') {
    return (
      <div className="shop-page">
        <PageHeader title="Order Ice" />
        <Card title="Error">
          <p style={{ color: 'var(--color-error)', padding: '1rem 0' }}>Failed to load shop data. Please refresh.</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>Retry</Button>
        </Card>
      </div>
    );
  }

  /* ── Main shop UI ── */
  const payCta = (
    <Button
      block
      size="lg"
      onClick={handleOrderAndPay}
      loading={pageStatus === 'processing'}
      disabled={pageStatus === 'processing' || subtotal === 0}
    >
      Order &amp; Pay {subtotal > 0 ? `— ${formatCurrency(payableAmount)}` : ''}
    </Button>
  );

  return (
    <div className="shop-page">
      <PageHeader
        title="Order Ice"
        subtitle="Select a plant, choose quantities, and pay instantly"
        actions={<Button variant="secondary" onClick={() => navigate('/my-orders')}>My Orders</Button>}
      />

      <div className="shop-layout">
        <div className="shop-main">
          {/* Step 1: Select plant */}
          <Card title={<span className="shop-step"><i className="shop-step__num">1</i>Select Plant</span>}>
            {plants.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', padding: '0.5rem 0' }}>No plants available right now.</p>
            ) : (
              <div className="shop-plants">
                {plants.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`shop-plant-btn${selectedUnit === p.plantName ? ' shop-plant-btn--active' : ''}`}
                    onClick={() => selectPlant(p.plantName)}
                  >
                    {selectedUnit === p.plantName && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    {p.plantName}
                  </button>
                ))}
              </div>
            )}
            {errors.unit && <p className="shop-error-note">{errors.unit}</p>}
          </Card>

          {/* Step 2: Choose quantities */}
          {selectedUnit && (
            <Card
              title={<span className="shop-step"><i className="shop-step__num">2</i>Choose Quantities</span>}
              subtitle={`Available at ${selectedUnit}`}
            >
              {orderItems.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)' }}>No ice types configured for this plant yet.</p>
              ) : (
                <div className="shop-items">
                  {orderItems.map((item) => {
                    const qty = Number(item.quantity) || 0;
                    return (
                      <div key={item.iceTypeId} className={`shop-item-card${qty > 0 ? ' shop-item-card--active' : ''}`}>
                        <div className="shop-item-card__head">
                          <div className="shop-item-name">{item.iceTypeName}</div>
                          <div className="shop-item-price"><strong>{formatCurrency(item.price)}</strong> <span>/ unit</span></div>
                        </div>
                        <div className="shop-item-card__controls">
                          <div className="shop-qty">
                            <button
                              type="button"
                              className="shop-qty__btn"
                              onClick={() => bumpQty(item.iceTypeId, -1)}
                              disabled={qty <= 0}
                              aria-label={`Decrease ${item.iceTypeName}`}
                            >
                              −
                            </button>
                            <input
                              className="shop-qty__input"
                              value={item.quantity}
                              onChange={(e) => setQty(item.iceTypeId, e.target.value)}
                              inputMode="numeric"
                              placeholder="0"
                              aria-label={`Quantity for ${item.iceTypeName}`}
                            />
                            <button
                              type="button"
                              className="shop-qty__btn"
                              onClick={() => bumpQty(item.iceTypeId, 1)}
                              aria-label={`Increase ${item.iceTypeName}`}
                            >
                              +
                            </button>
                          </div>
                          <div className={`shop-item-subtotal${qty > 0 ? ' shop-item-subtotal--visible' : ''}`}>
                            {qty > 0 ? formatCurrency(qty * item.price) : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {errors.items && <p className="shop-error-note">{errors.items}</p>}
            </Card>
          )}

          {/* Step 3: Customer details */}
          <Card title={<span className="shop-step"><i className="shop-step__num">3</i>Your Details</span>}>
            <div className="shop-info-grid">
              <Field label="Full Name" required error={errors.name}>
                <Input value={name} onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: '' })); }} invalid={!!errors.name} placeholder="Your name" />
              </Field>
              <Field label="Mobile Number" required error={errors.mobile}>
                <Input value={mobile} onChange={(e) => { setMobile(e.target.value); setErrors((p) => ({ ...p, mobile: '' })); }} invalid={!!errors.mobile} inputMode="numeric" maxLength={10} placeholder="10-digit mobile" />
              </Field>
              <Field label="Shop / Delivery Address" required error={errors.address} style={{ gridColumn: '1 / -1' }}>
                <Input value={address} onChange={(e) => { setAddress(e.target.value); setErrors((p) => ({ ...p, address: '' })); }} invalid={!!errors.address} placeholder="Shop name or delivery address" />
              </Field>
            </div>
          </Card>
        </div>

        {/* Sticky order summary */}
        <aside className="shop-side">
          <Card title="Order Summary" className="shop-summary-card">
            {activeItems.length === 0 ? (
              <div className="shop-summary__empty">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
                <p>Your order is empty.<br />Add quantities to see the total.</p>
              </div>
            ) : (
              <>
                <div className="shop-summary__items">
                  {activeItems.map((i) => (
                    <div key={i.iceTypeId} className="shop-summary__item">
                      <span className="shop-summary__item-name">
                        {i.iceTypeName} <em>× {Number(i.quantity)}</em>
                      </span>
                      <span className="shop-summary__item-amount">{formatCurrency(Number(i.quantity) * i.price)}</span>
                    </div>
                  ))}
                </div>

                <div className="shop-summary__rows">
                  <div className="shop-summary__row">
                    <span>Subtotal ({totalUnits} units)</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {previewDiscount.discountAmount > 0 && (
                    <div className="shop-summary__row shop-summary__row--discount">
                      <span>Discount ({previewDiscount.discountPercent}%)</span>
                      <span>−{formatCurrency(previewDiscount.discountAmount)}</span>
                    </div>
                  )}
                  <div className="shop-summary__row shop-summary__row--total">
                    <span>You Pay</span>
                    <span>{formatCurrency(payableAmount)}</span>
                  </div>
                </div>
              </>
            )}

            {nextTierHint && (
              <div className="shop-tier-hint">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />
                </svg>
                Add <strong>{formatCurrency(nextTierHint.amountMore)}</strong> more to unlock <strong>{nextTierHint.percent}% off</strong>
              </div>
            )}

            <div className="shop-summary__cta">{payCta}</div>
            <p className="shop-secure-note">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Secured by Razorpay · UPI, Cards, Net Banking &amp; Wallets
            </p>
          </Card>
        </aside>
      </div>

      {/* Mobile sticky pay bar */}
      {subtotal > 0 && (
        <div className="shop-paybar">
          <div className="shop-paybar__total">
            <span>You pay</span>
            <strong>{formatCurrency(payableAmount)}</strong>
          </div>
          <Button
            onClick={handleOrderAndPay}
            loading={pageStatus === 'processing'}
            disabled={pageStatus === 'processing'}
          >
            Order &amp; Pay
          </Button>
        </div>
      )}
    </div>
  );
};

export default ShopPage;
