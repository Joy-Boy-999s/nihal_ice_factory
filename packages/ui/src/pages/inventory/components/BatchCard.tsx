import React, { useEffect, useRef, useState } from 'react';
import { IceBatch, AvailabilitySummary } from '../utils/use-inventory';

interface BatchCardProps {
  batch: IceBatch;
  summary?: AvailabilitySummary;
  selected: boolean;
  onSelect: (id: number) => void;
  onMarkReady: (batch: IceBatch) => void;
  onSetNextBatch: (batch: IceBatch) => void;
}

function formatCountdown(ms: number | null): string {
  if (ms === null || ms <= 0) return '';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const BatchCard: React.FC<BatchCardProps> = ({
  batch, summary, selected, onSelect, onMarkReady, onSetNextBatch,
}) => {
  const [countdown, setCountdown] = useState<number | null>(summary?.nextBatchCountdownMs ?? null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick countdown every minute
  useEffect(() => {
    if (!summary?.nextBatchCountdownMs) { setCountdown(null); return; }
    const target = Date.now() + summary.nextBatchCountdownMs;
    setCountdown(target - Date.now());
    timerRef.current = setInterval(() => {
      const remaining = target - Date.now();
      if (remaining <= 0) {
        setCountdown(0);
        clearInterval(timerRef.current!);
      } else {
        setCountdown(remaining);
      }
    }, 30_000);
    return () => clearInterval(timerRef.current!);
  }, [summary?.nextBatchCountdownMs]);

  const total     = batch.totalSlots;
  const available = summary?.availableCount ?? batch.availableCount;
  const sold      = summary?.soldCount      ?? batch.soldCount;
  const reserved  = summary?.reservedCount  ?? batch.reservedCount;
  const damaged   = summary?.damagedCount   ?? batch.damagedCount;

  const availPct  = total ? Math.round((available / total) * 100) : 0;
  const soldPct   = total ? Math.round((sold      / total) * 100) : 0;
  const resvPct   = total ? Math.round((reserved  / total) * 100) : 0;

  const isExpired    = summary?.isExpired    ?? false;
  const isNearExpiry = summary?.isNearExpiry ?? false;

  const statusLabel =
    batch.status === 'ready'         ? 'Ready'
    : batch.status === 'sold_out'    ? 'Sold Out'
    : 'In Production';

  const statusMod =
    batch.status === 'ready'         ? 'ready'
    : batch.status === 'sold_out'    ? 'sold-out'
    : 'production';

  return (
    <div
      className={[
        'batch-card',
        selected         ? 'batch-card--selected'    : '',
        isExpired        ? 'batch-card--expired'     : '',
        isNearExpiry     ? 'batch-card--near-expiry' : '',
      ].filter(Boolean).join(' ')}
      onClick={() => onSelect(batch.id)}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(batch.id)}
    >
      {/* Header */}
      <div className="batch-card__header">
        <div className="batch-card__title-row">
          <span className="batch-card__label">{batch.batchLabel}</span>
          <span className={`batch-card__status batch-card__status--${statusMod}`}>
            {statusLabel}
          </span>
        </div>
        <div className="batch-card__sub">
          <span className="batch-card__plant">{batch.plantUnit}</span>
          <span className="batch-card__dot">·</span>
          <span className="batch-card__type">{batch.iceTypeName}</span>
          <span className="batch-card__dot">·</span>
          <span className="batch-card__grid-size">{batch.rows}×{batch.cols}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="batch-card__bar-wrap" title={`${available} available, ${sold} sold, ${reserved} reserved`}>
        <div className="batch-card__bar">
          <div className="batch-card__bar-seg batch-card__bar-seg--sold"    style={{ width: `${soldPct}%` }} />
          <div className="batch-card__bar-seg batch-card__bar-seg--reserved" style={{ width: `${resvPct}%` }} />
          <div className="batch-card__bar-seg batch-card__bar-seg--available" style={{ width: `${availPct}%` }} />
        </div>
      </div>

      {/* Count chips */}
      <div className="batch-card__counts">
        <span className="batch-card__count batch-card__count--available">
          <span className="batch-card__count-dot" />
          {available} avail
        </span>
        {reserved > 0 && (
          <span className="batch-card__count batch-card__count--reserved">
            <span className="batch-card__count-dot" />
            {reserved} held
          </span>
        )}
        <span className="batch-card__count batch-card__count--sold">
          <span className="batch-card__count-dot" />
          {sold} sold
        </span>
        {damaged > 0 && (
          <span className="batch-card__count batch-card__count--damaged">
            <span className="batch-card__count-dot" />
            {damaged} dmg
          </span>
        )}
        <span className="batch-card__count batch-card__count--total">{total} total</span>
      </div>

      {/* Times row */}
      <div className="batch-card__times">
        {batch.status === 'ready' && batch.readyAt && (
          <span className="batch-card__time-chip batch-card__time-chip--ready">
            Ready {formatTime(batch.readyAt)}
          </span>
        )}
        {batch.expiresAt && !isExpired && (
          <span className={`batch-card__time-chip ${isNearExpiry ? 'batch-card__time-chip--warning' : ''}`}>
            Exp {formatTime(batch.expiresAt)}
          </span>
        )}
        {isExpired && (
          <span className="batch-card__time-chip batch-card__time-chip--expired">Expired</span>
        )}
        {countdown !== null && countdown > 0 && (
          <span className="batch-card__time-chip batch-card__time-chip--countdown">
            Next: {formatCountdown(countdown)}
          </span>
        )}
        {batch.status === 'in_production' && batch.readyAt && (
          <span className="batch-card__time-chip">
            Ready at {formatDateTime(batch.readyAt)}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="batch-card__actions" onClick={(e) => e.stopPropagation()}>
        <button
          className="batch-card__btn batch-card__btn--grid"
          onClick={() => onSelect(batch.id)}
          title="View ice grid"
        >
          {selected ? 'Hide Grid' : 'View Grid'}
        </button>
        {batch.status === 'in_production' && (
          <button
            className="batch-card__btn batch-card__btn--ready"
            onClick={() => onMarkReady(batch)}
            title="Mark this batch as ready"
          >
            Mark Ready
          </button>
        )}
        {batch.status === 'sold_out' && (
          <button
            className="batch-card__btn batch-card__btn--next"
            onClick={() => onSetNextBatch(batch)}
            title="Set next batch time"
          >
            Set Next Batch
          </button>
        )}
      </div>
    </div>
  );
};
