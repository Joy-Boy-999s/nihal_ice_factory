import React from 'react';
import { Button, Modal } from '../../../components';
import { formatCurrency } from '../../../lib/pricing';
import type { SaleForm } from '../model/types';

export interface SalePreviewModalProps {
  open:        boolean;
  form:        SaleForm;
  totalUnits:  number;
  totalAmount: number;
  saving:      boolean;
  onEdit:      () => void;
  onConfirm:   () => void;
}

interface InfoRow {
  label: string;
  value: React.ReactNode;
}

const SalePreviewModal: React.FC<SalePreviewModalProps> = ({
  open,
  form,
  totalUnits,
  totalAmount,
  saving,
  onEdit,
  onConfirm,
}) => {
  const discountN = Number(form.discount) || 0;

  const activeItems = form.items.filter((i) => Number(i.quantity) > 0);

  const subtotal = activeItems.reduce(
    (sum, i) => sum + Number(i.quantity) * i.price,
    0,
  );

  const customerRows: InfoRow[] = [
    { label: 'Name',   value: form.name   || '—' },
    { label: 'Mobile', value: form.mobile || '—' },
    { label: 'Shop',   value: form.shop   || '—' },
  ];

  const saleRows: InfoRow[] = [
    { label: 'Date',    value: form.date   || '—' },
    { label: 'Time',    value: form.time   || '—' },
    { label: 'Unit',    value: form.unit   || '—' },
    { label: 'Sold By', value: form.soldBy || '—' },
  ];

  return (
    <Modal
      open={open}
      onClose={onEdit}
      size="md"
      title="Review Sale"
      closeOnBackdrop={!saving}
      footer={
        <>
          <Button variant="secondary" onClick={onEdit} disabled={saving}>
            Back to edit
          </Button>
          <Button onClick={onConfirm} loading={saving}>
            Confirm &amp; Save
          </Button>
        </>
      }
    >
      <div className="sale-preview">
        <p className="sale-preview__hint">
          Please confirm the details below. Once saved, this sale will be recorded in your ledger.
        </p>

        <section className="sale-preview__section">
          <h4 className="sale-preview__heading">Customer</h4>
          <dl className="sale-preview__grid">
            {customerRows.map((row) => (
              <div key={row.label} className="sale-preview__row">
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="sale-preview__section">
          <h4 className="sale-preview__heading">Sale Info</h4>
          <dl className="sale-preview__grid">
            {saleRows.map((row) => (
              <div key={row.label} className="sale-preview__row">
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="sale-preview__section">
          <h4 className="sale-preview__heading">Price Breakdown</h4>
          {activeItems.length === 0 ? (
            <p className="sale-preview__empty">No quantities entered.</p>
          ) : (
            <table className="sale-preview__price-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="sale-preview__num">Qty</th>
                  <th className="sale-preview__num">Rate</th>
                  <th className="sale-preview__num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {activeItems.map((item) => (
                  <tr key={item.iceTypeId}>
                    <td>{item.iceTypeName}</td>
                    <td className="sale-preview__num">{Number(item.quantity)}</td>
                    <td className="sale-preview__num">{formatCurrency(item.price)}</td>
                    <td className="sale-preview__num">
                      {formatCurrency(Number(item.quantity) * item.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="sale-preview__subtotal-row">
                  <td colSpan={3}>Subtotal</td>
                  <td className="sale-preview__num">{formatCurrency(subtotal)}</td>
                </tr>
                {discountN > 0 && (
                  <tr className="sale-preview__discount-row">
                    <td colSpan={3}>Discount</td>
                    <td className="sale-preview__num">− {formatCurrency(discountN)}</td>
                  </tr>
                )}
              </tfoot>
            </table>
          )}
        </section>

        <div className="sale-preview__totals">
          <div className="sale-preview__total">
            <span>Total Units</span>
            <strong>{totalUnits}</strong>
          </div>
          <div className="sale-preview__total sale-preview__total--primary">
            <span>Total Amount</span>
            <strong>{formatCurrency(totalAmount)}</strong>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SalePreviewModal;
