import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InventoryService } from '@nihal-ice-factory/shared-services';
import type { ResponsePayloadRecord } from '@nihal-ice-factory/shared-models';
import { Button, Modal, useToast } from '../../../components';
import { buildAuthConfig } from '../../../lib/auth';
import type { IceBatch, IceSlot, BatchGrid } from '../../inventory/utils/use-inventory';
import type { CustomerOrder } from '../OrdersPage';

interface FulfillModalProps {
  order: CustomerOrder;
  onClose: () => void;
  onFulfilled: () => void;
}

/**
 * Operator picks the exact slots handed to the customer.
 * Strict match: selection must equal the ordered quantity per ice type.
 * Slots already auto-reserved for this order come pre-selected.
 */
export const FulfillModal: React.FC<FulfillModalProps> = ({ order, onClose, onFulfilled }) => {
  const toast = useToast();
  const svc   = useMemo(() => new InventoryService(), []);

  const required = useMemo(
    () => (order.items ?? []).filter((i) => i.quantity > 0),
    [order.items],
  );
  const requiredTypeIds = useMemo(() => new Set(required.map((i) => i.iceTypeId)), [required]);

  const [batches, setBatches]           = useState<IceBatch[]>([]);
  const [activeBatchId, setActiveBatch] = useState<number | null>(null);
  const [grid, setGrid]                 = useState<BatchGrid | null>(null);
  const [gridLoading, setGridLoading]   = useState(false);
  const [loading, setLoading]           = useState(true);
  const [submitting, setSubmitting]     = useState(false);

  /** slotId → iceTypeId of every selected slot (across batches) */
  const [selected, setSelected] = useState<Map<number, number>>(new Map());
  /** batches whose reserved-for-this-order slots were already pre-selected */
  const preselectedBatches = useRef<Set<number>>(new Set());

  /* ── Load the plant's batches relevant to this order ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await svc.listBatches(order.unit, buildAuthConfig());
        if (cancelled) return;
        const env  = res?.data as ResponsePayloadRecord | null;
        const list = (env?.['data'] ?? env) as IceBatch[] | null;
        const relevant = (Array.isArray(list) ? list : []).filter(
          (b) => requiredTypeIds.has(b.iceTypeId) && (b.availableCount > 0 || b.reservedCount > 0),
        );
        setBatches(relevant);
        if (relevant.length > 0) setActiveBatch(relevant[0].id);
      } catch {
        if (!cancelled) toast.error('Failed to load inventory batches');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [svc, order.unit, requiredTypeIds, toast]);

  /* ── Load grid for the active batch ── */
  useEffect(() => {
    if (activeBatchId === null) return;
    let cancelled = false;
    setGridLoading(true);
    (async () => {
      try {
        const res = await svc.getBatchGrid(activeBatchId, buildAuthConfig());
        if (cancelled) return;
        const env  = res?.data as ResponsePayloadRecord | null;
        const data = (env?.['data'] ?? env) as BatchGrid | null;
        if (!data?.batch) throw new Error('Invalid grid');
        setGrid(data);

        // Pre-select slots already held for this order (first visit only)
        if (!preselectedBatches.current.has(activeBatchId)) {
          preselectedBatches.current.add(activeBatchId);
          const held = data.grid.flat().filter(
            (s): s is IceSlot => !!s && s.status === 'reserved' && s.saleId === order.id,
          );
          if (held.length) {
            setSelected((prev) => {
              const next = new Map(prev);
              for (const s of held) next.set(s.id, data.batch.iceTypeId);
              return next;
            });
          }
        }
      } catch {
        if (!cancelled) toast.error('Failed to load batch grid');
      } finally {
        if (!cancelled) setGridLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [svc, activeBatchId, order.id, toast]);

  /* ── Selection helpers ── */
  const selectedCountByType = useMemo(() => {
    const map = new Map<number, number>();
    for (const iceTypeId of selected.values()) {
      map.set(iceTypeId, (map.get(iceTypeId) ?? 0) + 1);
    }
    return map;
  }, [selected]);

  const allMatched = required.every(
    (i) => (selectedCountByType.get(i.iceTypeId) ?? 0) === i.quantity,
  ) && selected.size === required.reduce((s, i) => s + i.quantity, 0);

  const isSelectable = useCallback(
    (slot: IceSlot): boolean =>
      slot.status === 'available' || (slot.status === 'reserved' && slot.saleId === order.id),
    [order.id],
  );

  const toggleSlot = (slot: IceSlot) => {
    if (!grid || !isSelectable(slot)) return;
    const iceTypeId = grid.batch.iceTypeId;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(slot.id)) {
        next.delete(slot.id);
      } else {
        const need = required.find((i) => i.iceTypeId === iceTypeId)?.quantity ?? 0;
        const got  = [...next.values()].filter((t) => t === iceTypeId).length;
        if (got >= need) {
          toast.warning(`Only ${need} needed for ${grid.batch.iceTypeName}`);
          return prev;
        }
        next.set(slot.id, iceTypeId);
      }
      return next;
    });
  };

  const autoPickForBatch = () => {
    if (!grid) return;
    const iceTypeId = grid.batch.iceTypeId;
    const need = required.find((i) => i.iceTypeId === iceTypeId)?.quantity ?? 0;
    setSelected((prev) => {
      const next = new Map(prev);
      let got = [...next.values()].filter((t) => t === iceTypeId).length;
      for (const slot of grid.grid.flat()) {
        if (got >= need) break;
        if (!slot || next.has(slot.id) || !isSelectable(slot)) continue;
        next.set(slot.id, iceTypeId);
        got++;
      }
      return next;
    });
  };

  /* ── Submit ── */
  const handleConfirm = async () => {
    if (!allMatched || submitting) return;
    setSubmitting(true);
    try {
      const res = await svc.fulfillOrder(
        { saleId: order.id, slotIds: [...selected.keys()] },
        buildAuthConfig(),
      );
      if (!res?.status) throw new Error(res?.internalMessage || 'Fulfillment failed');
      toast.success(`Order #${order.id} fulfilled!`);
      onFulfilled();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fulfillment failed');
      setSubmitting(false);
    }
  };

  const onlinePending = order.payMode === 'ONLINE' && order.paymentStatus !== 'PAID';

  return (
    <Modal
      open
      size="lg"
      title={`Fulfill Order #${order.id} — ${order.name}`}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', width: '100%' }}>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleConfirm} loading={submitting} disabled={!allMatched || submitting}>
            Confirm Handover ({selected.size})
          </Button>
        </div>
      }
    >
      <div className="fm-body">
        {onlinePending && (
          <div className="fm-warning">
            Payment for this online order is still <strong>{order.paymentStatus === 'FAILED' ? 'failed' : 'pending'}</strong> — confirm payment before handing over.
          </div>
        )}
        {order.payMode === 'COD' && order.paymentStatus !== 'PAID' && (
          <div className="fm-warning fm-warning--cod">
            Pay-on-delivery order — collect <strong>₹{order.totalAmount}</strong> at handover.
          </div>
        )}

        {/* Required quantities progress */}
        <div className="fm-reqs">
          {required.map((item) => {
            const got = selectedCountByType.get(item.iceTypeId) ?? 0;
            const ok  = got === item.quantity;
            return (
              <span key={item.iceTypeId} className={`fm-req${ok ? ' fm-req--ok' : ''}`}>
                {item.iceTypeName} <b>{got} / {item.quantity}</b>
                {ok && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </span>
            );
          })}
        </div>

        {loading ? (
          <div className="fm-loading">Loading inventory…</div>
        ) : batches.length === 0 ? (
          <div className="fm-loading">
            No batches with stock for this order's ice types at {order.unit}.
            Create a batch in Inventory first.
          </div>
        ) : (
          <>
            {/* Batch tabs */}
            <div className="fm-batches" role="tablist" aria-label="Batches">
              {batches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="tab"
                  aria-selected={activeBatchId === b.id}
                  className={`fm-batch-tab${activeBatchId === b.id ? ' fm-batch-tab--active' : ''}`}
                  onClick={() => setActiveBatch(b.id)}
                >
                  <span className="fm-batch-tab__label">{b.batchLabel}</span>
                  <span className="fm-batch-tab__sub">{b.iceTypeName} · {b.availableCount} avail</span>
                </button>
              ))}
            </div>

            {/* Slot grid */}
            {gridLoading || !grid ? (
              <div className="fm-loading">Loading grid…</div>
            ) : (
              <div className="fm-grid-wrap">
                <div className="fm-grid-tools">
                  <span className="fm-grid-hint">
                    Tap slots handed to the customer — green = available, amber = held for this order
                  </span>
                  <button type="button" className="fm-autopick" onClick={autoPickForBatch}>
                    Auto-pick from this batch
                  </button>
                </div>
                <div className="fm-grid" style={{ gridTemplateColumns: `repeat(${grid.batch.cols}, minmax(34px, 1fr))` }}>
                  {grid.grid.flat().map((slot, idx) => {
                    if (!slot) return <span key={`e${idx}`} className="fm-slot fm-slot--empty" />;
                    const sel = selected.has(slot.id);
                    const mine = slot.status === 'reserved' && slot.saleId === order.id;
                    const selectable = isSelectable(slot);
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={!selectable}
                        className={[
                          'fm-slot',
                          `fm-slot--${slot.status}`,
                          mine ? 'fm-slot--mine' : '',
                          sel ? 'fm-slot--selected' : '',
                        ].filter(Boolean).join(' ')}
                        title={`${slot.slotLabel} — ${slot.status}${mine ? ' (held for this order)' : ''}`}
                        onClick={() => toggleSlot(slot)}
                      >
                        {slot.slotLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
