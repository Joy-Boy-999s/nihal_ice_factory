import React, { Suspense, useCallback, useMemo, useState } from 'react';
import { InventoryService } from '@nihal-ice-factory/shared-services';
import { PageHeader } from '../../components';
import { buildAuthConfig, getUserId } from '../../lib/auth';
import { useToast } from '../../components';
import { useInventory, IceBatch, IceSlot } from './utils/use-inventory';
import { BatchCard } from './components/BatchCard';
import { IceGrid } from './components/IceGrid';
import { SellModal, SellFormData } from './components/SellModal';
import { ReserveModal } from './components/ReserveModal';
import { CreateBatchModal, CreateBatchForm } from './components/CreateBatchModal';
import { MarkReadyModal, SetNextBatchModal } from './components/BatchActionsModal';
import './styles/inventory.css';

const InventoryPage: React.FC = () => {
  const toast = useToast();
  const svc   = useMemo(() => new InventoryService(), []);
  const userId = getUserId() ?? 'unknown';

  const {
    batches, summary, stats, expiringBatches,
    selectedBatchId, gridData, gridLoading,
    loading, refreshing, error, lastUpdated,
    selectBatch, refreshGrid, refresh,
  } = useInventory();

  // ── Modal state ────────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen]       = useState(false);
  const [sellSlots,  setSellSlots]        = useState<IceSlot[]>([]);
  const [reserveSlots, setReserveSlots]   = useState<IceSlot[]>([]);
  const [readyBatch, setReadyBatch]       = useState<IceBatch | null>(null);
  const [nextBatch,  setNextBatch]        = useState<IceBatch | null>(null);

  // ── Plant filter ───────────────────────────────────────────────────────────
  const [plantFilter, setPlantFilter] = useState<string>('');
  const allPlants = useMemo(
    () => [...new Set(batches.map((b) => b.plantUnit))].sort(),
    [batches],
  );

  const visibleBatches = useMemo(
    () => plantFilter ? batches.filter((b) => b.plantUnit === plantFilter) : batches,
    [batches, plantFilter],
  );

  // ── Summary map ────────────────────────────────────────────────────────────
  const summaryMap = useMemo(
    () => new Map(summary.map((s) => [s.batchId, s])),
    [summary],
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCreateBatch = useCallback(async (form: CreateBatchForm) => {
    const cfg = buildAuthConfig();
    const payload = {
      ...form,
      productionStartedAt: form.productionStartedAt ? new Date(form.productionStartedAt).toISOString() : undefined,
      readyAt:             form.readyAt             ? new Date(form.readyAt).toISOString()             : undefined,
    };
    const res = await svc.createBatch(payload, cfg);
    if (!res?.status) throw new Error((res as any)?.internalMessage || 'Create failed');
    toast.success('Batch created');
    setCreateOpen(false);
    refresh();
  }, [svc, toast, refresh]);

  const handleSellSlots = useCallback(async (data: SellFormData) => {
    const cfg = buildAuthConfig();
    const now = new Date();
    const res = await svc.sellSlots({
      slotIds:        sellSlots.map((s) => s.id),
      customerName:   data.customerName,
      customerMobile: data.customerMobile,
      shopName:       data.shopName,
      discount:       data.discount,
      soldBy:         data.soldBy,
      date:           now.toISOString().split('T')[0],
      time:           now.toTimeString().slice(0, 5),
    }, cfg);
    if (!res?.status) throw new Error((res as any)?.internalMessage || 'Sale failed');
    toast.success(`${sellSlots.length} slot(s) sold`);
    setSellSlots([]);
    refreshGrid();
    refresh();
  }, [svc, sellSlots, toast, refreshGrid, refresh]);

  const handleReserveSlots = useCallback(async (reservedFor: string, minutes: number) => {
    const res = await svc.reserveSlots({ slotIds: reserveSlots.map((s) => s.id), reservedFor, expiresInMinutes: minutes }, buildAuthConfig());
    if (!res?.status) throw new Error((res as any)?.internalMessage || 'Reserve failed');
    toast.success(`${reserveSlots.length} slot(s) reserved for ${reservedFor}`);
    setReserveSlots([]);
    refreshGrid();
    refresh();
  }, [svc, reserveSlots, toast, refreshGrid, refresh]);

  const handleReleaseSlots = useCallback(async (slots: IceSlot[]) => {
    const res = await svc.releaseSlots({ slotIds: slots.map((s) => s.id) }, buildAuthConfig());
    if (!res?.status) throw new Error('Release failed');
    toast.success(`${slots.length} reservation(s) released`);
    refreshGrid();
    refresh();
  }, [svc, toast, refreshGrid, refresh]);

  const handleMarkDamaged = useCallback(async (slots: IceSlot[]) => {
    const note = window.prompt('Damage reason (optional):') ?? '';
    const res = await svc.markDamaged({ slotIds: slots.map((s) => s.id), damageNote: note }, buildAuthConfig());
    if (!res?.status) throw new Error('Mark damaged failed');
    toast.success(`${slots.length} slot(s) marked as damaged`);
    refreshGrid();
    refresh();
  }, [svc, toast, refreshGrid, refresh]);

  const handleMarkReady = useCallback(async (batchId: number, readyAt: string, shelfHours: number) => {
    const res = await svc.markBatchReady(batchId, { readyAt, shelfLifeHours: shelfHours }, buildAuthConfig());
    if (!res?.status) throw new Error('Failed to mark ready');
    toast.success('Batch marked as ready');
    setReadyBatch(null);
    refresh();
  }, [svc, toast, refresh]);

  const handleSetNextBatch = useCallback(async (batchId: number, estimatedAt: string, notes: string) => {
    const res = await svc.setNextBatch(batchId, { estimatedNextBatchAt: estimatedAt, notes }, buildAuthConfig());
    if (!res?.status) throw new Error('Failed to set next batch');
    toast.success('Next batch countdown set');
    setNextBatch(null);
    refresh();
  }, [svc, toast, refresh]);

  // ── Sell-price lookup for selected slots ───────────────────────────────────
  const sellPricePerUnit = useMemo(() => {
    if (!sellSlots.length || !gridData) return 0;
    const batchId = sellSlots[0].batchId;
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) return 0;
    const summ = summaryMap.get(batchId);
    return summ ? 0 : 0; // price comes from iceType — backend resolves it; show 0 here
  }, [sellSlots, gridData, batches, summaryMap]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="inv-page">
      {/* Page header */}
      <PageHeader
        title="Ice Inventory"
        subtitle={lastUpdated ? `Live view · updated ${lastUpdated}` : 'Live ice availability across all plants'}
        actions={
          <div className="inv-page__toolbar">
            {lastUpdated && (
              <span className="inv-page__live-chip">
                <span className="inv-page__live-dot" />
                LIVE
              </span>
            )}
            <button className="inv-page__refresh-btn" onClick={refresh} disabled={refreshing} title="Refresh">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 .49-3.3"/>
              </svg>
            </button>
            <button className="inv-page__new-btn" onClick={() => setCreateOpen(true)}>
              + New Batch
            </button>
          </div>
        }
      />

      {/* Error banner */}
      {error && (
        <div className="inv-page__error" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Expiry alert */}
      {expiringBatches.length > 0 && (
        <div className="inv-page__expiry-alert" role="alert">
          <span className="inv-page__expiry-icon">⚠</span>
          <div>
            <strong>{expiringBatches.length} batch{expiringBatches.length > 1 ? 'es' : ''} expiring soon</strong>
            <span className="inv-page__expiry-list">
              {expiringBatches.map((b) => b.batchLabel).join(', ')}
            </span>
          </div>
        </div>
      )}

      {/* Stats strip */}
      <div className="inv-page__stats">
        <div className="inv-stat inv-stat--total">
          <span className="inv-stat__value">{stats.total}</span>
          <span className="inv-stat__label">Total Slots</span>
        </div>
        <div className="inv-stat inv-stat--available">
          <span className="inv-stat__value">{stats.available}</span>
          <span className="inv-stat__label">Available</span>
        </div>
        <div className="inv-stat inv-stat--reserved">
          <span className="inv-stat__value">{stats.reserved}</span>
          <span className="inv-stat__label">Reserved</span>
        </div>
        <div className="inv-stat inv-stat--sold">
          <span className="inv-stat__value">{stats.sold}</span>
          <span className="inv-stat__label">Sold</span>
        </div>
        {stats.damaged > 0 && (
          <div className="inv-stat inv-stat--damaged">
            <span className="inv-stat__value">{stats.damaged}</span>
            <span className="inv-stat__label">Damaged</span>
          </div>
        )}
      </div>

      {/* Plant filter */}
      {allPlants.length > 1 && (
        <div className="inv-page__filter">
          <button
            className={`inv-filter-btn ${!plantFilter ? 'inv-filter-btn--active' : ''}`}
            onClick={() => setPlantFilter('')}
          >
            All Plants
          </button>
          {allPlants.map((p) => (
            <button
              key={p}
              className={`inv-filter-btn ${plantFilter === p ? 'inv-filter-btn--active' : ''}`}
              onClick={() => setPlantFilter(p)}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Batch cards + Grid area */}
      {loading && !batches.length ? (
        <div className="inv-page__skeleton-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="inv-skeleton-card" />
          ))}
        </div>
      ) : visibleBatches.length === 0 ? (
        <div className="inv-page__empty">
          <div className="inv-page__empty-icon">🧊</div>
          <h3>No batches yet</h3>
          <p>Add your first ice batch to start tracking inventory</p>
          <button className="inv-page__new-btn inv-page__new-btn--lg" onClick={() => setCreateOpen(true)}>
            + Add First Batch
          </button>
        </div>
      ) : (
        <div className="inv-page__main">
          {/* Batch card list */}
          <div className="inv-page__batch-list">
            {visibleBatches.map((batch) => (
              <BatchCard
                key={batch.id}
                batch={batch}
                summary={summaryMap.get(batch.id)}
                selected={selectedBatchId === batch.id}
                onSelect={selectBatch}
                onMarkReady={setReadyBatch}
                onSetNextBatch={setNextBatch}
              />
            ))}
          </div>

          {/* Grid panel */}
          {selectedBatchId !== null && (
            <div className="inv-page__grid-panel">
              <div className="inv-page__grid-panel-inner">
                <button
                  className="inv-page__grid-close"
                  onClick={() => selectBatch(null)}
                  title="Close grid"
                  aria-label="Close grid"
                >
                  ×
                </button>

                {gridLoading || !gridData ? (
                  <div className="inv-page__grid-loading">
                    <div className="inv-page__grid-loading-dots">
                      <span /><span /><span />
                    </div>
                    <p>Loading grid…</p>
                  </div>
                ) : (
                  <IceGrid
                    data={gridData}
                    loading={gridLoading}
                    onSellSelected={(slots) => setSellSlots(slots)}
                    onReserveSelected={(slots) => setReserveSlots(slots)}
                    onMarkDamaged={handleMarkDamaged}
                    onReleaseSelected={handleReleaseSlots}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      <CreateBatchModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onConfirm={handleCreateBatch}
      />

      <SellModal
        open={sellSlots.length > 0}
        slots={sellSlots}
        pricePerUnit={sellPricePerUnit}
        iceTypeName={gridData?.batch.iceTypeName ?? ''}
        onClose={() => setSellSlots([])}
        onConfirm={handleSellSlots}
      />

      <ReserveModal
        open={reserveSlots.length > 0}
        slots={reserveSlots}
        onClose={() => setReserveSlots([])}
        onConfirm={handleReserveSlots}
      />

      <MarkReadyModal
        open={!!readyBatch}
        batch={readyBatch}
        onClose={() => setReadyBatch(null)}
        onConfirm={handleMarkReady}
      />

      <SetNextBatchModal
        open={!!nextBatch}
        batch={nextBatch}
        onClose={() => setNextBatch(null)}
        onConfirm={handleSetNextBatch}
      />
    </div>
  );
};

export default InventoryPage;
