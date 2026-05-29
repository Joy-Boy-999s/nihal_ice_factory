import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SalesHelpService, IceTypeService, PlantService } from '@nihal-ice-factory/shared-services';
import { IceTypeDto, PlantDto, ResponsePayloadRecord } from '@nihal-ice-factory/shared-models';
import { Button, Card, Field, Input, PageHeader, Select, useToast } from '../../components';
import { buildAuthConfig, logout } from '../../lib/auth';
import {
  buildFormItems,
  calculateTotal,
  calculateTotalUnits,
  formatCurrency,
  getIceTypesForPlant,
} from '../../lib/pricing';
import { createInitialForm } from './utils/constants';
import { isValidNumericInput, validateSaleForm } from './utils/form-helpers';
import { SaleForm, SaleItem } from './model/types';
import './styles/addsale.css';

/** Typed shape for catch-block errors. */
interface CatchError {
  response?: { status?: number; data?: { internalMessage?: string } };
  message?: string;
}

const SaleFormSection = lazy(() => import('./components/SaleFormSection'));
const SaleTotalsPreview = lazy(() => import('./components/SaleTotalsPreview'));
const SalePreviewModal = lazy(() => import('./components/SalePreviewModal'));

// ── Component ────────────────────────────────────────────────────────────

const AddSale: React.FC = () => {
  const navigate    = useNavigate();
  const toast       = useToast();
  const salesService   = useMemo(() => new SalesHelpService(), []);
  const iceTypeService = useMemo(() => new IceTypeService(), []);
  const plantService   = useMemo(() => new PlantService(), []);

  const [form, setForm]       = useState<SaleForm>(createInitialForm());
  const [errors, setErrors]   = useState<ReturnType<typeof validateSaleForm>>({});
  const [saving, setSaving]   = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Full list of ice types from the master.
  const [apiTypes, setApiTypes]           = useState<IceTypeDto[]>([]);
  const [typesLoading, setTypesLoading]   = useState(true);

  // Active plants — backend already scopes this to the user's accessible plants.
  const [activePlants, setActivePlants] = useState<PlantDto[]>([]);

  const unitOptions = useMemo(
    () => activePlants.map((p) => ({ label: p.plantName, value: p.plantName })),
    [activePlants],
  );

  // Active ice types for the currently selected plant.
  const plantTypes = useMemo(
    () => getIceTypesForPlant(apiTypes, form.unit || undefined),
    [apiTypes, form.unit],
  );

  // Fetch ice types + active plants once on mount.
  // getActivePlants is role-aware on the backend — users only receive their accessible plants.
  const fetchTypes = useCallback(async () => {
    setTypesLoading(true);
    try {
      const [typesRes, plantsRes] = await Promise.all([
        iceTypeService.getAllIceTypes(buildAuthConfig()),
        plantService.getActivePlants(buildAuthConfig()),
      ]);

      if (typesRes?.status) {
        const envelope = typesRes.data as ResponsePayloadRecord | null;
        const raw = (envelope?.['data'] ?? envelope) ?? [];
        setApiTypes(Array.isArray(raw) ? (raw as unknown as IceTypeDto[]) : []);
      }

      if (plantsRes?.status) {
        const envelope = plantsRes.data as ResponsePayloadRecord | null;
        const raw = (envelope?.['data'] ?? envelope) ?? [];
        setActivePlants(Array.isArray(raw) ? (raw as unknown as PlantDto[]) : []);
      }
    } catch {
      // Silently fall back — UI will show guidance.
    } finally {
      setTypesLoading(false);
    }
  }, [iceTypeService, plantService]);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  // When the plant changes, rebuild the items array from that plant's ice types.
  const handleUnitChange = (unit: string) => {
    const types = getIceTypesForPlant(apiTypes, unit);
    setForm((prev) => ({
      ...prev,
      unit,
      items: buildFormItems(types),
    }));
    setErrors((prev) => ({ ...prev, unit: undefined, items: undefined }));
  };

  const setField = <K extends keyof SaleForm>(key: K, value: SaleForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  // Update a single item's quantity.
  const setItemQty = (iceTypeId: number, rawValue: string) => {
    if (!isValidNumericInput(rawValue)) return;
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.iceTypeId === iceTypeId ? { ...item, quantity: rawValue } : item,
      ),
    }));
    setErrors((prev) => ({ ...prev, items: undefined }));
  };

  const discountN    = Number(form.discount) || 0;
  const totalUnits   = calculateTotalUnits(form.items);
  const totalAmount  = calculateTotal(form.items, discountN);

  // Whether the item inputs can be interacted with.
  const itemsDisabled = typesLoading || plantTypes.length === 0;

  const validate = (): boolean => {
    const errs = validateSaleForm(form);
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleReview = (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!validate()) return;
    setPreviewOpen(true);
  };

  const handleBackToEdit = () => {
    if (saving) return;
    setPreviewOpen(false);
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    try {
      const payload = {
        date:     form.date,
        time:     form.time,
        unit:     form.unit,
        name:     form.name.trim(),
        mobile:   form.mobile.trim(),
        shop:     form.shop.trim(),
        soldBy:   form.soldBy.trim(),
        discount: discountN,
        items: form.items
          .filter((i) => Number(i.quantity) > 0)
          .map((i) => ({ iceTypeId: i.iceTypeId, quantity: Number(i.quantity) })),
      };

      const res = await salesService.createSale(payload, buildAuthConfig());
      if (!res?.status) throw new Error(res?.internalMessage || 'Create failed');

      toast.success('Sale created');
      setPreviewOpen(false);
      setForm(createInitialForm());
      setErrors({});
    } catch (err) {
      const e = err as CatchError;
      if (e.response?.status === 401) {
        logout();
        toast.error('Session expired. Please sign in again.');
        navigate('/login', { replace: true });
      } else {
        toast.error(e.response?.data?.internalMessage || e.message || 'Create failed');
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Price hint ───────────────────────────────────────────────────────────
  const priceHint = typesLoading
    ? 'Loading ice types…'
    : !form.unit
    ? 'Select a factory plant to load ice types and prices.'
    : plantTypes.length === 0
    ? `No ice types configured for "${form.unit}". Please set up the Ice Type Master first.`
    : `${plantTypes.length} ice type${plantTypes.length > 1 ? 's' : ''} loaded for ${form.unit}.`;

  const canSubmit = !typesLoading && plantTypes.length > 0;

  return (
    <div className="add-sale-page">
      <PageHeader
        title="Add Sale"
        subtitle="Create a new invoice-ready sale record for your ERP workflow"
        actions={
          <Button variant="secondary" onClick={() => navigate('/')}>
            Back to Sales
          </Button>
        }
      />

      <Card title="New Sale Entry">
        <div className="add-sale-shell">
          <p className="add-sale-shell__hint">{priceHint}</p>

          <form className="add-sale-form" onSubmit={handleReview} noValidate>
            {/* Date & Time */}
            <div className="add-sale-grid add-sale-grid--2">
              <Field label="Date" required>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setField('date', e.target.value)}
                />
              </Field>
              <Field label="Time" required>
                <Input
                  type="time"
                  value={form.time}
                  onChange={(e) => setField('time', e.target.value)}
                />
              </Field>
            </div>

            {/* Customer */}
            <Suspense fallback={<div className="add-sale-lazy-placeholder" aria-hidden />}>
              <SaleFormSection
                title="Customer Information"
                description="Capture basic contact and shop details"
              >
                <div className="add-sale-grid add-sale-grid--3">
                  <Field label="Name" required error={errors.name}>
                    <Input
                      value={form.name}
                      onChange={(e) => setField('name', e.target.value)}
                      invalid={!!errors.name}
                    />
                  </Field>
                  <Field label="Mobile" required error={errors.mobile}>
                    <Input
                      value={form.mobile}
                      onChange={(e) => setField('mobile', e.target.value)}
                      invalid={!!errors.mobile}
                      inputMode="numeric"
                      maxLength={10}
                    />
                  </Field>
                  <Field label="Shop" required error={errors.shop}>
                    <Input
                      value={form.shop}
                      onChange={(e) => setField('shop', e.target.value)}
                      invalid={!!errors.shop}
                    />
                  </Field>
                </div>
              </SaleFormSection>
            </Suspense>

            {/* Sale Details */}
            <Suspense fallback={<div className="add-sale-lazy-placeholder" aria-hidden />}>
              <SaleFormSection
                title="Sale Details"
                description={
                  plantTypes.length > 0
                    ? `Enter quantities for each ice type at ${form.unit}`
                    : 'Select a factory plant first to load ice types'
                }
              >
                <div className="add-sale-grid add-sale-grid--3">
                  {/* Plant selector */}
                  <Field label="Unit" required error={errors.unit}>
                    <Select
                      value={form.unit}
                      onChange={(e) => handleUnitChange(e.target.value)}
                      options={unitOptions}
                      placeholder={
                        typesLoading
                          ? 'Loading plants…'
                          : unitOptions.length === 0
                          ? 'No plants in master'
                          : 'Select plant'
                      }
                      invalid={!!errors.unit}
                    />
                  </Field>

                  {/* Dynamic quantity inputs — one per ice type */}
                  {form.items.map((item: SaleItem) => (
                    <Field
                      key={item.iceTypeId}
                      label={`${item.iceTypeName} (₹${item.price})`}
                    >
                      <Input
                        value={item.quantity}
                        onChange={(e) => setItemQty(item.iceTypeId, e.target.value)}
                        inputMode="numeric"
                        disabled={itemsDisabled}
                        placeholder="0"
                      />
                    </Field>
                  ))}

                  {/* Discount — always shown after items */}
                  <Field label="Discount (₹)" error={errors.discount}>
                    <Input
                      value={form.discount}
                      onChange={(e) => {
                        if (isValidNumericInput(e.target.value))
                          setField('discount', e.target.value);
                      }}
                      inputMode="numeric"
                      disabled={itemsDisabled}
                    />
                  </Field>

                  {/* Sold By */}
                  <Field label="Sold By" required error={errors.soldBy}>
                    <Input
                      value={form.soldBy}
                      onChange={(e) => setField('soldBy', e.target.value)}
                      invalid={!!errors.soldBy}
                    />
                  </Field>
                </div>

                {/* Items validation error */}
                {errors.items && (
                  <p style={{ color: 'var(--color-error)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    {errors.items}
                  </p>
                )}
              </SaleFormSection>
            </Suspense>

            {/* Totals */}
            <Suspense fallback={<div className="add-sale-lazy-placeholder" aria-hidden />}>
              <SaleTotalsPreview
                totalUnitsText={`${totalUnits} units`}
                totalAmountText={formatCurrency(totalAmount)}
              />
            </Suspense>

            <div className="add-sale-actions">
              <Button variant="secondary" type="button" onClick={() => navigate('/')}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                Review &amp; Save
              </Button>
            </div>
          </form>
        </div>
      </Card>

      <Suspense fallback={null}>
        {form.items.length > 0 && (
          <SalePreviewModal
            open={previewOpen}
            form={form}
            totalUnits={totalUnits}
            totalAmount={totalAmount}
            saving={saving}
            onEdit={handleBackToEdit}
            onConfirm={handleConfirmSave}
          />
        )}
      </Suspense>
    </div>
  );
};

export default AddSale;
