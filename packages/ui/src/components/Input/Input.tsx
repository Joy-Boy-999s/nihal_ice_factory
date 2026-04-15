import React, { forwardRef } from 'react';
import './Input.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  invalid?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ leftIcon, rightIcon, invalid, size = 'md', className = '', ...rest }, ref) => {
    const classes = [
      'ui-input',
      `ui-input--${size}`,
      invalid ? 'ui-input--invalid' : '',
      leftIcon ? 'ui-input--has-left' : '',
      rightIcon ? 'ui-input--has-right' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={classes}>
        {leftIcon && <span className="ui-input__icon ui-input__icon--left">{leftIcon}</span>}
        <input ref={ref} className="ui-input__control" {...rest} />
        {rightIcon && <span className="ui-input__icon ui-input__icon--right">{rightIcon}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';
