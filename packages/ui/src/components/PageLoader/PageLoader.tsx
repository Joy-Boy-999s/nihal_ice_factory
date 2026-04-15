import React from 'react';
import './PageLoader.css';

interface PageLoaderProps {
  label?: string;
}

export const PageLoader: React.FC<PageLoaderProps> = ({
  label = 'Loading page...'
}) => {
  return (
    <div className="ui-page-loader" role="status" aria-live="polite" aria-label={label}>
      <span className="ui-page-loader__spinner" aria-hidden />
      <p className="ui-page-loader__text">{label}</p>
    </div>
  );
};
