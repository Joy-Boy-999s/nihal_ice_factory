import React from 'react';
import './Field.css';

export interface FieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  error?: string | null;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Field: React.FC<FieldProps> = ({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
  className = '',
}) => {
  return (
    <div className={`ui-field ${className}`}>
      {label && (
        <label className="ui-field__label" htmlFor={htmlFor}>
          {label}
          {required && <span className="ui-field__required">*</span>}
        </label>
      )}
      <div className="ui-field__control">{children}</div>
      {error ? (
        <div className="ui-field__error">{error}</div>
      ) : hint ? (
        <div className="ui-field__hint">{hint}</div>
      ) : null}
    </div>
  );
};
