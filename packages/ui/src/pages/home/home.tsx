import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  CommonResponse,
  IceTypeDto,
  PlantDto,
  SaleUpdateDto,
  ResponsePayloadRecord,
} from '@nihal-ice-factory/shared-models';
import { IceTypeService, PlantService, SalesHelpService } from '@nihal-ice-factory/shared-services';
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
import { todayISO, nowHHMM } from '../../lib/date';
import {
  buildFormItems,
  calculateTotal,
  calculateTotalUnits,
  formatCurrency,
  getIceTypesForPlant,
} from '../../lib/pricing';

// ── Typed helpers ────────────────────────────────────────────────────────────

interface ApiError {
  response?: { status?: number; data?: { internalMessage?: string } };
  message?: string;
}

function toApiError(err: ApiError | Error): ApiError {
  return err instanceof Error ? { message: err.message } : err;
}

// ── Domain types ─────────────────────────────────────────────────────────────

interface SaleItemSnapshot {
  iceTypeId:   number;
  iceTypeName: string;
  iceTypeCode: string;
  quantity:    number;
  price:       number;
  subtotal:    number;
}

interface Sale {
  id:          number;
  unit:        string;
  date:        string;
  time:        string;
  name:        string;
  mobile:      string;
  shop:        string;
  items:       SaleItemSnapshot[];
  discount:    number;
  totalUnits:  number;
  totalAmount: number;
  soldBy:      string;
}

/** One editable line item in the home-page edit modal. */
interface EditItem {
  iceTypeId:   number;
  iceTypeName: string;
  iceTypeCode: string;
  price:       number;
  quantity:    string;
}

interface SaleForm {
  date:     string;
  time:     string;
  unit:     string;
  name:     string;
  mobile:   string;
  shop:     string;
  items:    EditItem[];
  discount: string;
  soldBy:   string;
}

/** Print payload returned by getPrintData. */
interface PrintRecord {
  id?:          number;
  unit?:        string;
  date?:        string;
  time?:        string;
  name?:        string;
  shop?:        string;
  mobile?:      string;
  soldBy?:      string;
  discount?:    number;
  totalUnits?:  number;
  totalAmount?: number;
  itemBreakdown?: {
    iceTypeName: string;
    iceTypeCode: string;
    quantity:    number;
    price:       number;
    subtotal:    number;
  }[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MOBILE_RE = /^[6-9]\d{9}$/;

const emptyForm = (): SaleForm => ({
  date:     todayISO(),
  time:     nowHHMM(),
  unit:     '',
  name:     '',
  mobile:   '',
  shop:     '',
  items:    [],
  discount: '0',
  soldBy:   '',
});

// ── Icons ────────────────────────────────────────────────────────────────────

import {
  PlusIcon,
  DownloadIcon,
  SearchIcon,
  EditIcon,
  PrinterIcon,
  TrashIcon,
  CalendarIcon,
  ClockIcon,
  PersonIcon,
  PhoneIcon,
  StoreIcon,
} from '../../layout/nav-icons';
import './home.css';

// ── Component ────────────────────────────────────────────────────────────────

const Home: React.FC = () => {
  const navigate  = useNavigate();
  const toast     = useToast();
  const { role }  = useAuth();
  const isAdmin   = role === 'ADMIN';

  const salesService   = useMemo(() => new SalesHelpService(), []);
  const iceTypeService = useMemo(() => new IceTypeService(), []);
  const plantService   = useMemo(() => new PlantService(), []);

  const [sales, setSales]           = useState<Sale[]>([]);
  const [loading, setLoading]       = useState(false);
  const [query, setQuery]           = useState('');
  const [apiTypes, setApiTypes]     = useState<IceTypeDto[]>([]);
  const [activePlants, setActivePlants] = useState<PlantDto[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);

  // Plant dropdown options — driven by Plant Master.
  const unitOptions = useMemo(
    () => activePlants.map((p) => ({ label: p.plantName, value: p.plantName })),
    [activePlants],
  );

  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState<Sale | null>(null);
  const [form, setForm]             = useState<SaleForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof SaleForm | 'items', string>>>({});
  const [saving, setSaving]         = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; ids: number[] }>({
    open: false,
    ids: [],
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  const handleAuthError = useCallback(
    (err: ApiError | Error): boolean => {
      if (toApiError(err).response?.status === 401) {
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

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const res: CommonResponse = await salesService.getAllSales(buildAuthConfig());
      if (res?.status && res.errorCode === 200) {
        const envelope = res.data as ResponsePayloadRecord | null;
        const nested   = (envelope?.['data'] ?? envelope) ?? null;
        setSales(Array.isArray(nested) ? (nested as Sale[]) : []);
      } else {
        throw new Error(res?.internalMessage || 'Failed to load sales');
      }
    } catch (err) {
      const e = err as ApiError | Error;
      if (!handleAuthError(e)) toast.error(toApiError(e).message || 'Failed to load sales');
    } finally {
      setLoading(false);
    }
  }, [salesService, toast, handleAuthError]);

  const fetchTypes = useCallback(async () => {
    try {
      const [typesRes, plantsRes] = await Promise.all([
        iceTypeService.getAllIceTypes(buildAuthConfig()),
        plantService.getActivePlants(buildAuthConfig()),
      ]);

      if (typesRes?.status) {
        const envelope = typesRes.data as ResponsePayloadRecord | null;
        const raw      = (envelope?.['data'] ?? envelope) ?? [];
        setApiTypes(Array.isArray(raw) ? (raw as unknown as IceTypeDto[]) : []);
      }

      if (plantsRes?.status) {
        const envelope = plantsRes.data as ResponsePayloadRecord | null;
        const raw      = (envelope?.['data'] ?? envelope) ?? [];
        setActivePlants(Array.isArray(raw) ? (raw as unknown as PlantDto[]) : []);
      }
    } catch {
      // Silently fall back.
    }
  }, [iceTypeService, plantService]);

  useEffect(() => {
    fetchSales();
    fetchTypes();
  }, [fetchSales, fetchTypes]);

  // ── Table filter ──────────────────────────────────────────────────────────

  const filteredSales = useMemo(() => {
    if (!query.trim()) return sales;
    const q = query.trim().toLowerCase();
    return sales.filter(
      (s) =>
        String(s.id).includes(q) ||
        s.name?.toLowerCase().includes(q)   ||
        s.mobile?.toLowerCase().includes(q) ||
        s.shop?.toLowerCase().includes(q)   ||
        s.unit?.toLowerCase().includes(q)   ||
        s.soldBy?.toLowerCase().includes(q),
    );
  }, [sales, query]);

  // ── Live items for the edit modal (derived from selected plant) ───────────

  const modalPlantTypes = useMemo(
    () => getIceTypesForPlant(apiTypes, form.unit || undefined),
    [apiTypes, form.unit],
  );

  // ── Modal helpers ─────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (sale: Sale) => {
    setEditing(sale);
    // Pre-populate items from the existing sale snapshot.
    const existingItems: EditItem[] = (sale.items ?? []).map((snap) => ({
      iceTypeId:   snap.iceTypeId,
      iceTypeName: snap.iceTypeName,
      iceTypeCode: snap.iceTypeCode,
      price:       snap.price,
      quantity:    String(snap.quantity),
    }));
    setForm({
      date:     sale.date    || todayISO(),
      time:     sale.time    || nowHHMM(),
      unit:     sale.unit    || '',
      name:     sale.name    || '',
      mobile:   sale.mobile  || '',
      shop:     sale.shop    || '',
      items:    existingItems,
      discount: String(sale.discount ?? 0),
      soldBy:   sale.soldBy  || '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setFormErrors({});
  };

  const setField = <K extends keyof SaleForm>(key: K, value: SaleForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  // When the unit changes, reload items from the master for that plant.
  const handleUnitChange = (unit: string) => {
    const types = getIceTypesForPlant(apiTypes, unit);
    setForm((prev) => ({
      ...prev,
      unit,
      items: buildFormItems(types),
    }));
    setFormErrors((prev) => ({ ...prev, unit: undefined, items: undefined }));
  };

  const setItemQty = (iceTypeId: number, value: string) => {
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.iceTypeId === iceTypeId ? { ...i, quantity: value } : i,
      ),
    }));
    setFormErrors((prev) => ({ ...prev, items: undefined }));
  };

  const discountN        = Number(form.discount) || 0;
  const previewTotalUnits  = calculateTotalUnits(form.items);
  const previewTotalAmount = calculateTotal(form.items, discountN);

  // ── Validation ────────────────────────────────────────────────────────────

  const validateForm = (): boolean => {
    const errs: typeof formErrors = {};
    if (!form.unit)          errs.unit    = 'Unit is required';
    if (!form.name.trim())   errs.name    = 'Name is required';
    if (!form.shop.trim())   errs.shop    = 'Shop is required';
    if (!form.soldBy.trim()) errs.soldBy  = 'Sold by is required';

    if (!form.mobile.trim())              errs.mobile = 'Mobile is required';
    else if (!MOBILE_RE.test(form.mobile)) errs.mobile = 'Enter a valid 10-digit Indian mobile';

    if (discountN < 0) errs.discount = 'Discount must be non-negative';

    const hasQty = form.items.some((i) => Number(i.quantity) > 0);
    if (form.items.length > 0 && !hasQty) errs.items = 'Enter a quantity for at least one item';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const itemsPayload = form.items
        .filter((i) => Number(i.quantity) > 0)
        .map((i) => ({ iceTypeId: i.iceTypeId, quantity: Number(i.quantity) }));

      if (editing) {
        const updatePayload: SaleUpdateDto = {
          date:     form.date,
          time:     form.time,
          unit:     form.unit,
          name:     form.name.trim(),
          mobile:   form.mobile.trim(),
          shop:     form.shop.trim(),
          soldBy:   form.soldBy.trim(),
          discount: discountN,
          items:    itemsPayload,
        };
        const res = await salesService.updateSale(editing.id, updatePayload, buildAuthConfig());
        if (!res?.status) throw new Error(res?.internalMessage || 'Update failed');

        const envelope = res.data as ResponsePayloadRecord | null;
        const inner    = ((envelope?.['data'] as ResponsePayloadRecord)?.['data'] ?? envelope?.['data'] ?? envelope) as Sale;
        setSales((prev) => prev.map((s) => (s.id === editing.id ? { ...s, ...inner } : s)));
        toast.success('Sale updated');
      } else {
        const createPayload = {
          date:     form.date,
          time:     form.time,
          unit:     form.unit,
          name:     form.name.trim(),
          mobile:   form.mobile.trim(),
          shop:     form.shop.trim(),
          soldBy:   form.soldBy.trim(),
          discount: discountN,
          items:    itemsPayload,
        };
        const res = await salesService.createSale(createPayload, buildAuthConfig());
        if (!res?.status) throw new Error(res?.internalMessage || 'Create failed');

        const envelope  = res.data as ResponsePayloadRecord | null;
        const newSale   = (envelope?.['data'] ?? envelope) as Sale;
        setSales((prev) => [newSale, ...prev]);
        toast.success('Sale created');
      }

      closeModal();
    } catch (err) {
      const e = err as ApiError | Error;
      if (!handleAuthError(e)) {
        toast.error(toApiError(e).response?.data?.internalMessage || toApiError(e).message || 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const doDelete = async (ids: number[]) => {
    if (ids.length === 0) return;
    setLoading(true);
    try {
      const res =
        ids.length === 1
          ? await salesService.deleteSale(ids[0], buildAuthConfig())
          : await salesService.deleteMultiple(ids, buildAuthConfig());
      if (!res.status || res.errorCode !== 200) throw new Error(res.internalMessage || 'Delete failed');
      setSales((prev) => prev.filter((s) => !ids.includes(s.id)));
      setSelectedKeys((prev) => prev.filter((k) => !ids.includes(Number(k))));
      toast.success(ids.length === 1 ? 'Sale deleted' : `${ids.length} sales deleted`);
    } catch (err) {
      const e = err as ApiError | Error;
      if (!handleAuthError(e)) toast.error(toApiError(e).message || 'Delete failed');
    } finally {
      setLoading(false);
      setConfirmDelete({ open: false, ids: [] });
    }
  };

  // ── Invoice ───────────────────────────────────────────────────────────────

  const escapeHtml = (v: string | number | boolean | null | undefined): string =>
    String(v ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const formatInr = (v: number): string =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
      Number.isFinite(v) ? v : 0,
    );

  const buildInvoice = (r: PrintRecord): string => {
    const discount   = Number(r.discount)   || 0;
    const totalUnits = Number(r.totalUnits) || 0;
    const items      = (r.itemBreakdown ?? []).filter((i) => i.quantity > 0);
    const subtotal   = items.reduce((s, i) => s + i.subtotal, 0);
    const grandTotal = Number(r.totalAmount) || Math.max(0, subtotal - discount);

    const itemsHtml = items
      .map(
        (item, idx) => `
          <tr>
            <td class="idx">${idx + 1}</td>
            <td>${escapeHtml(item.iceTypeName)}</td>
            <td class="num">${item.quantity}</td>
            <td class="num">${formatInr(item.price)}</td>
            <td class="num">${formatInr(item.subtotal)}</td>
          </tr>`,
      )
      .join('');

    const invoiceNo    = `NIF-${String(r.id ?? '').padStart(6, '0')}`;
    const generatedAt  = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

    return `
      <section class="invoice">
        <header class="invoice__head">
          <div class="invoice__brand">
            <div class="invoice__logo">NIF</div>
            <div>
              <h1>Nihal Ice Factory</h1>
              <p class="muted">Ice Manufacturing &amp; Distribution</p>
              <p class="muted small">${escapeHtml(r.unit || 'Head Office')}</p>
            </div>
          </div>
          <div class="invoice__meta">
            <div class="invoice__badge">INVOICE</div>
            <table>
              <tr><th>Invoice No.</th><td>${escapeHtml(invoiceNo)}</td></tr>
              <tr><th>Date</th><td>${escapeHtml(r.date || '')}</td></tr>
              <tr><th>Time</th><td>${escapeHtml(r.time || '')}</td></tr>
              <tr><th>Unit</th><td>${escapeHtml(r.unit || '')}</td></tr>
            </table>
          </div>
        </header>

        <div class="invoice__parties">
          <div class="invoice__party">
            <div class="invoice__party-title">Bill To</div>
            <div class="invoice__party-name">${escapeHtml(r.name || '—')}</div>
            <div class="muted">${escapeHtml(r.shop || '')}</div>
            <div class="muted">Mobile: ${escapeHtml(r.mobile || '—')}</div>
          </div>
          <div class="invoice__party invoice__party--right">
            <div class="invoice__party-title">Issued By</div>
            <div class="invoice__party-name">${escapeHtml(r.soldBy || '—')}</div>
            <div class="muted">Nihal Ice Factory</div>
          </div>
        </div>

        <table class="invoice__items">
          <thead>
            <tr>
              <th class="idx">#</th>
              <th>Description</th>
              <th class="num">Qty</th>
              <th class="num">Rate</th>
              <th class="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml || '<tr><td colspan="5" class="muted center">No items</td></tr>'}
          </tbody>
        </table>

        <div class="invoice__summary">
          <div class="invoice__notes">
            <div class="invoice__notes-title">Notes</div>
            <p>Total Units: <strong>${totalUnits}</strong></p>
            <p class="muted small">Goods once sold will not be taken back. Thank you for your business.</p>
          </div>
          <table class="invoice__totals">
            <tr><th>Subtotal</th><td>${formatInr(subtotal)}</td></tr>
            <tr><th>Discount</th><td>− ${formatInr(discount)}</td></tr>
            <tr class="invoice__totals-grand">
              <th>Grand Total</th><td>${formatInr(grandTotal)}</td>
            </tr>
          </table>
        </div>

        <footer class="invoice__foot">
          <div class="invoice__sign">
            <span class="invoice__sign-line"></span>
            <span class="muted small">Authorised Signatory</span>
          </div>
          <div class="invoice__generated muted small">Generated ${escapeHtml(generatedAt)}</div>
        </footer>
      </section>`;
  };

  const generatePrintContent = (records: PrintRecord[]) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Nihal Ice Factory — Invoice</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #f4f6fb;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        color: #0f172a; -webkit-font-smoothing: antialiased; }
      .page { padding: 28px; }
      .invoice { position: relative; max-width: 780px; margin: 0 auto 28px;
        padding: 40px 44px 32px; background: #fff; border-radius: 16px;
        border: 1px solid #e5e7eb; box-shadow: 0 6px 24px rgba(15,23,42,.06);
        page-break-after: always; }
      .invoice:last-child { page-break-after: auto; }
      .invoice::before { content:''; position:absolute; left:0; right:0; top:0; height:6px;
        border-radius:16px 16px 0 0; background:linear-gradient(90deg,#1d4ed8,#3b82f6,#60a5fa); }
      .invoice__head { display:flex; justify-content:space-between; align-items:flex-start; gap:24px;
        padding-bottom:22px; border-bottom:1px solid #e5e7eb; }
      .invoice__brand { display:flex; align-items:center; gap:16px; }
      .invoice__logo { width:56px; height:56px; border-radius:14px;
        background:linear-gradient(135deg,#1d4ed8,#60a5fa); color:#fff; font-weight:700;
        font-size:18px; display:flex; align-items:center; justify-content:center; }
      .invoice__brand h1 { margin:0; font-size:22px; font-weight:700; }
      .invoice__meta { text-align:right; min-width:240px; }
      .invoice__badge { display:inline-block; padding:4px 12px; background:#eff6ff; color:#1d4ed8;
        font-size:11px; font-weight:700; letter-spacing:.12em; border-radius:999px;
        border:1px solid #bfdbfe; margin-bottom:10px; }
      .invoice__meta table { width:100%; border-collapse:collapse; font-size:12px; }
      .invoice__meta th { text-align:right; color:#64748b; font-weight:500; padding:3px 10px 3px 0; white-space:nowrap; }
      .invoice__meta td { text-align:right; color:#0f172a; font-weight:600; padding:3px 0; }
      .invoice__parties { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin:24px 0 20px; }
      .invoice__party { padding:14px 16px; background:#f8fafc; border:1px solid #e5e7eb; border-radius:10px; }
      .invoice__party--right { text-align:right; }
      .invoice__party-title { font-size:10px; font-weight:700; letter-spacing:.12em;
        text-transform:uppercase; color:#64748b; margin-bottom:6px; }
      .invoice__party-name { font-size:15px; font-weight:600; color:#0f172a; margin-bottom:2px; }
      .invoice__items { width:100%; border-collapse:collapse; margin-top:4px; font-size:13px; }
      .invoice__items thead th { background:#0f172a; color:#e2e8f0; font-size:11px; font-weight:600;
        letter-spacing:.06em; text-transform:uppercase; padding:10px 12px; text-align:left; }
      .invoice__items thead th:first-child { border-radius:8px 0 0 8px; }
      .invoice__items thead th:last-child { border-radius:0 8px 8px 0; }
      .invoice__items tbody td { padding:12px; border-bottom:1px solid #eef2f7; color:#0f172a; }
      .invoice__items tbody tr:last-child td { border-bottom:none; }
      .invoice__items .idx { width:36px; color:#94a3b8; }
      .invoice__items .num { text-align:right; white-space:nowrap; }
      .invoice__items .center { text-align:center; }
      .invoice__summary { display:grid; grid-template-columns:1fr 280px; gap:24px; margin-top:24px; }
      .invoice__notes { font-size:12px; color:#334155; }
      .invoice__notes-title { font-size:10px; font-weight:700; letter-spacing:.12em;
        text-transform:uppercase; color:#64748b; margin-bottom:6px; }
      .invoice__notes p { margin:4px 0; }
      .invoice__totals { width:100%; border-collapse:collapse; font-size:13px; }
      .invoice__totals th, .invoice__totals td { padding:8px 12px; }
      .invoice__totals th { text-align:left; color:#64748b; font-weight:500; }
      .invoice__totals td { text-align:right; color:#0f172a; font-weight:600; }
      .invoice__totals-grand { background:linear-gradient(135deg,#1d4ed8,#3b82f6); border-radius:10px; }
      .invoice__totals-grand th, .invoice__totals-grand td { color:#fff; font-size:15px; font-weight:700; }
      .invoice__totals-grand th:first-child { border-radius:10px 0 0 10px; }
      .invoice__totals-grand td:last-child { border-radius:0 10px 10px 0; }
      .invoice__foot { display:flex; justify-content:space-between; align-items:flex-end;
        margin-top:36px; padding-top:20px; border-top:1px dashed #e5e7eb; }
      .invoice__sign { min-width:220px; }
      .invoice__sign-line { display:block; width:180px; height:1px; background:#0f172a; margin-bottom:6px; }
      .muted { color:#64748b; margin:2px 0; font-size:12px; }
      .small { font-size:11px; }
      .center { text-align:center; }
      @media print {
        html, body { background:#fff; }
        .page { padding:0; }
        .invoice { margin:0; border:none; box-shadow:none; border-radius:0; max-width:none; padding:24px 32px; }
        .invoice::before { border-radius:0; }
      }
    </style>
  </head>
  <body><div class="page">${records.map((r) => buildInvoice(r)).join('')}</div></body>
</html>`;

  const openPrintPreview = (html: string) => {
    const existing = document.getElementById('app-print-frame');
    if (existing) existing.remove();
    const frame = document.createElement('iframe');
    frame.id = 'app-print-frame';
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    frame.setAttribute('aria-hidden', 'true');
    document.body.appendChild(frame);
    frame.onload = () => {
      try { frame.contentWindow?.focus(); frame.contentWindow?.print(); }
      catch { toast.error('Print was blocked by the browser'); }
    };
    frame.srcdoc = html;
  };

  const unwrapPrintPayload = (res: CommonResponse): PrintRecord | null => {
    const first = res?.data as ResponsePayloadRecord | null;
    if (!first || typeof first !== 'object') return null;
    const nested = first['data'] as ResponsePayloadRecord | null;
    return (nested && typeof nested === 'object' ? nested : first) as PrintRecord;
  };

  const handlePrint = async (sale: Sale) => {
    try {
      const res = await salesService.getPrintData(sale.id, buildAuthConfig());
      if (!res?.status) throw new Error(res?.internalMessage || 'Failed to fetch print data');
      const payload = unwrapPrintPayload(res);
      if (!payload) throw new Error('Print data was empty');
      openPrintPreview(generatePrintContent([payload]));
    } catch (err) {
      const e = err as ApiError | Error;
      if (!handleAuthError(e)) toast.error(toApiError(e).message || 'Print failed');
    }
  };

  const handleBulkPrint = async () => {
    if (selectedKeys.length === 0) { toast.warning('Select at least one sale to print'); return; }
    try {
      const results = await Promise.all(
        selectedKeys.map((k) => salesService.getPrintData(Number(k), buildAuthConfig())),
      );
      const records = results
        .filter((r) => r?.status)
        .map((r) => unwrapPrintPayload(r))
        .filter((r): r is PrintRecord => r !== null);
      if (records.length === 0) throw new Error('No print data available');
      openPrintPreview(generatePrintContent(records));
    } catch (err) {
      const e = err as ApiError | Error;
      if (!handleAuthError(e)) toast.error(toApiError(e).message || 'Print failed');
    }
  };

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExport = () => {
    const rows = (filteredSales.length ? filteredSales : sales).map((s) => ({
      'Serial No':    s.id,
      Date:           s.date,
      Time:           s.time,
      Unit:           s.unit,
      Name:           s.name,
      Mobile:         s.mobile,
      Shop:           s.shop,
      Items:          (s.items ?? []).map((i) => `${i.iceTypeName}×${i.quantity}`).join(', '),
      'Total Units':  s.totalUnits,
      Discount:       s.discount,
      'Total Amount': s.totalAmount,
      'Sold By':      s.soldBy,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
    XLSX.writeFile(wb, 'sales_data.xlsx');
    toast.success('Exported to Excel');
  };

  // ── Table columns ─────────────────────────────────────────────────────────

  const columns: Column<Sale>[] = useMemo(
    () => [
      { key: 'id',     title: '#',        accessor: 'id',    width: 60, align: 'center' },
      { key: 'date',   title: 'Date',     accessor: 'date',  align: 'left'  },
      { key: 'time',   title: 'Time',     accessor: 'time',  align: 'left'  },
      { key: 'unit',   title: 'Unit',     accessor: 'unit',  align: 'left'  },
      { key: 'name',   title: 'Customer', accessor: 'name',  align: 'left'  },
      { key: 'mobile', title: 'Mobile',   accessor: 'mobile',align: 'left'  },
      { key: 'shop',   title: 'Shop',     accessor: 'shop',  align: 'left'  },
      {
        key: 'items',
        title: 'Items',
        align: 'left',
        render: (row) => {
          const summary = (row.items ?? [])
            .filter((i) => i.quantity > 0)
            .map((i) => `${i.iceTypeName}×${i.quantity}`)
            .join(', ');
          return <span title={summary}>{summary || '—'}</span>;
        },
      },
      { key: 'totalUnits', title: 'Total Units', accessor: 'totalUnits', align: 'right' },
      { key: 'discount',   title: 'Discount',    accessor: 'discount',   align: 'right' },
      {
        key: 'totalAmount',
        title: 'Amount',
        align: 'right',
        render: (r) => formatCurrency(r.totalAmount),
      },
      { key: 'soldBy', title: 'Sold By', accessor: 'soldBy', align: 'left' },
      {
        key: 'actions',
        title: 'Actions',
        align: 'center',
        width: 180,
        render: (row) => (
          <div className="home-page__row-actions">
            {isAdmin && (
              <Button size="sm" variant="secondary" onClick={() => openEdit(row)} leftIcon={<EditIcon width={13} height={13} />}>
                Edit
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => handlePrint(row)} leftIcon={<PrinterIcon width={13} height={13} />}>
              Print
            </Button>
            {isAdmin && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDelete({ open: true, ids: [row.id] })}
                leftIcon={<TrashIcon width={13} height={13} />}
                className="home-page__row-delete"
              >
                Del
              </Button>
            )}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="home-page">
      <PageHeader
        title="Sales"
        subtitle="Manage your factory sales records"
        actions={
          <>
            <Button variant="secondary" onClick={handleExport} leftIcon={<DownloadIcon width={15} height={15} />}>
              Export Excel
            </Button>
            <Button onClick={openAdd} leftIcon={<PlusIcon width={15} height={15} />}>
              Add Sale
            </Button>
          </>
        }
      />

      <Card
        title={`Sales Records (${filteredSales.length})`}
        actions={
          <>
            <div className="home-page__search">
              <Input
                placeholder="Search by name, mobile, shop…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                size="sm"
                leftIcon={<SearchIcon width={14} height={14} />}
              />
            </div>
            {selectedKeys.length > 0 && (
              <>
                <Button size="sm" variant="secondary" onClick={handleBulkPrint} leftIcon={<PrinterIcon width={13} height={13} />}>
                  Print ({selectedKeys.length})
                </Button>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setConfirmDelete({ open: true, ids: selectedKeys.map((k) => Number(k)) })}
                    leftIcon={<TrashIcon width={13} height={13} />}
                  >
                    Delete ({selectedKeys.length})
                  </Button>
                )}
              </>
            )}
          </>
        }
        padded={false}
      >
        <DataTable<Sale>
          data={filteredSales}
          columns={columns}
          rowKey={(r) => r.id}
          loading={loading}
          selectable
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          pageSize={10}
        />
      </Card>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        size="lg"
        title={editing ? 'Edit Sale' : 'Add Sale'}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>{editing ? 'Update' : 'Create'}</Button>
          </>
        }
      >
        <div className="home-form">
          <div className="home-form__row home-form__row--2">
            <Field label="Date" required>
              <Input type="date" value={form.date} onChange={(e) => setField('date', e.target.value)} leftIcon={<CalendarIcon width={15} height={15} />} />
            </Field>
            <Field label="Time" required>
              <Input type="time" value={form.time} onChange={(e) => setField('time', e.target.value)} leftIcon={<ClockIcon width={15} height={15} />} />
            </Field>
          </div>

          <div className="home-form__section">
            <h4 className="home-form__section-title">Customer Information</h4>
            <div className="home-form__row home-form__row--3">
              <Field label="Name" required error={formErrors.name}>
                <Input value={form.name} onChange={(e) => setField('name', e.target.value)} invalid={!!formErrors.name} leftIcon={<PersonIcon width={15} height={15} />} />
              </Field>
              <Field label="Mobile" required error={formErrors.mobile}>
                <Input value={form.mobile} onChange={(e) => setField('mobile', e.target.value)} invalid={!!formErrors.mobile} inputMode="numeric" maxLength={10} leftIcon={<PhoneIcon width={15} height={15} />} />
              </Field>
              <Field label="Shop" required error={formErrors.shop}>
                <Input value={form.shop} onChange={(e) => setField('shop', e.target.value)} invalid={!!formErrors.shop} leftIcon={<StoreIcon width={15} height={15} />} />
              </Field>
            </div>
          </div>

          <div className="home-form__section">
            <h4 className="home-form__section-title">Sale Details</h4>
            <div className="home-form__row home-form__row--3">
              {/* Plant selector */}
              <Field label="Unit" required error={formErrors.unit}>
                <Select
                  value={form.unit}
                  onChange={(e) => handleUnitChange(e.target.value)}
                  options={unitOptions}
                  placeholder={unitOptions.length === 0 ? 'No plants in master' : 'Select plant'}
                  invalid={!!formErrors.unit}
                />
              </Field>

              {/* Dynamic item inputs */}
              {form.items.map((item) => (
                <Field key={item.iceTypeId} label={`${item.iceTypeName} (₹${item.price})`}>
                  <Input
                    value={item.quantity}
                    onChange={(e) => setItemQty(item.iceTypeId, e.target.value)}
                    inputMode="numeric"
                    placeholder="0"
                  />
                </Field>
              ))}

              {/* Discount */}
              <Field label="Discount (₹)" error={formErrors.discount}>
                <Input
                  value={form.discount}
                  onChange={(e) => { if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) setField('discount', e.target.value); }}
                  inputMode="numeric"
                />
              </Field>

              <Field label="Sold By" required error={formErrors.soldBy}>
                <Input value={form.soldBy} onChange={(e) => setField('soldBy', e.target.value)} invalid={!!formErrors.soldBy} />
              </Field>
            </div>
            {formErrors.items && (
              <p style={{ color: 'var(--color-error)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{formErrors.items}</p>
            )}
          </div>

          {/* Live totals preview */}
          <div className="home-form__preview">
            <div className="home-form__preview-item">
              <span className="home-form__preview-label">Total Units</span>
              <span className="home-form__preview-value home-form__preview-value--green">
                {previewTotalUnits}
              </span>
            </div>
            <div className="home-form__preview-item">
              <span className="home-form__preview-label">Total Amount</span>
              <span className="home-form__preview-value home-form__preview-value--blue">
                {formatCurrency(previewTotalAmount)}
              </span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, ids: [] })}
        size="sm"
        title="Confirm Delete"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete({ open: false, ids: [] })}>Cancel</Button>
            <Button variant="danger" onClick={() => doDelete(confirmDelete.ids)}>Delete</Button>
          </>
        }
      >
        <p>
          Are you sure you want to delete{' '}
          <strong>{confirmDelete.ids.length} sale{confirmDelete.ids.length === 1 ? '' : 's'}</strong>?
          This cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

export default Home;
