import React from 'react';

interface SaleTotalsPreviewProps {
  totalUnitsText: string;
  totalAmountText: string;
}

const SaleTotalsPreview: React.FC<SaleTotalsPreviewProps> = ({
  totalUnitsText,
  totalAmountText,
}) => {
  return (
    <div className="add-sale-totals" aria-live="polite">
      <div className="add-sale-totals__item add-sale-totals__item--soft-green">
        <span className="add-sale-totals__label">Total Units</span>
        <span className="add-sale-totals__value add-sale-totals__value--green">{totalUnitsText}</span>
      </div>

      <div className="add-sale-totals__item add-sale-totals__item--soft-blue">
        <span className="add-sale-totals__label">Total Amount</span>
        <span className="add-sale-totals__value add-sale-totals__value--blue">{totalAmountText}</span>
      </div>
    </div>
  );
};

export default SaleTotalsPreview;
