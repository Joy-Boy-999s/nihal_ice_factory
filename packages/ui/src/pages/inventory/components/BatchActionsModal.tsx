import React, { useState } from 'react';
import { Modal } from '../../../components/Modal/Modal';
import { IceBatch } from '../utils/use-inventory';

interface MarkReadyModalProps {
  open: boolean;
  batch: IceBatch | null;
  onClose: () => void;
  onConfirm: (batchId: number, readyAt: string, shelfHours: number) => Promise<void>;
}

export const MarkReadyModal: React.FC<MarkReadyModalProps> = ({ open, batch, onClose, onConfirm }) => {
  const [readyAt, setReadyAt]     = useState('');
  const [shelfHours, setShelfHours] = useState(24);
  const [error, setError]         = useState('');
  const [saving, setSaving]       = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batch) return;
    setSaving(true);
    setError('');
    try {
      const ts = readyAt ? new Date(readyAt).toISOString() : new Date().toISOString();
      await onConfirm(batch.id, ts, shelfHours);
      setReadyAt(''); setShelfHours(24);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    setReadyAt(''); setShelfHours(24); setError('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Mark Batch Ready"
      size="sm"
      closeOnBackdrop={!saving}
      footer={
        <div className="sell-modal__footer">
          <button className="sell-modal__btn sell-modal__btn--cancel" onClick={handleClose} disabled={saving} type="button">Cancel</button>
          <button className="sell-modal__btn sell-modal__btn--confirm" form="ready-form" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Mark Ready'}
          </button>
        </div>
      }
    >
      {batch && (
        <p className="batch-action-modal__info">
          {batch.batchLabel} · {batch.plantUnit}
        </p>
      )}
      <form id="ready-form" onSubmit={handleSubmit} noValidate>
        <div className="sell-modal__grid">
          <div className="sell-modal__field">
            <label className="sell-modal__label">Ready At (leave blank for now)</label>
            <input
              className="sell-modal__input"
              type="datetime-local"
              value={readyAt}
              onChange={(e) => setReadyAt(e.target.value)}
            />
          </div>
          <div className="sell-modal__field">
            <label className="sell-modal__label">Shelf Life (hours)</label>
            <input
              className="sell-modal__input"
              type="number"
              min={1} max={168}
              value={shelfHours}
              onChange={(e) => setShelfHours(Number(e.target.value))}
              inputMode="numeric"
            />
          </div>
        </div>
        {error && <div className="sell-modal__general-error">{error}</div>}
      </form>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

interface SetNextBatchModalProps {
  open: boolean;
  batch: IceBatch | null;
  onClose: () => void;
  onConfirm: (batchId: number, estimatedAt: string, notes: string) => Promise<void>;
}

export const SetNextBatchModal: React.FC<SetNextBatchModalProps> = ({ open, batch, onClose, onConfirm }) => {
  const [estimatedAt, setEstimatedAt] = useState('');
  const [notes, setNotes]             = useState('');
  const [error, setError]             = useState('');
  const [saving, setSaving]           = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batch || !estimatedAt) { setError('Please set the expected ready time'); return; }
    setSaving(true);
    setError('');
    try {
      await onConfirm(batch.id, new Date(estimatedAt).toISOString(), notes);
      setEstimatedAt(''); setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    setEstimatedAt(''); setNotes(''); setError('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Set Next Batch Time"
      size="sm"
      closeOnBackdrop={!saving}
      footer={
        <div className="sell-modal__footer">
          <button className="sell-modal__btn sell-modal__btn--cancel" onClick={handleClose} disabled={saving} type="button">Cancel</button>
          <button className="sell-modal__btn sell-modal__btn--confirm" form="next-batch-form" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Set Countdown'}
          </button>
        </div>
      }
    >
      {batch && (
        <p className="batch-action-modal__info">
          When will the next batch for <strong>{batch.plantUnit}</strong> be ready?
        </p>
      )}
      <form id="next-batch-form" onSubmit={handleSubmit} noValidate>
        <div className="sell-modal__grid">
          <div className={`sell-modal__field ${error && !estimatedAt ? 'sell-modal__field--error' : ''}`}>
            <label className="sell-modal__label">Expected Ready At <span>*</span></label>
            <input
              className="sell-modal__input"
              type="datetime-local"
              value={estimatedAt}
              onChange={(e) => { setEstimatedAt(e.target.value); setError(''); }}
            />
            {error && !estimatedAt && <p className="sell-modal__err">{error}</p>}
          </div>
          <div className="sell-modal__field">
            <label className="sell-modal__label">Note (optional)</label>
            <input
              className="sell-modal__input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Night shift batch"
            />
          </div>
        </div>
        {error && estimatedAt && <div className="sell-modal__general-error">{error}</div>}
      </form>
    </Modal>
  );
};
