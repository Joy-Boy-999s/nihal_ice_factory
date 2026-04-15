import React from 'react';

interface SaleTotalsPreviewProps {
  totalCansText: string;
  totalAmountText: string;
}

const SaleTotalsPreview: React.FC<SaleTotalsPreviewProps> = ({
  totalCansText,
  totalAmountText,
}) => {
  return (
    <div className="add-sale-totals" aria-live="polite">
      <div className="add-sale-totals__item add-sale-totals__item--soft-green">
        <span className="add-sale-totals__label">Calculated Cans</span>
        <span className="add-sale-totals__value add-sale-totals__value--green">{totalCansText}</span>
      </div>

      <div className="add-sale-totals__item add-sale-totals__item--soft-blue">
        <span className="add-sale-totals__label">Estimated Amount</span>
        <span className="add-sale-totals__value add-sale-totals__value--blue">{totalAmountText}</span>
      </div>
    </div>
  );
};

export default SaleTotalsPreview;
