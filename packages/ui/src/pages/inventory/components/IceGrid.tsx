import React, { useCallback, useState } from 'react';
import { BatchGrid, IceSlot } from '../utils/use-inventory';

interface IceGridProps {
  data: BatchGrid;
  loading: boolean;
  onSellSelected: (slots: IceSlot[]) => void;
  onReserveSelected: (slots: IceSlot[]) => void;
  onMarkDamaged: (slots: IceSlot[]) => void;
  onReleaseSelected: (slots: IceSlot[]) => void;
}

const STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  sold:      'Sold',
  reserved:  'Reserved',
  damaged:   'Damaged',
};

export const IceGrid: React.FC<IceGridProps> = ({
  data, loading, onSellSelected, onReserveSelected, onMarkDamaged, onReleaseSelected,
}) => {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [tooltip, setTooltip]   = useState<{ slot: IceSlot; x: number; y: number } | null>(null);

  const { batch, grid } = data;

  const toggleSelect = useCallback((slot: IceSlot) => {
    // Only available and reserved slots are selectable
    if (slot.status === 'sold' || slot.status === 'damaged') return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(slot.id) ? next.delete(slot.id) : next.add(slot.id);
      return next;
    });
  }, []);

  const clearSelection = () => setSelected(new Set());

  const selectAllAvailable = () => {
    const ids = grid.flat().filter((s) => s?.status === 'available').map((s) => s!.id);
    setSelected(new Set(ids));
  };

  const getSelectedSlots = (): IceSlot[] =>
    grid.flat().filter((s): s is IceSlot => s !== null && selected.has(s.id));

  const selectedSlots = getSelectedSlots();
  const selectedAvailable  = selectedSlots.filter((s) => s.status === 'available');
  const selectedReserved   = selectedSlots.filter((s) => s.status === 'reserved');
  const hasAvailable       = selectedAvailable.length > 0;
  const hasReserved        = selectedReserved.length > 0;
  const hasSelected        = selected.size > 0;

  const handleSell = () => {
    if (!hasAvailable) return;
    onSellSelected(selectedAvailable);
    clearSelection();
  };

  const handleReserve = () => {
    if (!hasAvailable) return;
    onReserveSelected(selectedAvailable);
    clearSelection();
  };

  const handleDamage = () => {
    if (!hasSelected) return;
    onMarkDamaged(selectedSlots.filter((s) => s.status !== 'sold'));
    clearSelection();
  };

  const handleRelease = () => {
    if (!hasReserved) return;
    onReleaseSelected(selectedReserved);
    clearSelection();
  };

  const handleSlotMouseEnter = (slot: IceSlot, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ slot, x: rect.left + rect.width / 2, y: rect.top });
  };

  const handleSlotMouseLeave = () => setTooltip(null);

  if (loading) {
    return (
      <div className="ice-grid__loading">
        <div className="ice-grid__loading-inner">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="ice-grid__skeleton-slot" />
          ))}
        </div>
        <p className="ice-grid__loading-text">Loading grid…</p>
      </div>
    );
  }

  return (
    <div className="ice-grid">
      {/* Header */}
      <div className="ice-grid__header">
        <div className="ice-grid__header-left">
          <h3 className="ice-grid__title">{batch.batchLabel}</h3>
          <span className="ice-grid__subtitle">{batch.plantUnit} · {batch.iceTypeName} · {batch.rows}×{batch.cols}</span>
        </div>
        <div className="ice-grid__header-right">
          {data.isExpired && (
            <span className="ice-grid__badge ice-grid__badge--expired">Expired</span>
          )}
          {data.isNearExpiry && !data.isExpired && (
            <span className="ice-grid__badge ice-grid__badge--warning">Expiring Soon</span>
          )}
          {data.nextBatchCountdownMs !== null && data.nextBatchCountdownMs > 0 && batch.status === 'sold_out' && (
            <span className="ice-grid__badge ice-grid__badge--countdown">
              Next batch ready
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="ice-grid__legend">
        {(['available', 'sold', 'reserved', 'damaged'] as const).map((s) => (
          <span key={s} className={`ice-grid__legend-item ice-grid__legend-item--${s}`}>
            <span className="ice-grid__legend-dot" />
            {STATUS_LABELS[s]}
          </span>
        ))}
        <span className="ice-grid__legend-hint">Click to select · Shift+click for range</span>
      </div>

      {/* Row labels + Grid */}
      <div className="ice-grid__scroll-wrap">
        <div className="ice-grid__table">
          {/* Column header */}
          <div className="ice-grid__col-header">
            <div className="ice-grid__row-label-spacer" />
            {Array.from({ length: batch.cols }, (_, c) => (
              <div key={c} className="ice-grid__col-num">{c + 1}</div>
            ))}
          </div>

          {/* Rows */}
          {grid.map((row, r) => (
            <div key={r} className="ice-grid__row">
              <div className="ice-grid__row-label">
                {String.fromCharCode(65 + r)}
              </div>
              {row.map((slot, c) => {
                if (!slot) return <div key={c} className="ice-grid__slot ice-grid__slot--empty" />;
                const isSelected = selected.has(slot.id);
                const isSelectable = slot.status === 'available' || slot.status === 'reserved';
                return (
                  <div
                    key={slot.id}
                    className={[
                      'ice-grid__slot',
                      `ice-grid__slot--${slot.status}`,
                      isSelected    ? 'ice-grid__slot--selected'   : '',
                      !isSelectable ? 'ice-grid__slot--unselectable' : '',
                    ].filter(Boolean).join(' ')}
                    role={isSelectable ? 'checkbox' : 'presentation'}
                    aria-checked={isSelected}
                    aria-label={`Slot ${slot.slotLabel} — ${STATUS_LABELS[slot.status]}`}
                    tabIndex={isSelectable ? 0 : -1}
                    onClick={() => toggleSelect(slot)}
                    onKeyDown={(e) => e.key === 'Enter' && isSelectable && toggleSelect(slot)}
                    onMouseEnter={(e) => handleSlotMouseEnter(slot, e)}
                    onMouseLeave={handleSlotMouseLeave}
                  >
                    <span className="ice-grid__slot-label">{slot.slotLabel}</span>
                    {isSelected && <span className="ice-grid__slot-check">✓</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Action bar */}
      <div className={`ice-grid__action-bar ${hasSelected ? 'ice-grid__action-bar--visible' : ''}`}>
        <div className="ice-grid__action-info">
          <strong>{selected.size}</strong> slot{selected.size !== 1 ? 's' : ''} selected
          {hasAvailable  && ` · ${selectedAvailable.length} available`}
          {hasReserved   && ` · ${selectedReserved.length} reserved`}
          <button className="ice-grid__action-clear" onClick={clearSelection}>Clear</button>
        </div>
        <div className="ice-grid__action-btns">
          {hasReserved && (
            <button className="ice-grid__btn ice-grid__btn--release" onClick={handleRelease}>
              Release Hold
            </button>
          )}
          {hasAvailable && (
            <button className="ice-grid__btn ice-grid__btn--reserve" onClick={handleReserve}>
              Reserve
            </button>
          )}
          {hasAvailable && (
            <button className="ice-grid__btn ice-grid__btn--damage" onClick={handleDamage}>
              Mark Damaged
            </button>
          )}
          {hasAvailable && (
            <button className="ice-grid__btn ice-grid__btn--sell" onClick={handleSell}>
              Sell ({selectedAvailable.length})
            </button>
          )}
        </div>
      </div>

      {/* Select-all helper */}
      {batch.availableCount > 0 && (
        <div className="ice-grid__footer">
          <button className="ice-grid__select-all" onClick={selectAllAvailable}>
            Select all available ({batch.availableCount})
          </button>
          {hasSelected && (
            <button className="ice-grid__clear-all" onClick={clearSelection}>
              Clear selection
            </button>
          )}
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="ice-grid__tooltip"
          style={{ left: tooltip.x, top: tooltip.y - 8 }}
        >
          <strong>{tooltip.slot.slotLabel}</strong>
          <span>{STATUS_LABELS[tooltip.slot.status]}</span>
          {tooltip.slot.status === 'sold' && tooltip.slot.soldBy && (
            <span>Sold by {tooltip.slot.soldBy}</span>
          )}
          {tooltip.slot.status === 'reserved' && tooltip.slot.reservedFor && (
            <span>Held for {tooltip.slot.reservedFor}</span>
          )}
          {tooltip.slot.status === 'damaged' && tooltip.slot.damageNote && (
            <span>{tooltip.slot.damageNote}</span>
          )}
        </div>
      )}
    </div>
  );
};
