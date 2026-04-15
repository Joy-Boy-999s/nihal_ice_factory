import React from 'react';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  block = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  children,
  type = 'button',
  ...rest
}) => {
  const classes = [
    'ui-btn',
    `ui-btn--${variant}`,
    `ui-btn--${size}`,
    block ? 'ui-btn--block' : '',
    loading ? 'ui-btn--loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} disabled={disabled || loading} {...rest}>
      {loading && <span className="ui-btn__spinner" aria-hidden />}
      {!loading && leftIcon && <span className="ui-btn__icon">{leftIcon}</span>}
      {children && <span className="ui-btn__label">{children}</span>}
      {!loading && rightIcon && <span className="ui-btn__icon">{rightIcon}</span>}
    </button>
  );
};
