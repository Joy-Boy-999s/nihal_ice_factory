import React from 'react';

interface SaleFormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

const SaleFormSection: React.FC<SaleFormSectionProps> = ({
  title,
  description,
  children,
}) => {
  return (
    <section className="add-sale-section">
      <div className="add-sale-section__header">
        <h3 className="add-sale-section__title">{title}</h3>
        {description && <p className="add-sale-section__description">{description}</p>}
      </div>
      {children}
    </section>
  );
};

export default SaleFormSection;
