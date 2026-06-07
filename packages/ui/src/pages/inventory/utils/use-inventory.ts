import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InventoryService } from '@nihal-ice-factory/shared-services';
import { buildAuthConfig, getToken } from '../../../lib/auth';

// ── Types ──────────────────────────────────────────────────────────────────

export interface IceBatch {
  id: number;
  plantUnit: string;
  iceTypeId: number;
  iceTypeName: string;
  iceTypeCode: string;
  batchLabel: string;
  rows: number;
  cols: number;
  totalSlots: number;
  availableCount: number;
  soldCount: number;
  reservedCount: number;
  damagedCount: number;
  status: 'in_production' | 'ready' | 'sold_out';
  productionStartedAt: string | null;
  readyAt: string | null;
  expiresAt: string | null;
  estimatedNextBatchAt: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

export interface IceSlot {
  id: number;
  batchId: number;
  plantUnit: string;
  rowNumber: number;
  colNumber: number;
  slotLabel: string;
  status: 'available' | 'sold' | 'reserved' | 'damaged';
  saleId: number | null;
  reservedFor: string | null;
  reservedUntil: string | null;
  soldBy: string | null;
  soldAt: string | null;
  damageNote: string | null;
}

export interface BatchGrid {
  batch: IceBatch;
  grid: (IceSlot | null)[][];
  isExpired: boolean;
  isNearExpiry: boolean;
  nextBatchCountdownMs: number | null;
}

export interface AvailabilitySummary {
  batchId: number;
  plantUnit: string;
  batchLabel: string;
  iceTypeName: string;
  status: 'in_production' | 'ready' | 'sold_out';
  availableCount: number;
  reservedCount: number;
  soldCount: number;
  damagedCount: number;
  totalSlots: number;
  readyAt: string | null;
  expiresAt: string | null;
  isExpired: boolean;
  isNearExpiry: boolean;
  nextBatchCountdownMs: number | null;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useInventory() {
  const svc = useMemo(() => new InventoryService(), []);

  const [batches, setBatches]           = useState<IceBatch[]>([]);
  const [summary, setSummary]           = useState<AvailabilitySummary[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [gridData, setGridData]         = useState<BatchGrid | null>(null);
  const [gridLoading, setGridLoading]   = useState(false);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [lastUpdated, setLastUpdated]   = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);

  // ── Fetch batches + summary ─────────────────────────────────────────────

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [batchRes, summaryRes] = await Promise.all([
        svc.listBatches(undefined, buildAuthConfig()),
        svc.getAvailability(buildAuthConfig()),
      ]);
      if (batchRes?.status) {
        const raw = (batchRes.data as any)?.data ?? batchRes.data;
        setBatches(Array.isArray(raw) ? raw : []);
      }
      if (summaryRes?.status) {
        const raw = (summaryRes.data as any)?.data ?? summaryRes.data;
        setSummary(Array.isArray(raw) ? raw : []);
      }
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [svc]);

  // ── Fetch a batch grid ──────────────────────────────────────────────────

  const fetchGrid = useCallback(async (batchId: number) => {
    setGridLoading(true);
    try {
      const res = await svc.getBatchGrid(batchId, buildAuthConfig());
      if (res?.status) {
        const raw = (res.data as any)?.data ?? res.data;
        setGridData(raw as BatchGrid);
      }
    } catch {
      // Grid load failed — keep current view
    } finally {
      setGridLoading(false);
    }
  }, [svc]);

  const selectBatch = useCallback((id: number | null) => {
    setSelectedBatchId(id);
    if (id !== null) fetchGrid(id);
    else setGridData(null);
  }, [fetchGrid]);

  const refreshGrid = useCallback(() => {
    if (selectedBatchId !== null) fetchGrid(selectedBatchId);
  }, [selectedBatchId, fetchGrid]);

  // ── SSE live stream ─────────────────────────────────────────────────────

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const url = svc.getStreamUrl(token);
    const es  = new EventSource(url);
    esRef.current = es;

    es.addEventListener('inventory', (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data);
        const raw = parsed?.data?.data ?? parsed?.data ?? [];
        if (Array.isArray(raw)) {
          setSummary(raw);
          setLastUpdated(new Date().toLocaleTimeString());
        }
      } catch { /* ignore parse errors */ }
    });

    es.onerror = () => {
      // SSE will auto-reconnect; don't surface as error
    };

    return () => { es.close(); esRef.current = null; };
  }, [svc]);

  // Initial load
  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Aggregate stats from summary ────────────────────────────────────────

  const stats = useMemo(() => {
    const totals = summary.reduce(
      (acc, b) => ({
        total:     acc.total     + b.totalSlots,
        available: acc.available + b.availableCount,
        reserved:  acc.reserved  + b.reservedCount,
        sold:      acc.sold      + b.soldCount,
        damaged:   acc.damaged   + b.damagedCount,
      }),
      { total: 0, available: 0, reserved: 0, sold: 0, damaged: 0 },
    );
    return totals;
  }, [summary]);

  const expiringBatches = useMemo(
    () => summary.filter((b) => (b.isNearExpiry || b.isExpired) && b.availableCount > 0),
    [summary],
  );

  return {
    batches,
    summary,
    stats,
    expiringBatches,
    selectedBatchId,
    gridData,
    gridLoading,
    loading,
    refreshing,
    error,
    lastUpdated,
    selectBatch,
    refreshGrid,
    refresh: () => fetchAll(true),
    reload:  () => fetchAll(false),
  };
}
