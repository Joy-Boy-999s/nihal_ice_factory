import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SalesHelpService } from '@nihal-ice-factory/shared-services';
import { Button, Card, Field, Input, PageHeader, Select, useToast } from '../../components';
import { buildAuthConfig, logout } from '../../lib/auth';
import { todayISO, nowHHMM } from '../../lib/date';
import {
  calculateTotal,
  calculateTotalCans,
  formatCurrency,
} from '../../lib/pricing';
import '../home/home.css';

interface SaleForm {
  date: string;
  time: string;
  unit: string;
  name: string;
  mobile: string;
  shop: string;
  cans: string;
  blocks: string;
  pieces: string;
  discount: string;
  soldBy: string;
}

const emptyForm: SaleForm = {
  date: todayISO(),
  time: nowHHMM(),
  unit: '',
  name: '',
  mobile: '',
  shop: '',
  cans: '0',
  blocks: '0',
  pieces: '0',
  discount: '0',
  soldBy: '',
};

const UNIT_OPTIONS = [
  { label: 'Unit 1', value: 'Unit 1' },
  { label: 'Unit 2', value: 'Unit 2' },
  { label: 'Unit 3', value: 'Unit 3' },
];

const MOBILE_RE = /^[6-9]\d{9}$/;

const AddSale: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const salesService = useMemo(() => new SalesHelpService(), []);

  const [form, setForm] = useState<SaleForm>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof SaleForm, string>>>({});
  const [saving, setSaving] = useState(false);

  const setField = <K extends keyof SaleForm>(key: K, value: SaleForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const numericField = (key: keyof SaleForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === '' || /^\d*\.?\d*$/.test(v)) setField(key, v as any);
  };

  const cansN = Number(form.cans) || 0;
  const blocksN = Number(form.blocks) || 0;
  const piecesN = Number(form.pieces) || 0;
  const discountN = Number(form.discount) || 0;
  const totalCans = calculateTotalCans(cansN, blocksN, piecesN);
  const totalAmount = calculateTotal(cansN, blocksN, piecesN, discountN);

  const validate = (): boolean => {
    const errs: Partial<Record<keyof SaleForm, string>> = {};
    if (!form.unit) errs.unit = 'Unit is required';
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.mobile.trim()) errs.mobile = 'Mobile is required';
    else if (!MOBILE_RE.test(form.mobile)) errs.mobile = 'Enter a valid 10-digit Indian mobile';
    if (!form.shop.trim()) errs.shop = 'Shop is required';
    if (!form.soldBy.trim()) errs.soldBy = 'Sold by is required';
    if (cansN + blocksN + piecesN === 0)
      errs.cans = 'Enter at least one of cans, blocks or pieces';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        date: form.date,
        time: form.time,
        unit: form.unit,
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        shop: form.shop.trim(),
        cans: cansN,
        blocks: blocksN,
        pieces: piecesN,
        discount: discountN,
        totalAmount,
        totalCans,
        soldBy: form.soldBy.trim(),
      };
      const res = await salesService.createSale(payload, buildAuthConfig());
      if (!res.status || (res.errorCode !== 201 && res.errorCode !== 200)) {
        throw new Error(res.internalMessage || 'Create failed');
      }
      toast.success('Sale created');
      navigate('/', { replace: true });
    } catch (err: any) {
      if (err.response?.status === 401) {
        logout();
        toast.error('Session expired. Please sign in again.');
        navigate('/login', { replace: true });
      } else {
        toast.error(err.response?.data?.internalMessage || err.message || 'Create failed');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="home-page">
      <PageHeader
        title="Add Sale"
        subtitle="Record a new sale for the factory"
        actions={
          <Button variant="secondary" onClick={() => navigate('/')}>
            Back to Sales
          </Button>
        }
      />

      <Card title="New Sale">
        <form className="home-form" onSubmit={handleSubmit} noValidate>
          <div className="home-form__row home-form__row--2">
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

          <div className="home-form__section">
            <h4 className="home-form__section-title">Customer Information</h4>
            <div className="home-form__row home-form__row--3">
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
          </div>

          <div className="home-form__section">
            <h4 className="home-form__section-title">Sale Details</h4>
            <div className="home-form__row home-form__row--3">
              <Field label="Unit" required error={errors.unit}>
                <Select
                  value={form.unit}
                  onChange={(e) => setField('unit', e.target.value)}
                  options={UNIT_OPTIONS}
                  placeholder="Select unit"
                  invalid={!!errors.unit}
                />
              </Field>
              <Field label="Cans" error={errors.cans}>
                <Input value={form.cans} onChange={numericField('cans')} inputMode="numeric" />
              </Field>
              <Field label="Blocks">
                <Input value={form.blocks} onChange={numericField('blocks')} inputMode="numeric" />
              </Field>
              <Field label="Pieces">
                <Input value={form.pieces} onChange={numericField('pieces')} inputMode="numeric" />
              </Field>
              <Field label="Discount">
                <Input value={form.discount} onChange={numericField('discount')} inputMode="numeric" />
              </Field>
              <Field label="Sold By" required error={errors.soldBy}>
                <Input
                  value={form.soldBy}
                  onChange={(e) => setField('soldBy', e.target.value)}
                  invalid={!!errors.soldBy}
                />
              </Field>
            </div>
          </div>

          <div className="home-form__preview">
            <div className="home-form__preview-item">
              <span className="home-form__preview-label">Total Cans</span>
              <span className="home-form__preview-value home-form__preview-value--green">
                {totalCans.toFixed(2)}
              </span>
            </div>
            <div className="home-form__preview-item">
              <span className="home-form__preview-label">Total Amount</span>
              <span className="home-form__preview-value home-form__preview-value--blue">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          <div className="home-form__actions">
            <Button variant="secondary" type="button" onClick={() => navigate('/')}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Create Sale
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default AddSale;
