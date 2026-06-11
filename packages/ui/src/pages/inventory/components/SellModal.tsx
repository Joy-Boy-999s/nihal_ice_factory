import React, { useState } from 'react';
import { Modal } from '../../../components/Modal/Modal';
import { IceSlot } from '../utils/use-inventory';

interface SellModalProps {
  open: boolean;
  slots: IceSlot[];
  pricePerUnit: number;
  iceTypeName: string;
  onClose: () => void;
  onConfirm: (data: SellFormData) => Promise<void>;
}

export interface SellFormData {
  customerName: string;
  customerMobile: string;
  shopName: string;
  discount: number;
  soldBy: string;
}

const EMPTY: SellFormData = {
  customerName:   '',
  customerMobile: '',
  shopName:       '',
  discount:       0,
  soldBy:         '',
};

function fmtRupees(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export const SellModal: React.FC<SellModalProps> = ({
  open, slots, pricePerUnit, iceTypeName, onClose, onConfirm,
}) => {
  const [form, setForm]     = useState<SellFormData>(EMPTY);
  const [errors, setErrors] = useState<Partial<SellFormData & { general: string }>>({});
  const [saving, setSaving] = useState(false);

  const quantity   = slots.length;
  const subtotal   = quantity * pricePerUnit;
  const discAmt    = Math.min(Number(form.discount) || 0, subtotal);
  const total      = subtotal - discAmt;

  const set = <K extends keyof SellFormData>(k: K, v: SellFormData[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined, general: undefined }));
  };

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!form.customerName.trim())   errs.customerName   = 'Required';
    if (!/^\d{10}$/.test(form.customerMobile.trim())) errs.customerMobile = 'Enter 10-digit mobile';
    if (!form.soldBy.trim())         errs.soldBy         = 'Required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onConfirm(form);
      setForm(EMPTY);
      setErrors({});
    } catch (err) {
      setErrors({ general: err instanceof Error ? err.message : 'Failed to complete sale' });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    setForm(EMPTY);
    setErrors({});
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Complete Sale"
      size="md"
      closeOnBackdrop={!saving}
      footer={
        <div className="sell-modal__footer">
          <button className="sell-modal__btn sell-modal__btn--cancel" onClick={handleClose} disabled={saving} type="button">
            Cancel
          </button>
          <button
            className="sell-modal__btn sell-modal__btn--confirm"
            form="sell-form"
            type="submit"
            disabled={saving}
          >
            {saving ? 'Processing…' : `Confirm Sale · ${fmtRupees(total)}`}
          </button>
        </div>
      }
    >
      {/* Slot summary */}
      <div className="sell-modal__slots">
        <div className="sell-modal__slots-header">
          <span className="sell-modal__slots-title">Selected Slots</span>
          <span className="sell-modal__slots-count">{quantity} × {iceTypeName}</span>
        </div>
        <div className="sell-modal__slot-chips">
          {slots.map((s) => (
            <span key={s.id} className="sell-modal__slot-chip">{s.slotLabel}</span>
          ))}
        </div>
      </div>

      {/* Price summary */}
      <div className="sell-modal__price-row">
        <div className="sell-modal__price-item">
          <span>Subtotal</span>
          <strong>{fmtRupees(subtotal)}</strong>
        </div>
        <div className="sell-modal__price-item sell-modal__price-item--total">
          <span>Total</span>
          <strong className="sell-modal__total">{fmtRupees(total)}</strong>
        </div>
      </div>

      <hr className="sell-modal__divider" />

      {/* Customer form */}
      <form id="sell-form" onSubmit={handleSubmit} noValidate>
        <div className="sell-modal__grid">
          <div className={`sell-modal__field ${errors.customerName ? 'sell-modal__field--error' : ''}`}>
            <label className="sell-modal__label">Customer Name <span>*</span></label>
            <input
              className="sell-modal__input"
              value={form.customerName}
              onChange={(e) => set('customerName', e.target.value)}
              placeholder="Enter name"
              autoFocus
            />
            {errors.customerName && <p className="sell-modal__err">{errors.customerName}</p>}
          </div>

          <div className={`sell-modal__field ${errors.customerMobile ? 'sell-modal__field--error' : ''}`}>
            <label className="sell-modal__label">Mobile <span>*</span></label>
            <input
              className="sell-modal__input"
              value={form.customerMobile}
              onChange={(e) => set('customerMobile', e.target.value)}
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit number"
            />
            {errors.customerMobile && <p className="sell-modal__err">{errors.customerMobile}</p>}
          </div>

          <div className="sell-modal__field">
            <label className="sell-modal__label">Shop / Party Name</label>
            <input
              className="sell-modal__input"
              value={form.shopName}
              onChange={(e) => set('shopName', e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className={`sell-modal__field ${errors.soldBy ? 'sell-modal__field--error' : ''}`}>
            <label className="sell-modal__label">Sold By <span>*</span></label>
            <input
              className="sell-modal__input"
              value={form.soldBy}
              onChange={(e) => set('soldBy', e.target.value)}
              placeholder="Staff name"
            />
            {errors.soldBy && <p className="sell-modal__err">{errors.soldBy}</p>}
          </div>

          <div className="sell-modal__field">
            <label className="sell-modal__label">Discount (₹)</label>
            <input
              className="sell-modal__input"
              type="number"
              min={0}
              max={subtotal}
              value={form.discount}
              onChange={(e) => set('discount', Number(e.target.value))}
              inputMode="numeric"
            />
          </div>
        </div>

        {errors.general && (
          <div className="sell-modal__general-error">{errors.general}</div>
        )}
      </form>
    </Modal>
  );
};
