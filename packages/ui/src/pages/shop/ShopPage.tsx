import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerHelpService, PaymentHelpService } from '@nihal-ice-factory/shared-services';
import type { ResponsePayloadRecord } from '@nihal-ice-factory/shared-models';
import { Button, Card, Field, Input, PageHeader, PageLoader, useToast } from '../../components';
import { buildAuthConfig, logout } from '../../lib/auth';
import { formatCurrency } from '../../lib/pricing';
import './styles/shop.css';

/* ── Razorpay window type ── */
declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: { error?: { description?: string; reason?: string } }) => void) => void;
    };
  }
}

/* ── Domain types ── */
interface Plant  { id: number; plantName: string; isActive: boolean }
interface IceType { id: number; iceTypeName: string; iceTypeCode: string; plantUnit: string; price: number }
interface DiscountTier { id: number; minAmount: number; maxAmount: number; discountPercent: number }
interface StockInfo { plantUnit: string; iceTypeId: number; availableCount: number; expectedAt: string | null }

type OrderType = 'NORMAL' | 'ADVANCE';
type PayMode   = 'ONLINE' | 'COD';

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
  totalUnits: number;
  orderType: OrderType;
  deliveryDate: string | null;
  payMode: PayMode;
  items: unknown[];
  razorpay: RazorpayOrderData | null;
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
  const paySvc      = useMemo(() => new PaymentHelpService(), []);
  const abortRef    = useRef(false);

  const [pageStatus,     setPageStatus]     = useState<PageStatus>('loading');
  const [plants,         setPlants]         = useState<Plant[]>([]);
  const [allIceTypes,    setAllIceTypes]    = useState<IceType[]>([]);
  const [discountTiers,  setDiscountTiers]  = useState<DiscountTier[]>([]);
  const [stock,          setStock]          = useState<StockInfo[]>([]);
  const [orderType,      setOrderType]      = useState<OrderType>('NORMAL');
  const [deliveryDate,   setDeliveryDate]   = useState('');
  const [payMode,        setPayMode]        = useState<PayMode>('ONLINE');
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

  /* ── Fetch shop data (mount + refresh after stock conflicts) ── */
  const fetchShop = async (initial: boolean) => {
    try {
      const res = await svc.getShopData(buildAuthConfig());
      if (abortRef.current) return;
      if (!res?.status) throw new Error(res?.internalMessage || 'Failed to load shop');

      const env  = res.data as ResponsePayloadRecord | null;
      const data = (env?.['data'] ?? env) as {
        plants?: Plant[]; iceTypes?: IceType[]; discountTiers?: DiscountTier[]; stock?: StockInfo[];
      } | null;

      const plantList    = Array.isArray(data?.plants)         ? data!.plants         : [];
      const iceTypeList  = Array.isArray(data?.iceTypes)       ? data!.iceTypes       : [];
      const tierList     = Array.isArray(data?.discountTiers)  ? data!.discountTiers  : [];
      const stockList    = Array.isArray(data?.stock)          ? data!.stock          : [];
      setPlants(plantList);
      setAllIceTypes(iceTypeList);
      setDiscountTiers(tierList);
      setStock(stockList);
      if (initial) {
        if (plantList.length > 0) selectPlant(plantList[0].plantName, iceTypeList);
        setPageStatus('idle');
      }
    } catch (err) {
      if (abortRef.current) return;
      if (!handleAuthError(err) && initial) setPageStatus('error');
    }
  };

  useEffect(() => {
    abortRef.current = false;
    fetchShop(true);
    return () => { abortRef.current = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Stock lookup for the selected plant ── */
  const stockFor = (iceTypeId: number): StockInfo | null =>
    stock.find((s) => s.plantUnit === selectedUnit && s.iceTypeId === iceTypeId) ?? null;

  /** Max orderable quantity in NORMAL mode; Infinity when untracked or ADVANCE. */
  const maxQtyFor = (iceTypeId: number): number => {
    if (orderType === 'ADVANCE') return Infinity;
    const info = stockFor(iceTypeId);
    return info ? info.availableCount : Infinity;
  };

  const formatExpected = (iso: string): string => {
    const d = new Date(iso);
    const today = new Date().toDateString() === d.toDateString();
    const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    return today ? `today ~${time}` : `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ~${time}`;
  };

  const selectPlant = (unitName: string, iceTypes = allIceTypes) => {
    setSelectedUnit(unitName);
    const types = iceTypes.filter((t) => t.plantUnit === unitName);
    setOrderItems(types.map((t) => ({ iceTypeId: t.id, iceTypeName: t.iceTypeName, price: t.price, quantity: '0' })));
  };

  const setQty = (iceTypeId: number, val: string) => {
    if (val !== '' && !/^\d*$/.test(val)) return;
    const max = maxQtyFor(iceTypeId);
    const clamped = val !== '' && Number(val) > max ? String(max) : val;
    setOrderItems((prev) => prev.map((i) => i.iceTypeId === iceTypeId ? { ...i, quantity: clamped } : i));
  };

  const bumpQty = (iceTypeId: number, delta: number) => {
    const max = maxQtyFor(iceTypeId);
    setOrderItems((prev) => prev.map((i) => {
      if (i.iceTypeId !== iceTypeId) return i;
      const next = Math.min(max, Math.max(0, (Number(i.quantity) || 0) + delta));
      return { ...i, quantity: String(next) };
    }));
  };

  /* Re-clamp quantities when switching back to NORMAL (stock caps apply again) */
  useEffect(() => {
    if (orderType !== 'NORMAL') return;
    setOrderItems((prev) => prev.map((i) => {
      const max = stock.find((s) => s.plantUnit === selectedUnit && s.iceTypeId === i.iceTypeId)?.availableCount;
      if (max === undefined) return i;
      return Number(i.quantity) > max ? { ...i, quantity: String(max) } : i;
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderType]);

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
    if (orderType === 'ADVANCE') {
      if (!deliveryDate) e.deliveryDate = 'Pick a delivery date';
      else if (deliveryDate <= new Date().toISOString().slice(0, 10)) {
        e.deliveryDate = 'Delivery date must be a future date';
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ── Place order & pay ── */
  const handleOrderAndPay = async () => {
    if (!validate()) return;
    setPageStatus('processing');
    setErrors({});
    try {
      if (payMode === 'ONLINE') await loadRazorpayScript(); // already cached — instant if preloaded

      const res = await svc.placeOrder({
        unit: selectedUnit, name: name.trim(), mobile: mobile.trim(),
        address: address.trim(),
        items: activeItems.map((i) => ({ iceTypeId: i.iceTypeId, quantity: Number(i.quantity) })),
        orderType,
        deliveryDate: orderType === 'ADVANCE' ? deliveryDate : undefined,
        payMode,
      }, buildAuthConfig());

      if (!res?.status) throw new Error(res?.internalMessage || 'Could not place order');

      const env  = res.data as ResponsePayloadRecord | null;
      const data = (env?.['data'] ?? env) as PlaceOrderResult | null;
      if (!data?.saleId) throw new Error('Invalid order response from server');

      setLastOrder(data);

      /* ── COD: no payment now — straight to confirmation ── */
      if (payMode === 'COD' || !data.razorpay?.orderId) {
        setLastPayment(null);
        setPageStatus('success');
        toast.success(orderType === 'ADVANCE' ? 'Advance booking placed!' : 'Order placed! Pay on delivery.');
        return;
      }

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
      rzp.on('payment.failed', (resp) => {
        const reason = resp?.error?.description || resp?.error?.reason || 'Payment failed at checkout';
        paySvc.reportPaymentFailed(rz.orderId, reason, buildAuthConfig()).catch(() => {});
      });
      rzp.open();
    } catch (err) {
      if (!handleAuthError(err)) {
        const msg = err instanceof Error ? err.message : 'Order failed';
        toast.error(msg);
        setPageStatus('idle');
        // Stock changed between page load and order — refresh availability
        if (/stock/i.test(msg)) fetchShop(false);
      }
    }
  };

  /* ── Success screen ── */
  if (pageStatus === 'success') {
    const isCod     = lastOrder?.payMode === 'COD';
    const isAdvance = lastOrder?.orderType === 'ADVANCE';
    return (
      <div className="shop-page">
        <PageHeader title="Order Ice" />
        <Card title={isAdvance ? 'Booking Confirmed' : 'Order Confirmed'}>
          <div className="shop-success">
            <div className="shop-success__icon">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="shop-success__title">
              {isAdvance ? 'Advance Booking Confirmed!' : isCod ? 'Order Placed!' : 'Order & Payment Successful!'}
            </h2>
            <p className="shop-success__sub">
              {isAdvance
                ? `Your booking is confirmed for ${lastOrder?.deliveryDate ?? 'the selected date'}.${isCod ? ' Pay on delivery.' : ''}`
                : isCod
                  ? 'Your ice order has been placed. Pay when you receive your ice.'
                  : "Your ice order has been placed and payment received. We'll deliver soon."}
            </p>
            {lastOrder && (
              <div className="shop-ref">
                <div className="shop-ref__row">
                  <span className="shop-ref__label">Order #</span>
                  <span className="shop-ref__value">{lastOrder.saleId}</span>
                </div>
                {isAdvance && lastOrder.deliveryDate && (
                  <div className="shop-ref__row">
                    <span className="shop-ref__label">Delivery Date</span>
                    <span className="shop-ref__value">{lastOrder.deliveryDate}</span>
                  </div>
                )}
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
                  <span className="shop-ref__label">{isCod ? 'Payable on Delivery' : 'Amount Paid'}</span>
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
                setOrderType('NORMAL'); setDeliveryDate(''); setPayMode('ONLINE');
                setOrderItems((prev) => prev.map((i) => ({ ...i, quantity: '0' })));
                fetchShop(false);
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
  const ctaLabel = payMode === 'COD' ? 'Place Order' : 'Order & Pay';
  const payCta = (
    <Button
      block
      size="lg"
      onClick={handleOrderAndPay}
      loading={pageStatus === 'processing'}
      disabled={pageStatus === 'processing' || subtotal === 0}
    >
      {ctaLabel} {subtotal > 0 ? `— ${formatCurrency(payableAmount)}` : ''}
    </Button>
  );

  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  return (
    <div className="shop-page">
      <PageHeader
        title="Order Ice"
        subtitle="Select a plant, choose quantities, and pay instantly"
        actions={<Button variant="secondary" onClick={() => navigate('/my-orders')}>My Orders</Button>}
      />

      {/* ── Order type: now vs advance booking ── */}
      <div className="shop-mode-bar">
        <div className="shop-mode-toggle" role="tablist" aria-label="Order type">
          <button
            type="button"
            role="tab"
            aria-selected={orderType === 'NORMAL'}
            className={`shop-mode-btn${orderType === 'NORMAL' ? ' shop-mode-btn--active' : ''}`}
            onClick={() => setOrderType('NORMAL')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Order Now
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={orderType === 'ADVANCE'}
            className={`shop-mode-btn${orderType === 'ADVANCE' ? ' shop-mode-btn--active' : ''}`}
            onClick={() => setOrderType('ADVANCE')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Advance Booking
          </button>
        </div>

        {orderType === 'ADVANCE' && (
          <div className="shop-mode-date">
            <label htmlFor="shop-delivery-date">Deliver on</label>
            <input
              id="shop-delivery-date"
              type="date"
              min={tomorrow}
              value={deliveryDate}
              onChange={(e) => { setDeliveryDate(e.target.value); setErrors((p) => ({ ...p, deliveryDate: '' })); }}
              className={errors.deliveryDate ? 'shop-mode-date--invalid' : ''}
            />
            {errors.deliveryDate && <span className="shop-error-note" style={{ margin: 0 }}>{errors.deliveryDate}</span>}
          </div>
        )}

        <p className="shop-mode-hint">
          {orderType === 'NORMAL'
            ? 'Same-day order from live stock — quantities are limited to what’s available now.'
            : 'Book for a future date — no stock limits, the plant will produce for your booking.'}
        </p>
      </div>

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
                    const qty     = Number(item.quantity) || 0;
                    const info    = stockFor(item.iceTypeId);
                    const tracked = info !== null;
                    const oos     = orderType === 'NORMAL' && tracked && info.availableCount === 0;
                    const low     = orderType === 'NORMAL' && tracked && info.availableCount > 0 && info.availableCount <= 5;
                    return (
                      <div
                        key={item.iceTypeId}
                        className={`shop-item-card${qty > 0 ? ' shop-item-card--active' : ''}${oos ? ' shop-item-card--oos' : ''}`}
                      >
                        <div className="shop-item-card__head">
                          <div className="shop-item-name">
                            {item.iceTypeName}
                            {oos && <span className="shop-stock-badge shop-stock-badge--oos">Out of stock</span>}
                            {low && <span className="shop-stock-badge shop-stock-badge--low">Only {info.availableCount} left</span>}
                            {orderType === 'NORMAL' && tracked && !oos && !low && (
                              <span className="shop-stock-badge shop-stock-badge--ok">{info.availableCount} in stock</span>
                            )}
                          </div>
                          <div className="shop-item-price"><strong>{formatCurrency(item.price)}</strong> <span>/ unit</span></div>
                        </div>
                        {oos && (
                          <div className="shop-item-expected">
                            {info.expectedAt
                              ? <>Expected back <strong>{formatExpected(info.expectedAt)}</strong> — or use Advance Booking</>
                              : <>Currently unavailable — try Advance Booking for a future date</>}
                          </div>
                        )}
                        <div className="shop-item-card__controls">
                          <div className="shop-qty">
                            <button
                              type="button"
                              className="shop-qty__btn"
                              onClick={() => bumpQty(item.iceTypeId, -1)}
                              disabled={qty <= 0 || oos}
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
                              disabled={oos}
                              aria-label={`Quantity for ${item.iceTypeName}`}
                            />
                            <button
                              type="button"
                              className="shop-qty__btn"
                              onClick={() => bumpQty(item.iceTypeId, 1)}
                              disabled={oos || (orderType === 'NORMAL' && tracked && qty >= info.availableCount)}
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

            {/* ── Payment mode ── */}
            <div className="shop-paymode" role="radiogroup" aria-label="Payment method">
              <button
                type="button"
                role="radio"
                aria-checked={payMode === 'ONLINE'}
                className={`shop-paymode__btn${payMode === 'ONLINE' ? ' shop-paymode__btn--active' : ''}`}
                onClick={() => setPayMode('ONLINE')}
              >
                <span className="shop-paymode__radio" aria-hidden />
                <span>
                  <strong>Pay Now</strong>
                  <small>UPI, Cards, Net Banking</small>
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={payMode === 'COD'}
                className={`shop-paymode__btn${payMode === 'COD' ? ' shop-paymode__btn--active' : ''}`}
                onClick={() => setPayMode('COD')}
              >
                <span className="shop-paymode__radio" aria-hidden />
                <span>
                  <strong>Pay on Delivery</strong>
                  <small>Cash / UPI at handover</small>
                </span>
              </button>
            </div>

            <div className="shop-summary__cta">{payCta}</div>
            {payMode === 'ONLINE' ? (
              <p className="shop-secure-note">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Secured by Razorpay · UPI, Cards, Net Banking &amp; Wallets
              </p>
            ) : (
              <p className="shop-secure-note">Pay in cash or UPI when you collect your ice.</p>
            )}
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
            {ctaLabel}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ShopPage;
