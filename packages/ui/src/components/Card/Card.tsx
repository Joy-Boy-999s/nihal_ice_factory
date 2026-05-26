import React from 'react';
import './Card.css';

export interface CardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  padded?: boolean;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  actions,
  children,
  padded = true,
  className = '',
}) => {
  return (
    <section className={`ui-card ${className}`}>
      {(title || actions) && (
        <header className="ui-card__header">
          <div className="ui-card__title-block">
            {title && <h3 className="ui-card__title">{title}</h3>}
            {subtitle && <p className="ui-card__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="ui-card__actions">{actions}</div>}
        </header>
      )}
      <div className={`ui-card__body ${padded ? 'ui-card__body--padded' : ''}`}>{children}</div>
    </section>
  );
};
