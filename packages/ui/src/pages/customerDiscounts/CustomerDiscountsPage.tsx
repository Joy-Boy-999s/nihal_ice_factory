import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CustomerDiscountHelpService } from '@nihal-ice-factory/shared-services';
import type { CreateDiscountTierDto, DiscountTier, ResponsePayloadRecord, UpdateDiscountTierDto } from '@nihal-ice-factory/shared-models';
import { Button, Card, Field, Input, Modal, PageHeader, PageLoader, useToast } from '../../components';
import { buildAuthConfig, logout } from '../../lib/auth';
import { formatCurrency } from '../../lib/pricing';
import { PlusIcon, TrashIcon, EditIcon } from '../../layout/nav-icons';
import './styles/customer-discounts.css';

interface TierForm {
  minAmount: string;
  maxAmount: string;
  discountPercent: string;
}

const emptyForm = (): TierForm => ({ minAmount: '', maxAmount: '', discountPercent: '' });

const CustomerDiscountsPage: React.FC = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const svc = useMemo(() => new CustomerDiscountHelpService(), []);

  const [tiers, setTiers] = useState<DiscountTier[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<TierForm>(emptyForm());
  const [addErrors, setAddErrors] = useState<Partial<TierForm>>({});
  const [adding, setAdding] = useState(false);

  const [editModal, setEditModal] = useState<{ open: boolean; tier: DiscountTier | null }>({ open: false, tier: null });
  const [editForm, setEditForm] = useState<TierForm>(emptyForm());
  const [editErrors, setEditErrors] = useState<Partial<TierForm>>({});
  const [editing, setEditing] = useState(false);

  const [deleteModal, setDeleteModal] = useState<{ open: boolean; tier: DiscountTier | null }>({ open: false, tier: null });
  const [deleting, setDeleting] = useState(false);

  const handleAuthError = useCallback((err: unknown): boolean => {
    const e = err as { response?: { status?: number } };
    if (e?.response?.status === 401) {
      logout();
      toast.error('Session expired. Please sign in again.');
      navigate('/login', { replace: true });
      return true;
    }
    return false;
  }, [navigate, toast]);

  const fetchTiers = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const res = await svc.getTiers(customerId, buildAuthConfig());
      if (!res?.status) throw new Error(res?.internalMessage || 'Failed to load tiers');
      const env = res.data as ResponsePayloadRecord | null;
      const list = ((env?.['data'] ?? env) as DiscountTier[] | null);
      setTiers(Array.isArray(list) ? list : []);
    } catch (err) {
      if (!handleAuthError(err)) toast.error('Failed to load discount tiers');
    } finally {
      setLoading(false);
    }
  }, [customerId, svc, handleAuthError, toast]);

  useEffect(() => { fetchTiers(); }, [fetchTiers]);

  const validateForm = (form: TierForm): Partial<TierForm> => {
    const e: Partial<TierForm> = {};
    const min = Number(form.minAmount);
    const max = Number(form.maxAmount);
    const pct = Number(form.discountPercent);
    if (!form.minAmount || isNaN(min) || min < 0) e.minAmount = 'Enter a valid min amount (≥ 0)';
    if (!form.maxAmount || isNaN(max) || max <= 0) e.maxAmount = 'Enter a valid max amount (> 0)';
    else if (max <= min) e.maxAmount = 'Max must be greater than min';
    if (!form.discountPercent || isNaN(pct) || pct <= 0 || pct > 100) e.discountPercent = 'Enter a discount % between 0 and 100';
    return e;
  };

  const handleAdd = async () => {
    const errs = validateForm(addForm);
    if (Object.keys(errs).length) { setAddErrors(errs); return; }
    if (!customerId) return;
    setAdding(true);
    try {
      const dto: CreateDiscountTierDto = {
        customerId,
        minAmount:       Number(addForm.minAmount),
        maxAmount:       Number(addForm.maxAmount),
        discountPercent: Number(addForm.discountPercent),
      };
      const res = await svc.createTier(dto, buildAuthConfig());
      if (!res?.status) throw new Error(res?.internalMessage || 'Failed to create tier');
      toast.success('Discount tier added');
      setAddOpen(false);
      setAddForm(emptyForm());
      await fetchTiers();
    } catch (err) {
      if (!handleAuthError(err)) toast.error('Failed to add tier');
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (tier: DiscountTier) => {
    setEditForm({
      minAmount:       String(tier.minAmount),
      maxAmount:       String(tier.maxAmount),
      discountPercent: String(tier.discountPercent),
    });
    setEditErrors({});
    setEditModal({ open: true, tier });
  };

  const handleEdit = async () => {
    const errs = validateForm(editForm);
    if (Object.keys(errs).length) { setEditErrors(errs); return; }
    if (!editModal.tier) return;
    setEditing(true);
    try {
      const dto: UpdateDiscountTierDto = {
        minAmount:       Number(editForm.minAmount),
        maxAmount:       Number(editForm.maxAmount),
        discountPercent: Number(editForm.discountPercent),
      };
      const res = await svc.updateTier(editModal.tier.id, dto, buildAuthConfig());
      if (!res?.status) throw new Error(res?.internalMessage || 'Failed to update tier');
      toast.success('Discount tier updated');
      setEditModal({ open: false, tier: null });
      await fetchTiers();
    } catch (err) {
      if (!handleAuthError(err)) toast.error('Failed to update tier');
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.tier) return;
    setDeleting(true);
    try {
      const res = await svc.deleteTier(deleteModal.tier.id, buildAuthConfig());
      if (!res?.status) throw new Error(res?.internalMessage || 'Failed to delete tier');
      toast.success('Discount tier deleted');
      setDeleteModal({ open: false, tier: null });
      await fetchTiers();
    } catch (err) {
      if (!handleAuthError(err)) toast.error('Failed to delete tier');
    } finally {
      setDeleting(false);
    }
  };

  const TierFormFields: React.FC<{
    form: TierForm;
    errors: Partial<TierForm>;
    onChange: (key: keyof TierForm, val: string) => void;
  }> = ({ form, errors, onChange }) => (
    <div className="cd-form-grid">
      <Field label="Min Amount (₹)" required error={errors.minAmount}>
        <Input
          value={form.minAmount}
          onChange={(e) => onChange('minAmount', e.target.value)}
          inputMode="decimal"
          placeholder="e.g. 0"
          invalid={!!errors.minAmount}
        />
      </Field>
      <Field label="Max Amount (₹)" required error={errors.maxAmount}>
        <Input
          value={form.maxAmount}
          onChange={(e) => onChange('maxAmount', e.target.value)}
          inputMode="decimal"
          placeholder="e.g. 100"
          invalid={!!errors.maxAmount}
        />
      </Field>
      <Field label="Discount %" required error={errors.discountPercent} style={{ gridColumn: '1 / -1' }}>
        <Input
          value={form.discountPercent}
          onChange={(e) => onChange('discountPercent', e.target.value)}
          inputMode="decimal"
          placeholder="e.g. 5"
          invalid={!!errors.discountPercent}
        />
      </Field>
    </div>
  );

  return (
    <div className="cd-page">
      <PageHeader
        title="Discount Tiers"
        subtitle={`Configure per-order-amount discount tiers for customer ${customerId ?? ''}`}
        actions={
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Button variant="secondary" onClick={() => navigate('/user-management')}>← Back</Button>
            <Button onClick={() => { setAddForm(emptyForm()); setAddErrors({}); setAddOpen(true); }}>
              <PlusIcon width={15} height={15} />
              Add Tier
            </Button>
          </div>
        }
      />

      <Card title={`Tiers (${tiers.length})`} padded={loading || tiers.length === 0}>
        {loading ? (
          <PageLoader size="sm" label="Loading discount tiers" />
        ) : tiers.length === 0 ? (
          <div className="cd-empty">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
              <line x1="19" y1="5" x2="5" y2="19" />
              <circle cx="6.5" cy="6.5" r="2.5" />
              <circle cx="17.5" cy="17.5" r="2.5" />
            </svg>
            <p className="cd-empty__title">No discount tiers configured</p>
            <p className="cd-empty__sub">Orders from this customer will be charged at full price.</p>
            <Button size="sm" onClick={() => { setAddForm(emptyForm()); setAddErrors({}); setAddOpen(true); }}>
              Add First Tier
            </Button>
          </div>
        ) : (
          <div className="cd-table-wrap">
            <table className="cd-table">
              <thead>
                <tr>
                  <th>Order Amount Range</th>
                  <th>Discount</th>
                  <th>Example (₹500 order)</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((tier) => {
                  const pct = Number(tier.discountPercent);
                  const example = Math.round(500 * pct / 100 * 100) / 100;
                  return (
                    <tr key={tier.id}>
                      <td>
                        <span className="cd-range">
                          {formatCurrency(Number(tier.minAmount))} – {formatCurrency(Number(tier.maxAmount))}
                        </span>
                      </td>
                      <td>
                        <span className="cd-pct">{pct}%</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                          Save {formatCurrency(example)}
                        </span>
                      </td>
                      <td>
                        <div className="cd-actions">
                          <Button size="sm" variant="secondary" onClick={() => openEdit(tier)}>
                            <EditIcon width={13} height={13} />
                            Edit
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => setDeleteModal({ open: true, tier })}>
                            <TrashIcon width={13} height={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Add Tier Modal ── */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Discount Tier"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} loading={adding}>Add Tier</Button>
          </>
        }
      >
        <TierFormFields
          form={addForm}
          errors={addErrors}
          onChange={(key, val) => { setAddForm((p) => ({ ...p, [key]: val })); setAddErrors((p) => ({ ...p, [key]: '' })); }}
        />
      </Modal>

      {/* ── Edit Tier Modal ── */}
      <Modal
        open={editModal.open}
        onClose={() => setEditModal({ open: false, tier: null })}
        title="Edit Discount Tier"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditModal({ open: false, tier: null })}>Cancel</Button>
            <Button onClick={handleEdit} loading={editing}>Save Changes</Button>
          </>
        }
      >
        <TierFormFields
          form={editForm}
          errors={editErrors}
          onChange={(key, val) => { setEditForm((p) => ({ ...p, [key]: val })); setEditErrors((p) => ({ ...p, [key]: '' })); }}
        />
      </Modal>

      {/* ── Delete Confirm Modal ── */}
      <Modal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, tier: null })}
        title="Delete Tier"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteModal({ open: false, tier: null })}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>Delete</Button>
          </>
        }
      >
        {deleteModal.tier && (
          <p style={{ color: 'var(--color-text)', lineHeight: 1.6 }}>
            Delete the <strong>{Number(deleteModal.tier.discountPercent)}% discount</strong> tier for orders between{' '}
            <strong>{formatCurrency(Number(deleteModal.tier.minAmount))}</strong> and{' '}
            <strong>{formatCurrency(Number(deleteModal.tier.maxAmount))}</strong>?
            This cannot be undone.
          </p>
        )}
      </Modal>
    </div>
  );
};

export default CustomerDiscountsPage;
