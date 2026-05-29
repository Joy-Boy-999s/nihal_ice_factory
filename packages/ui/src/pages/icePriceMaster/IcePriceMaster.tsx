import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IceTypeService, PlantService } from '@nihal-ice-factory/shared-services';
import {
  IceTypeDto,
  CreateIceTypeDto,
  UpdateIceTypeDto,
  PlantDto,
  ResponsePayloadRecord,
} from '@nihal-ice-factory/shared-models';

/** Minimal typed shape for catch-block errors. */
interface CatchError { message?: string; response?: { status?: number } }

function unwrapData<T>(raw: ResponsePayloadRecord | null | undefined): T | null {
  if (!raw) return null;
  const inner = raw['data'] as ResponsePayloadRecord | T | undefined;
  if (inner !== undefined && inner !== null) {
    const nested = (inner as ResponsePayloadRecord)['data'] as T | undefined;
    return nested !== undefined ? nested : (inner as T);
  }
  return raw as T;
}

import {
  Button,
  Card,
  Column,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  useToast,
} from '../../components';
import { buildAuthConfig, logout, useAuth } from '../../lib/auth';
import { EditIcon, PlusIcon, SearchIcon, TrashIcon } from '../../layout/nav-icons';
import './IcePriceMaster.css';

// ── Types ──────────────────────────────────────────────────────────────────

interface PriceForm {
  iceTypeName: string;
  iceTypeCode: string;
  plantUnit:   string;
  price:       string;
}

type FormErrors = Partial<Record<keyof PriceForm, string>>;

// ── Constants ──────────────────────────────────────────────────────────────

/** Regex for iceTypeCode: letters, digits, dot, underscore, hyphen — no spaces, 2–50 chars. */
const CODE_RE = /^[A-Za-z0-9._-]{2,50}$/;

const emptyForm = (): PriceForm => ({
  iceTypeName: '',
  iceTypeCode: '',
  plantUnit:   '',
  price:       '',
});

const formatINR = (value: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);

// ── Component ──────────────────────────────────────────────────────────────

const IcePriceMaster: React.FC = () => {
  const navigate = useNavigate();
  const toast    = useToast();
  const { role } = useAuth();
  const iceTypeService = useMemo(() => new IceTypeService(), []);
  const plantService   = useMemo(() => new PlantService(), []);

  const [prices, setPrices]   = useState<IceTypeDto[]>([]);
  const [plants, setPlants]   = useState<PlantDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery]     = useState('');

  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState<IceTypeDto | null>(null);
  const [form, setForm]             = useState<PriceForm>(emptyForm());
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [saving, setSaving]         = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; item: IceTypeDto | null }>({
    open: false, item: null,
  });
  const [deleting, setDeleting] = useState(false);

  // ── Auth ──────────────────────────────────────────────────────────────────

  const handleAuthError = useCallback(
    (err: CatchError): boolean => {
      if (err?.response?.status === 401) {
        logout();
        toast.error('Session expired. Please sign in again.');
        navigate('/login', { replace: true });
        return true;
      }
      return false;
    },
    [navigate, toast],
  );

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    try {
      const [typesRes, plantsRes] = await Promise.all([
        iceTypeService.getAllIceTypes(buildAuthConfig()),
        plantService.getAllPlants(buildAuthConfig()),
      ]);

      if (typesRes?.status) {
        const envelope = typesRes.data as ResponsePayloadRecord | null;
        const raw = (envelope?.['data'] ?? envelope) ?? [];
        setPrices(Array.isArray(raw) ? (raw as unknown as IceTypeDto[]) : []);
      } else {
        throw new Error(typesRes?.internalMessage || 'Failed to load types');
      }

      if (plantsRes?.status) {
        const envelope = plantsRes.data as ResponsePayloadRecord | null;
        const raw = (envelope?.['data'] ?? envelope) ?? [];
        setPlants(Array.isArray(raw) ? (raw as unknown as PlantDto[]) : []);
      }
    } catch (err) {
      const e = err as CatchError;
      if (!handleAuthError(e)) {
        toast.error((err instanceof Error ? err.message : null) || 'Failed to load types');
      }
    } finally {
      setLoading(false);
    }
  }, [iceTypeService, plantService, toast, handleAuthError]);

  useEffect(() => { fetchPrices(); }, [fetchPrices]);

  // ── Plant options (from Plant Master) ──────────────────────────────────────

  const existingPlants = useMemo(
    () => plants.filter((p) => p.isActive).map((p) => p.plantName).sort(),
    [plants],
  );

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!query.trim()) return prices;
    const q = query.trim().toLowerCase();
    return prices.filter(
      (p) =>
        p.iceTypeName?.toLowerCase().includes(q) ||
        p.iceTypeCode?.toLowerCase().includes(q) ||
        p.plantUnit?.toLowerCase().includes(q),
    );
  }, [prices, query]);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const active = prices.filter((p) => p.isActive);
    const avgPrice =
      active.length > 0
        ? active.reduce((sum, p) => sum + Number(p.price), 0) / active.length
        : 0;
    const highest = active.reduce(
      (max, p) => (Number(p.price) > max ? Number(p.price) : max),
      0,
    );
    return { total: prices.length, active: active.length, avgPrice, highest };
  }, [prices]);

  // ── Form helpers ───────────────────────────────────────────────────────────

  const setField = (key: keyof PriceForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validateForm = (): boolean => {
    const errs: FormErrors = {};

    if (!form.iceTypeName.trim()) {
      errs.iceTypeName = 'Ice type name is required';
    } else if (form.iceTypeName.trim().length > 50) {
      errs.iceTypeName = 'Must not exceed 50 characters';
    }

    if (!form.iceTypeCode.trim()) {
      errs.iceTypeCode = 'Ice type code is required';
    } else if (!CODE_RE.test(form.iceTypeCode.trim())) {
      errs.iceTypeCode = 'Letters, digits, dot, underscore, hyphen only — no spaces, 2–50 characters';
    }

    if (!form.plantUnit.trim()) {
      errs.plantUnit = 'Plant / Unit is required';
    }

    const price = Number(form.price);
    if (!form.price)                    errs.price = 'Price is required';
    else if (isNaN(price) || price < 0) errs.price = 'Must be a non-negative number';
    else if (price > 99999)             errs.price = 'Price cannot exceed ₹99,999';

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Open modals ────────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (item: IceTypeDto) => {
    setEditing(item);
    setForm({
      iceTypeName: item.iceTypeName,
      iceTypeCode: item.iceTypeCode,
      plantUnit:   item.plantUnit,
      price:       String(item.price),
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setFormErrors({});
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const authConfig = buildAuthConfig();
      if (editing) {
        const dto: UpdateIceTypeDto = {
          iceTypeName: form.iceTypeName.trim(),
          iceTypeCode: form.iceTypeCode.trim(),
          plantUnit:   form.plantUnit.trim(),
          price:       Number(form.price),
        };
        const res = await iceTypeService.updateIceType(editing.id, dto, authConfig);
        if (!res?.status) throw new Error(res?.internalMessage || 'Update failed');
        const updated = unwrapData<IceTypeDto>(res.data as ResponsePayloadRecord) ?? {} as IceTypeDto;
        setPrices((prev) => prev.map((p) => (p.id === editing.id ? { ...p, ...updated } : p)));
        toast.success('Ice type updated successfully');
      } else {
        const dto: CreateIceTypeDto = {
          iceTypeName: form.iceTypeName.trim(),
          iceTypeCode: form.iceTypeCode.trim(),
          plantUnit:   form.plantUnit.trim(),
          price:       Number(form.price),
        };
        const res = await iceTypeService.createIceType(dto, authConfig);
        if (!res?.status) throw new Error(res?.internalMessage || 'Create failed');
        const created = unwrapData<IceTypeDto>(res.data as ResponsePayloadRecord) ?? {} as IceTypeDto;
        setPrices((prev) => [created, ...prev]);
        toast.success('Ice type created successfully');
      }
      closeModal();
    } catch (err) {
      const e = err as CatchError;
      if (!handleAuthError(e)) {
        toast.error((err instanceof Error ? err.message : null) || 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const openDelete = (item: IceTypeDto) => setConfirmDelete({ open: true, item });

  const handleDelete = async () => {
    if (!confirmDelete.item) return;
    setDeleting(true);
    try {
      const res = await iceTypeService.deleteIceType(confirmDelete.item.id, buildAuthConfig());
      if (!res?.status) throw new Error(res?.internalMessage || 'Delete failed');
      setPrices((prev) => prev.filter((p) => p.id !== confirmDelete.item!.id));
      toast.success('Ice type deleted successfully');
    } catch (err) {
      const e = err as CatchError;
      if (!handleAuthError(e)) {
        toast.error((err instanceof Error ? err.message : null) || 'Delete failed');
      }
    } finally {
      setDeleting(false);
      setConfirmDelete({ open: false, item: null });
    }
  };

  // ── Table columns ──────────────────────────────────────────────────────────

  const columns: Column<IceTypeDto>[] = [
    {
      key: 'id',
      title: '#',
      width: 48,
      align: 'center',
      render: (_row, idx) => (
        <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{(idx ?? 0) + 1}</span>
      ),
    },
    {
      key: 'iceTypeName',
      title: 'Name',
      render: (row) => <span className="ipm-type-name">{row.iceTypeName}</span>,
    },
    {
      key: 'iceTypeCode',
      title: 'Code',
      render: (row) => <span className="ipm-type-code">{row.iceTypeCode}</span>,
    },
    {
      key: 'plantUnit',
      title: 'Plant / Unit',
      render: (row) => <span className="ipm-plant-badge">{row.plantUnit}</span>,
    },
    {
      key: 'price',
      title: 'Price',
      align: 'right',
      render: (row) => <span className="ipm-price">{formatINR(Number(row.price))}</span>,
    },
    {
      key: 'isActive',
      title: 'Status',
      render: (row) => (
        <span className={`ipm-badge ${row.isActive ? 'ipm-badge--active' : 'ipm-badge--inactive'}`}>
          <span className="ipm-badge__dot" />
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      align: 'center',
      width: 90,
      render: (row) => (
        <div className="ipm-row-actions">
          <button
            type="button"
            className="ipm-icon-btn"
            onClick={() => openEdit(row)}
            title="Edit"
            aria-label={`Edit ${row.iceTypeName} at ${row.plantUnit}`}
          >
            <EditIcon width={15} height={15} />
          </button>
          <button
            type="button"
            className="ipm-icon-btn ipm-icon-btn--danger"
            onClick={() => openDelete(row)}
            title="Delete"
            aria-label={`Delete ${row.iceTypeName} at ${row.plantUnit}`}
          >
            <TrashIcon width={15} height={15} />
          </button>
        </div>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="ipm-page">
      <PageHeader
        title="Ice Type Master"
        subtitle="Define ice unit types and their selling prices per factory plant. Changes apply to all new sales."
        actions={
          <Button id="add-ice-type-btn" onClick={openAdd} leftIcon={<PlusIcon width={16} height={16} />}>
            Add Ice Type
          </Button>
        }
      />

      {/* Stats */}
      <div className="ipm-stats">
        <div className="ipm-stat">
          <span className="ipm-stat__label">Total Entries</span>
          <span className="ipm-stat__value">{stats.total}</span>
          <span className="ipm-stat__sub">{stats.active} active</span>
        </div>
        <div className="ipm-stat">
          <span className="ipm-stat__label">Avg Price</span>
          <span className="ipm-stat__value">{formatINR(stats.avgPrice)}</span>
          <span className="ipm-stat__sub">across active entries</span>
        </div>
        <div className="ipm-stat">
          <span className="ipm-stat__label">Highest Price</span>
          <span className="ipm-stat__value">{formatINR(stats.highest)}</span>
          <span className="ipm-stat__sub">per unit</span>
        </div>
        <div className="ipm-stat">
          <span className="ipm-stat__label">Role</span>
          <span className="ipm-stat__value" style={{ fontSize: '1rem' }}>{role}</span>
          <span className="ipm-stat__sub">admin access</span>
        </div>
      </div>

      {/* Table card */}
      <Card title="Ice Type List">
        <div className="ipm-toolbar">
          <div className="ipm-toolbar__search">
            <span className="ipm-toolbar__search-icon"><SearchIcon width={15} height={15} /></span>
            <input
              id="ice-type-search"
              type="search"
              className="ipm-toolbar__search-input"
              placeholder="Search by name, code or plant…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search ice types"
            />
          </div>
          <Button id="refresh-types-btn" variant="secondary" onClick={fetchPrices}>Refresh</Button>
        </div>

        {loading ? (
          <div style={{ padding: '1rem 0' }}>
            {[1, 2, 3].map((n) => <div key={n} className="ipm-shimmer-row" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="ipm-empty">
            <div className="ipm-empty__icon"><PlusIcon width={28} height={28} /></div>
            <p className="ipm-empty__title">No ice types found</p>
            <p className="ipm-empty__desc">
              {query ? 'Try a different search term.' : 'Click "Add Ice Type" to create your first entry.'}
            </p>
            {!query && (
              <Button id="add-type-empty-btn" onClick={openAdd}>Add First Ice Type</Button>
            )}
          </div>
        ) : (
          <DataTable<IceTypeDto> columns={columns} data={filtered} rowKey={(r) => r.id} />
        )}
      </Card>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        title={editing ? `Edit — ${editing.iceTypeName} @ ${editing.plantUnit}` : 'Add Ice Type'}
        onClose={closeModal}
      >
        <div className="ipm-form-grid">
          {/* Name */}
          <Field label="Ice Type Name" required error={formErrors.iceTypeName}>
            <Input
              id="ice-type-name"
              value={form.iceTypeName}
              onChange={(e) => setField('iceTypeName', e.target.value)}
              placeholder="e.g. Cans  |  Blocks  |  Pieces"
              invalid={!!formErrors.iceTypeName}
              disabled={saving || !!editing}
            />
            <p className="ipm-form-hint">Human-readable label shown in the sale form and invoices.</p>
          </Field>

          {/* Code */}
          <Field label="Ice Type Code" required error={formErrors.iceTypeCode}>
            <Input
              id="ice-type-code"
              value={form.iceTypeCode}
              onChange={(e) => setField('iceTypeCode', e.target.value)}
              placeholder="e.g. Can  |  Block  |  Piece"
              invalid={!!formErrors.iceTypeCode}
              disabled={saving || !!editing}
            />
            <p className="ipm-form-hint">
              Short system code — letters, digits, dot, underscore, hyphen. No spaces. 2–50 chars.
            </p>
          </Field>

          {/* Plant */}
          <Field label="Plant / Unit" required error={formErrors.plantUnit}>
            <Select
              id="ice-type-plant"
              value={form.plantUnit}
              onChange={(e) => setField('plantUnit', e.target.value)}
              options={existingPlants.map((p) => ({ label: p, value: p }))}
              placeholder={existingPlants.length === 0 ? 'No plants — add in Plant Master first' : 'Select plant'}
              invalid={!!formErrors.plantUnit}
              disabled={saving || !!editing || existingPlants.length === 0}
            />
            <p className="ipm-form-hint">
              Plants are managed in the{' '}
              <a href="/plant-master" style={{ color: 'var(--color-primary)' }}>Plant Master</a>.
            </p>
          </Field>

          {/* Price */}
          <Field label="Price (₹)" required error={formErrors.price} style={{ gridColumn: '1 / -1' } as React.CSSProperties}>
            <Input
              id="ice-type-price"
              value={form.price}
              onChange={(e) => { if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) setField('price', e.target.value); }}
              placeholder="e.g. 240"
              inputMode="decimal"
              invalid={!!formErrors.price}
              disabled={saving}
            />
            <p className="ipm-form-hint">Selling price per unit in Indian Rupees.</p>
          </Field>
        </div>

        <div className="ipm-modal-actions">
          <Button id="cancel-type-modal" variant="secondary" onClick={closeModal} disabled={saving}>Cancel</Button>
          <Button id="save-type-modal" onClick={handleSave} loading={saving}>
            {editing ? 'Update' : 'Create'}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal
        open={confirmDelete.open}
        title="Delete Ice Type"
        onClose={() => setConfirmDelete({ open: false, item: null })}
      >
        <div className="ipm-confirm-body">
          <p className="ipm-confirm-message">
            Are you sure you want to delete{' '}
            <strong>{confirmDelete.item?.iceTypeName}</strong> ({confirmDelete.item?.iceTypeCode}) at{' '}
            <strong>{confirmDelete.item?.plantUnit}</strong>?
            This action cannot be undone. Existing sales will not be affected.
          </p>
          <div className="ipm-confirm-actions">
            <Button id="cancel-delete-type" variant="secondary" onClick={() => setConfirmDelete({ open: false, item: null })} disabled={deleting}>
              Cancel
            </Button>
            <Button id="confirm-delete-type" variant="danger" onClick={handleDelete} loading={deleting}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default IcePriceMaster;
