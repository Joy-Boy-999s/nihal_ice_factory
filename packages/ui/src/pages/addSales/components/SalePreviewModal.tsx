import React from 'react';
import { Button, Modal } from '../../../components';
import { formatCurrency } from '../../../lib/pricing';
import type { SaleForm } from '../model/types';

interface SalePreviewModalProps {
  open: boolean;
  form: SaleForm;
  totalCans: number;
  totalAmount: number;
  saving: boolean;
  onEdit: () => void;
  onConfirm: () => void;
}

interface Row {
  label: string;
  value: React.ReactNode;
}

const SalePreviewModal: React.FC<SalePreviewModalProps> = ({
  open,
  form,
  totalCans,
  totalAmount,
  saving,
  onEdit,
  onConfirm,
}) => {
  const customerRows: Row[] = [
    { label: 'Name', value: form.name || '—' },
    { label: 'Mobile', value: form.mobile || '—' },
    { label: 'Shop', value: form.shop || '—' },
  ];

  const saleRows: Row[] = [
    { label: 'Date', value: form.date || '—' },
    { label: 'Time', value: form.time || '—' },
    { label: 'Unit', value: form.unit || '—' },
    { label: 'Sold By', value: form.soldBy || '—' },
  ];

  const itemRows: Row[] = [
    { label: 'Cans', value: form.cans || '0' },
    { label: 'Blocks', value: form.blocks || '0' },
    { label: 'Pieces', value: form.pieces || '0' },
    { label: 'Discount', value: form.discount || '0' },
  ];

  return (
    <Modal
      open={open}
      onClose={onEdit}
      size="md"
      title="Review sale before saving"
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
          <h4 className="sale-preview__heading">Sale</h4>
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
          <h4 className="sale-preview__heading">Items</h4>
          <dl className="sale-preview__grid">
            {itemRows.map((row) => (
              <div key={row.label} className="sale-preview__row">
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="sale-preview__totals">
          <div className="sale-preview__total">
            <span>Total Cans</span>
            <strong>{totalCans.toFixed(2)}</strong>
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
