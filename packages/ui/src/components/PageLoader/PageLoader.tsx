import React, { useId } from 'react';
import './PageLoader.css';

interface PageLoaderProps {
  label?: string;
  /** Covers the entire viewport — for app boot / full-page transitions */
  fullscreen?: boolean;
  /** Compact variant for inside cards and panels */
  size?: 'sm' | 'md';
}

/* ── Six-armed ice crystal, gradient stroke ── */
const Snowflake: React.FC<{ gradientId: string }> = ({ gradientId }) => (
  <svg className="ui-page-loader__flake" viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#818cf8" />
        <stop offset="55%" stopColor="#6366f1" />
        <stop offset="100%" stopColor="#22d3ee" />
      </linearGradient>
    </defs>
    <g stroke={`url(#${gradientId})`} strokeWidth="2.4" strokeLinecap="round" fill="none">
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <g key={deg} transform={`rotate(${deg} 32 32)`}>
          <line x1="32" y1="29" x2="32" y2="8" />
          <line x1="32" y1="13" x2="26.5" y2="8.5" />
          <line x1="32" y1="13" x2="37.5" y2="8.5" />
          <line x1="32" y1="20" x2="27" y2="15.5" />
          <line x1="32" y1="20" x2="37" y2="15.5" />
        </g>
      ))}
    </g>
    <circle cx="32" cy="32" r="3" fill={`url(#${gradientId})`} />
  </svg>
);

export const PageLoader: React.FC<PageLoaderProps> = ({
  label = 'Loading',
  fullscreen = false,
  size = 'md',
}) => {
  const gradientId = `nif-flake-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const text = label.replace(/(\.{2,}|…)\s*$/, '');

  const cls = [
    'ui-page-loader',
    fullscreen ? 'ui-page-loader--fullscreen' : '',
    size === 'sm' ? 'ui-page-loader--sm' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} role="status" aria-live="polite" aria-label={label}>
      <div className="ui-page-loader__stage" aria-hidden="true">
        <span className="ui-page-loader__glow" />
        <span className="ui-page-loader__ring ui-page-loader__ring--outer" />
        <span className="ui-page-loader__ring ui-page-loader__ring--inner" />
        <span className="ui-page-loader__orbit">
          <i className="ui-page-loader__dot ui-page-loader__dot--1" />
          <i className="ui-page-loader__dot ui-page-loader__dot--2" />
          <i className="ui-page-loader__dot ui-page-loader__dot--3" />
        </span>
        <Snowflake gradientId={gradientId} />
        <span className="ui-page-loader__sparkle ui-page-loader__sparkle--1" />
        <span className="ui-page-loader__sparkle ui-page-loader__sparkle--2" />
        <span className="ui-page-loader__sparkle ui-page-loader__sparkle--3" />
        <span className="ui-page-loader__sparkle ui-page-loader__sparkle--4" />
      </div>
      <p className="ui-page-loader__text">
        {text}
        <span className="ui-page-loader__dots"><i>.</i><i>.</i><i>.</i></span>
      </p>
    </div>
  );
};
