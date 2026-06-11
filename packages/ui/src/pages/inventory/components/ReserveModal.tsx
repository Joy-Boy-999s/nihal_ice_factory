import React, { useState } from 'react';
import { Modal } from '../../../components/Modal/Modal';
import { IceSlot } from '../utils/use-inventory';

interface ReserveModalProps {
  open: boolean;
  slots: IceSlot[];
  onClose: () => void;
  onConfirm: (reservedFor: string, minutes: number) => Promise<void>;
}

export const ReserveModal: React.FC<ReserveModalProps> = ({ open, slots, onClose, onConfirm }) => {
  const [name, setName]       = useState('');
  const [minutes, setMinutes] = useState(30);
  const [error, setError]     = useState('');
  const [saving, setSaving]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Customer name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await onConfirm(name.trim(), minutes);
      setName(''); setMinutes(30); setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reserve');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    setName(''); setMinutes(30); setError('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Reserve Slots"
      size="sm"
      closeOnBackdrop={!saving}
      footer={
        <div className="sell-modal__footer">
          <button className="sell-modal__btn sell-modal__btn--cancel" onClick={handleClose} disabled={saving} type="button">Cancel</button>
          <button className="sell-modal__btn sell-modal__btn--confirm" form="reserve-form" type="submit" disabled={saving}>
            {saving ? 'Reserving…' : `Reserve ${slots.length} Slot${slots.length > 1 ? 's' : ''}`}
          </button>
        </div>
      }
    >
      <div className="sell-modal__slots">
        <div className="sell-modal__slots-header">
          <span className="sell-modal__slots-title">Slots to Reserve</span>
          <span className="sell-modal__slots-count">{slots.length} slots</span>
        </div>
        <div className="sell-modal__slot-chips">
          {slots.map((s) => (
            <span key={s.id} className="sell-modal__slot-chip sell-modal__slot-chip--reserved">{s.slotLabel}</span>
          ))}
        </div>
      </div>

      <hr className="sell-modal__divider" />

      <form id="reserve-form" onSubmit={handleSubmit} noValidate>
        <div className="sell-modal__grid">
          <div className={`sell-modal__field ${error && !name.trim() ? 'sell-modal__field--error' : ''}`}>
            <label className="sell-modal__label">Reserve For <span>*</span></label>
            <input
              className="sell-modal__input"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="Customer / party name"
              autoFocus
            />
            {error && !name.trim() && <p className="sell-modal__err">{error}</p>}
          </div>

          <div className="sell-modal__field">
            <label className="sell-modal__label">Hold Duration</label>
            <select
              className="sell-modal__input"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
              <option value={240}>4 hours</option>
            </select>
          </div>
        </div>

        {error && name.trim() && (
          <div className="sell-modal__general-error">{error}</div>
        )}
      </form>
    </Modal>
  );
};
