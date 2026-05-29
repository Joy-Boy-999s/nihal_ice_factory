import React, { forwardRef } from 'react';
import './Select.css';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  placeholder?: string;
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, placeholder, invalid, className = '', ...rest }, ref) => {
    const classes = ['ui-select', invalid ? 'ui-select--invalid' : '', className]
      .filter(Boolean)
      .join(' ');
    return (
      <div className={classes}>
        <select ref={ref} className="ui-select__control" {...rest}>
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="ui-select__chevron" aria-hidden>
          ▾
        </span>
      </div>
    );
  }
);
Select.displayName = 'Select';
