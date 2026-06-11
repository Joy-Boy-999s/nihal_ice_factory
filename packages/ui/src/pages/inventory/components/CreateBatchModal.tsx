import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../../components/Modal/Modal';
import { IceTypeService, PlantService } from '@nihal-ice-factory/shared-services';
import { buildAuthConfig } from '../../../lib/auth';

interface IceTypeOption { id: number; iceTypeName: string; plantUnit: string; }

interface CreateBatchModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: CreateBatchForm) => Promise<void>;
}

export interface CreateBatchForm {
  plantUnit:           string;
  iceTypeId:           number;
  batchLabel:          string;
  rows:                number;
  cols:                number;
  productionStartedAt: string;
  readyAt:             string;
  shelfLifeHours:      number;
  notes:               string;
}

const EMPTY: CreateBatchForm = {
  plantUnit:           '',
  iceTypeId:           0,
  batchLabel:          '',
  rows:                5,
  cols:                10,
  productionStartedAt: '',
  readyAt:             '',
  shelfLifeHours:      24,
  notes:               '',
};

export const CreateBatchModal: React.FC<CreateBatchModalProps> = ({ open, onClose, onConfirm }) => {
  const iceTypeSvc = useMemo(() => new IceTypeService(), []);
  const plantSvc   = useMemo(() => new PlantService(), []);

  const [form, setForm]       = useState<CreateBatchForm>(EMPTY);
  const [errors, setErrors]   = useState<Partial<Record<keyof CreateBatchForm | 'general', string>>>({});
  const [saving, setSaving]   = useState(false);
  const [plants, setPlants]   = useState<{ label: string; value: string }[]>([]);
  const [iceTypes, setIceTypes] = useState<IceTypeOption[]>([]);

  useEffect(() => {
    if (!open) return;
    const cfg = buildAuthConfig();
    Promise.all([plantSvc.getActivePlants(cfg), iceTypeSvc.getAllIceTypes(cfg)]).then(([pr, ir]) => {
      const pRaw = (pr?.data as any)?.data ?? pr?.data ?? [];
      setPlants(
        (Array.isArray(pRaw) ? pRaw : []).map((p: any) => ({ label: p.plantName, value: p.plantName }))
      );
      const iRaw = (ir?.data as any)?.data ?? ir?.data ?? [];
      setIceTypes(Array.isArray(iRaw) ? iRaw as IceTypeOption[] : []);
    }).catch(() => {});
  }, [open, plantSvc, iceTypeSvc]);

  const filteredTypes = useMemo(
    () => iceTypes.filter((t) => !form.plantUnit || t.plantUnit === form.plantUnit),
    [iceTypes, form.plantUnit],
  );

  const set = <K extends keyof CreateBatchForm>(k: K, v: CreateBatchForm[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined, general: undefined }));
  };

  const validate = () => {
    const errs: typeof errors = {};
    if (!form.plantUnit)          errs.plantUnit   = 'Select a plant';
    if (!form.iceTypeId)          errs.iceTypeId   = 'Select an ice type';
    if (!form.batchLabel.trim())  errs.batchLabel  = 'Required';
    if (form.rows < 1 || form.rows > 50)    errs.rows = 'Must be 1–50';
    if (form.cols < 1 || form.cols > 50)    errs.cols = 'Must be 1–50';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onConfirm(form);
      setForm(EMPTY);
      setErrors({});
    } catch (err) {
      setErrors({ general: err instanceof Error ? err.message : 'Failed to create batch' });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    setForm(EMPTY); setErrors({});
    onClose();
  };

  const totalSlots = form.rows * form.cols;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add New Ice Batch"
      size="lg"
      closeOnBackdrop={!saving}
      footer={
        <div className="sell-modal__footer">
          <button className="sell-modal__btn sell-modal__btn--cancel" onClick={handleClose} disabled={saving} type="button">Cancel</button>
          <button className="sell-modal__btn sell-modal__btn--confirm" form="batch-form" type="submit" disabled={saving}>
            {saving ? 'Creating…' : `Create Batch (${totalSlots} slots)`}
          </button>
        </div>
      }
    >
      <form id="batch-form" onSubmit={handleSubmit} noValidate>
        <div className="sell-modal__grid sell-modal__grid--3">

          {/* Plant */}
          <div className={`sell-modal__field ${errors.plantUnit ? 'sell-modal__field--error' : ''}`}>
            <label className="sell-modal__label">Plant <span>*</span></label>
            <select
              className="sell-modal__input"
              value={form.plantUnit}
              onChange={(e) => { set('plantUnit', e.target.value); set('iceTypeId', 0); }}
            >
              <option value="">Select plant</option>
              {plants.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            {errors.plantUnit && <p className="sell-modal__err">{errors.plantUnit}</p>}
          </div>

          {/* Ice Type */}
          <div className={`sell-modal__field ${errors.iceTypeId ? 'sell-modal__field--error' : ''}`}>
            <label className="sell-modal__label">Ice Type <span>*</span></label>
            <select
              className="sell-modal__input"
              value={form.iceTypeId}
              onChange={(e) => set('iceTypeId', Number(e.target.value))}
              disabled={!form.plantUnit}
            >
              <option value={0}>Select ice type</option>
              {filteredTypes.map((t) => <option key={t.id} value={t.id}>{t.iceTypeName}</option>)}
            </select>
            {errors.iceTypeId && <p className="sell-modal__err">{errors.iceTypeId}</p>}
          </div>

          {/* Batch Label */}
          <div className={`sell-modal__field ${errors.batchLabel ? 'sell-modal__field--error' : ''}`}>
            <label className="sell-modal__label">Batch Label <span>*</span></label>
            <input
              className="sell-modal__input"
              value={form.batchLabel}
              onChange={(e) => set('batchLabel', e.target.value)}
              placeholder="e.g. Morning Batch"
            />
            {errors.batchLabel && <p className="sell-modal__err">{errors.batchLabel}</p>}
          </div>

          {/* Grid dimensions */}
          <div className={`sell-modal__field ${errors.rows ? 'sell-modal__field--error' : ''}`}>
            <label className="sell-modal__label">Rows (1–50) <span>*</span></label>
            <input
              className="sell-modal__input"
              type="number"
              min={1} max={50}
              value={form.rows}
              onChange={(e) => set('rows', Number(e.target.value))}
              inputMode="numeric"
            />
            {errors.rows && <p className="sell-modal__err">{errors.rows}</p>}
          </div>

          <div className={`sell-modal__field ${errors.cols ? 'sell-modal__field--error' : ''}`}>
            <label className="sell-modal__label">Columns (1–50) <span>*</span></label>
            <input
              className="sell-modal__input"
              type="number"
              min={1} max={50}
              value={form.cols}
              onChange={(e) => set('cols', Number(e.target.value))}
              inputMode="numeric"
            />
            {errors.cols && <p className="sell-modal__err">{errors.cols}</p>}
          </div>

          <div className="sell-modal__field sell-modal__field--info">
            <label className="sell-modal__label">Total Slots</label>
            <div className="sell-modal__slot-preview">{totalSlots} ice units</div>
          </div>

          {/* Production start */}
          <div className="sell-modal__field">
            <label className="sell-modal__label">Production Started At</label>
            <input
              className="sell-modal__input"
              type="datetime-local"
              value={form.productionStartedAt}
              onChange={(e) => set('productionStartedAt', e.target.value)}
            />
          </div>

          {/* Ready at */}
          <div className="sell-modal__field">
            <label className="sell-modal__label">Ready At (expected)</label>
            <input
              className="sell-modal__input"
              type="datetime-local"
              value={form.readyAt}
              onChange={(e) => set('readyAt', e.target.value)}
            />
          </div>

          {/* Shelf life */}
          <div className="sell-modal__field">
            <label className="sell-modal__label">Shelf Life (hours)</label>
            <input
              className="sell-modal__input"
              type="number"
              min={1} max={168}
              value={form.shelfLifeHours}
              onChange={(e) => set('shelfLifeHours', Number(e.target.value))}
              inputMode="numeric"
            />
          </div>

        </div>

        {/* Notes - full width */}
        <div className="sell-modal__field" style={{ marginTop: '12px' }}>
          <label className="sell-modal__label">Notes</label>
          <textarea
            className="sell-modal__input sell-modal__textarea"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Any additional notes…"
            rows={2}
          />
        </div>

        {errors.general && (
          <div className="sell-modal__general-error">{errors.general}</div>
        )}
      </form>
    </Modal>
  );
};
