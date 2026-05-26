import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { CommonResponse, SaleUpdateDto } from '@nihal-ice-factory/shared-models';
import { SalesHelpService } from '@nihal-ice-factory/shared-services';
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
  calculateTotal,
  calculateTotalCans,
  formatCurrency,
} from '../../lib/pricing';
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
  BuildingIcon,
} from '../../layout/nav-icons';
import './home.css';

interface Sale {
  id: number;
  unit: string;
  date: string;
  time: string;
  name: string;
  mobile: string;
  shop: string;
  cans: number;
  blocks: number;
  pieces: number;
  discount: number;
  totalAmount: number;
  totalCans: number | string;
  soldBy: string;
}

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

const Home: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';
  const salesService = useMemo(() => new SalesHelpService(), []);

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [form, setForm] = useState<SaleForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof SaleForm, string>>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; ids: number[] }>({
    open: false,
    ids: [],
  });

  const handleAuthError = useCallback(
    (err: any): boolean => {
      if (err?.response?.status === 401) {
        logout();
        toast.error('Session expired. Please sign in again.');
        navigate('/login', { replace: true });
        return true;
      }
      return false;
    },
    [navigate, toast]
  );

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const res: CommonResponse = await salesService.getAllSales(buildAuthConfig());
      if (res?.status && res.errorCode === 200) {
        const nested = (res.data && typeof res.data === 'object' ? res.data.data : []) as any[];
        const rows: Sale[] = Array.isArray(nested)
          ? nested.map((s) => ({ ...s, totalCans: Number(s.totalCans) }))
          : [];
        setSales(rows);
      } else {
        throw new Error(res?.internalMessage || 'Failed to load sales');
      }
    } catch (err: any) {
      if (!handleAuthError(err)) {
        toast.error(err.message || 'Failed to load sales');
      }
    } finally {
      setLoading(false);
    }
  }, [salesService, toast, handleAuthError]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const filteredSales = useMemo(() => {
    if (!query.trim()) return sales;
    const q = query.trim().toLowerCase();
    return sales.filter(
      (s) =>
        String(s.id).includes(q) ||
        s.name?.toLowerCase().includes(q) ||
        s.mobile?.toLowerCase().includes(q) ||
        s.shop?.toLowerCase().includes(q) ||
        s.unit?.toLowerCase().includes(q) ||
        s.soldBy?.toLowerCase().includes(q)
    );
  }, [sales, query]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm, date: todayISO(), time: nowHHMM() });
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (sale: Sale) => {
    setEditing(sale);
    setForm({
      date: sale.date || todayISO(),
      time: sale.time || nowHHMM(),
      unit: sale.unit || '',
      name: sale.name || '',
      mobile: sale.mobile || '',
      shop: sale.shop || '',
      cans: String(sale.cans ?? 0),
      blocks: String(sale.blocks ?? 0),
      pieces: String(sale.pieces ?? 0),
      discount: String(sale.discount ?? 0),
      soldBy: sale.soldBy || '',
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

  const numericField = (key: keyof SaleForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === '' || /^\d*\.?\d*$/.test(v)) setField(key, v as any);
  };

  const cansN = Number(form.cans) || 0;
  const blocksN = Number(form.blocks) || 0;
  const piecesN = Number(form.pieces) || 0;
  const discountN = Number(form.discount) || 0;
  const previewTotalCans = calculateTotalCans(cansN, blocksN, piecesN);
  const previewTotalAmount = calculateTotal(cansN, blocksN, piecesN, discountN);

  const validateForm = (): boolean => {
    const errs: Partial<Record<keyof SaleForm, string>> = {};
    if (!form.unit) errs.unit = 'Unit is required';
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.mobile.trim()) errs.mobile = 'Mobile is required';
    else if (!MOBILE_RE.test(form.mobile)) errs.mobile = 'Enter a valid 10-digit Indian mobile';
    if (!form.shop.trim()) errs.shop = 'Shop is required';
    if (!form.soldBy.trim()) errs.soldBy = 'Sold by is required';
    if (cansN < 0 || blocksN < 0 || piecesN < 0 || discountN < 0)
      errs.cans = 'Values must be non-negative';
    if (cansN + blocksN + piecesN === 0)
      errs.cans = 'Enter at least one of cans, blocks or pieces';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
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
        totalAmount: previewTotalAmount,
        totalCans: previewTotalCans,
        soldBy: form.soldBy.trim(),
      };

      if (editing) {
        const { totalAmount, totalCans, ...updatePayload } = payload;
        const res = await salesService.updateSale(
          editing.id,
          updatePayload as SaleUpdateDto,
          buildAuthConfig()
        );
        if (!res?.status) {
          throw new Error(res?.internalMessage || 'Update failed');
        }
        const inner = res.data?.data?.data ?? res.data?.data ?? res.data;
        setSales((prev) =>
          prev.map((s) =>
            s.id === editing.id ? { ...s, ...inner, totalCans: Number(inner.totalCans) } : s
          )
        );
        toast.success('Sale updated');
      } else {
        const res = await salesService.createSale(payload, buildAuthConfig());
        if (!res?.status) {
          throw new Error(res?.internalMessage || 'Create failed');
        }
        const raw = res.data?.data ?? res.data;
        const newSale = { ...raw, totalCans: Number(raw.totalCans) };
        setSales((prev) => [newSale, ...prev]);
        toast.success('Sale created');
      }

      setForm({ ...emptyForm, date: todayISO(), time: nowHHMM() });
      closeModal();
    } catch (err: any) {
      if (!handleAuthError(err)) {
        toast.error(err.response?.data?.internalMessage || err.message || 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async (ids: number[]) => {
    if (ids.length === 0) return;
    setLoading(true);
    try {
      const res =
        ids.length === 1
          ? await salesService.deleteSale(ids[0], buildAuthConfig())
          : await salesService.deleteMultiple(ids, buildAuthConfig());
      if (!res.status || res.errorCode !== 200) {
        throw new Error(res.internalMessage || 'Delete failed');
      }
      setSales((prev) => prev.filter((s) => !ids.includes(s.id)));
      setSelectedKeys((prev) => prev.filter((k) => !ids.includes(Number(k))));
      toast.success(ids.length === 1 ? 'Sale deleted' : `${ids.length} sales deleted`);
    } catch (err: any) {
      if (!handleAuthError(err)) {
        toast.error(err.message || 'Delete failed');
      }
    } finally {
      setLoading(false);
      setConfirmDelete({ open: false, ids: [] });
    }
  };

  const escapeHtml = (value: unknown): string =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const formatInr = (value: number): string =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Number.isFinite(value) ? value : 0);

  const buildInvoice = (r: any): string => {
    const cans = Number(r.cans) || 0;
    const blocks = Number(r.blocks) || 0;
    const pieces = Number(r.pieces) || 0;
    const discount = Number(r.discount) || 0;
    const canRate = 240;
    const blockRate = 80;
    const pieceRate = 20;
    const canAmount = cans * canRate;
    const blockAmount = blocks * blockRate;
    const pieceAmount = pieces * pieceRate;
    const subtotal = canAmount + blockAmount + pieceAmount;
    const grandTotal = Number(r.totalAmount) || subtotal - discount;

    const rows: Array<{ label: string; qty: number; rate: number; amount: number }> = [
      { label: 'Ice Cans', qty: cans, rate: canRate, amount: canAmount },
      { label: 'Ice Blocks', qty: blocks, rate: blockRate, amount: blockAmount },
      { label: 'Ice Pieces', qty: pieces, rate: pieceRate, amount: pieceAmount },
    ].filter((row) => row.qty > 0);

    const itemsHtml = rows
      .map(
        (row, idx) => `
          <tr>
            <td class="idx">${idx + 1}</td>
            <td>${escapeHtml(row.label)}</td>
            <td class="num">${row.qty}</td>
            <td class="num">${formatInr(row.rate)}</td>
            <td class="num">${formatInr(row.amount)}</td>
          </tr>`,
      )
      .join('');

    const invoiceNo = `NIF-${String(r.id ?? '').padStart(6, '0')}`;
    const generatedAt = new Date().toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

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
            <p>Total Cans (weighted): <strong>${Number(r.totalCans || 0).toFixed(2)}</strong></p>
            <p class="muted small">Goods once sold will not be taken back. Thank you for your business.</p>
          </div>
          <table class="invoice__totals">
            <tr>
              <th>Subtotal</th>
              <td>${formatInr(subtotal)}</td>
            </tr>
            <tr>
              <th>Discount</th>
              <td>− ${formatInr(discount)}</td>
            </tr>
            <tr class="invoice__totals-grand">
              <th>Grand Total</th>
              <td>${formatInr(grandTotal)}</td>
            </tr>
          </table>
        </div>

        <footer class="invoice__foot">
          <div class="invoice__sign">
            <span class="invoice__sign-line"></span>
            <span class="muted small">Authorised Signatory</span>
          </div>
          <div class="invoice__generated muted small">
            Generated ${escapeHtml(generatedAt)}
          </div>
        </footer>
      </section>`;
  };

  const generatePrintContent = (records: any[]) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Nihal Ice Factory — Invoice</title>
    <style>
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        background: #f4f6fb;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
          "Helvetica Neue", Arial, sans-serif;
        color: #0f172a;
        -webkit-font-smoothing: antialiased;
      }
      .page { padding: 28px; }
      .invoice {
        position: relative;
        max-width: 780px;
        margin: 0 auto 28px;
        padding: 40px 44px 32px;
        background: #ffffff;
        border-radius: 16px;
        border: 1px solid #e5e7eb;
        box-shadow: 0 6px 24px rgba(15, 23, 42, 0.06);
        page-break-after: always;
      }
      .invoice:last-child { page-break-after: auto; }
      .invoice::before {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        height: 6px;
        border-radius: 16px 16px 0 0;
        background: linear-gradient(90deg, #1d4ed8, #3b82f6, #60a5fa);
      }

      /* Header */
      .invoice__head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 24px;
        padding-bottom: 22px;
        border-bottom: 1px solid #e5e7eb;
      }
      .invoice__brand {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .invoice__logo {
        width: 56px;
        height: 56px;
        border-radius: 14px;
        background: linear-gradient(135deg, #1d4ed8, #60a5fa);
        color: #fff;
        font-weight: 700;
        font-size: 18px;
        letter-spacing: 0.05em;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 6px 14px rgba(29, 78, 216, 0.25);
      }
      .invoice__brand h1 {
        margin: 0;
        font-size: 22px;
        font-weight: 700;
        letter-spacing: -0.01em;
      }
      .invoice__meta { text-align: right; min-width: 240px; }
      .invoice__badge {
        display: inline-block;
        padding: 4px 12px;
        background: #eff6ff;
        color: #1d4ed8;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.12em;
        border-radius: 999px;
        border: 1px solid #bfdbfe;
        margin-bottom: 10px;
      }
      .invoice__meta table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      .invoice__meta th {
        text-align: right;
        color: #64748b;
        font-weight: 500;
        padding: 3px 10px 3px 0;
        white-space: nowrap;
      }
      .invoice__meta td {
        text-align: right;
        color: #0f172a;
        font-weight: 600;
        padding: 3px 0;
      }

      /* Parties */
      .invoice__parties {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin: 24px 0 20px;
      }
      .invoice__party {
        padding: 14px 16px;
        background: #f8fafc;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
      }
      .invoice__party--right { text-align: right; }
      .invoice__party-title {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #64748b;
        margin-bottom: 6px;
      }
      .invoice__party-name {
        font-size: 15px;
        font-weight: 600;
        color: #0f172a;
        margin-bottom: 2px;
      }

      /* Items table */
      .invoice__items {
        width: 100%;
        border-collapse: collapse;
        margin-top: 4px;
        font-size: 13px;
      }
      .invoice__items thead th {
        background: #0f172a;
        color: #e2e8f0;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        padding: 10px 12px;
        text-align: left;
      }
      .invoice__items thead th:first-child { border-radius: 8px 0 0 8px; }
      .invoice__items thead th:last-child { border-radius: 0 8px 8px 0; }
      .invoice__items tbody td {
        padding: 12px;
        border-bottom: 1px solid #eef2f7;
        color: #0f172a;
      }
      .invoice__items tbody tr:last-child td { border-bottom: none; }
      .invoice__items .idx { width: 36px; color: #94a3b8; }
      .invoice__items .num { text-align: right; white-space: nowrap; }
      .invoice__items .center { text-align: center; }

      /* Summary */
      .invoice__summary {
        display: grid;
        grid-template-columns: 1fr 280px;
        gap: 24px;
        margin-top: 24px;
        align-items: start;
      }
      .invoice__notes {
        font-size: 12px;
        color: #334155;
      }
      .invoice__notes-title {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #64748b;
        margin-bottom: 6px;
      }
      .invoice__notes p { margin: 4px 0; }

      .invoice__totals {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      .invoice__totals th,
      .invoice__totals td {
        padding: 8px 12px;
      }
      .invoice__totals th {
        text-align: left;
        color: #64748b;
        font-weight: 500;
      }
      .invoice__totals td {
        text-align: right;
        color: #0f172a;
        font-weight: 600;
      }
      .invoice__totals-grand {
        background: linear-gradient(135deg, #1d4ed8, #3b82f6);
        border-radius: 10px;
      }
      .invoice__totals-grand th,
      .invoice__totals-grand td {
        color: #ffffff;
        font-size: 15px;
        font-weight: 700;
      }
      .invoice__totals-grand th:first-child { border-radius: 10px 0 0 10px; }
      .invoice__totals-grand td:last-child { border-radius: 0 10px 10px 0; }

      /* Footer */
      .invoice__foot {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        margin-top: 36px;
        padding-top: 20px;
        border-top: 1px dashed #e5e7eb;
      }
      .invoice__sign { min-width: 220px; }
      .invoice__sign-line {
        display: block;
        width: 180px;
        height: 1px;
        background: #0f172a;
        margin-bottom: 6px;
      }

      .muted { color: #64748b; margin: 2px 0; font-size: 12px; }
      .small { font-size: 11px; }
      .center { text-align: center; }

      @media print {
        html, body { background: #ffffff; }
        .page { padding: 0; }
        .invoice {
          margin: 0;
          border: none;
          box-shadow: none;
          border-radius: 0;
          max-width: none;
          padding: 24px 32px;
        }
        .invoice::before { border-radius: 0; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      ${records.map((r) => buildInvoice(r)).join('')}
    </div>
  </body>
</html>`;

  const openPrintPreview = (html: string): void => {
    const existing = document.getElementById('app-print-frame');
    if (existing) existing.remove();

    const frame = document.createElement('iframe');
    frame.id = 'app-print-frame';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);

    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) return;
      try {
        win.focus();
        win.print();
      } catch {
        toast.error('Print was blocked by the browser');
      }
    };

    frame.srcdoc = html;
  };

  const unwrapPrintPayload = (res: CommonResponse): Record<string, unknown> | null => {
    const first = res?.data;
    if (first && typeof first === 'object') {
      const nested = (first as { data?: unknown }).data;
      if (nested && typeof nested === 'object') return nested as Record<string, unknown>;
      return first as Record<string, unknown>;
    }
    return null;
  };

  const handlePrint = async (sale: Sale) => {
    try {
      const res = await salesService.getPrintData(sale.id, buildAuthConfig());
      if (!res?.status) {
        throw new Error(res?.internalMessage || 'Failed to fetch print data');
      }
      const payload = unwrapPrintPayload(res);
      if (!payload) throw new Error('Print data was empty');
      const record = { ...payload, totalCans: Number(payload.totalCans) };
      openPrintPreview(generatePrintContent([record]));
    } catch (err: any) {
      if (!handleAuthError(err)) toast.error(err.message || 'Print failed');
    }
  };

  const handleBulkPrint = async () => {
    if (selectedKeys.length === 0) {
      toast.warning('Select at least one sale to print');
      return;
    }
    try {
      const results = await Promise.all(
        selectedKeys.map((k) => salesService.getPrintData(Number(k), buildAuthConfig()))
      );
      const records = results
        .filter((r: CommonResponse) => r?.status)
        .map((r: CommonResponse) => {
          const payload = unwrapPrintPayload(r);
          return payload ? { ...payload, totalCans: Number(payload.totalCans) } : null;
        })
        .filter((r): r is Record<string, unknown> => r !== null);
      if (records.length === 0) throw new Error('No print data available');
      openPrintPreview(generatePrintContent(records));
    } catch (err: any) {
      if (!handleAuthError(err)) toast.error(err.message || 'Print failed');
    }
  };

  const handleExport = () => {
    const rows = (filteredSales.length ? filteredSales : sales).map((s) => ({
      'Serial No': s.id,
      Date: s.date,
      Time: s.time,
      Unit: s.unit,
      Name: s.name,
      Mobile: s.mobile,
      Shop: s.shop,
      Cans: s.cans,
      Blocks: s.blocks,
      Pieces: s.pieces,
      Discount: s.discount,
      'Total Cans': Number(s.totalCans).toFixed(2),
      'Total Amount': s.totalAmount,
      'Sold By': s.soldBy,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
    XLSX.writeFile(wb, 'sales_data.xlsx');
    toast.success('Exported to Excel');
  };

  const columns: Column<Sale>[] = useMemo(
    () => [
      { key: 'id', title: '#', accessor: 'id', width: 60, align: 'center' },
      { key: 'date', title: 'Date', accessor: 'date', align: 'left' },
      { key: 'time', title: 'Time', accessor: 'time', align: 'left' },
      { key: 'unit', title: 'Unit', accessor: 'unit', align: 'left' },
      { key: 'name', title: 'Customer', accessor: 'name', align: 'left' },
      { key: 'mobile', title: 'Mobile', accessor: 'mobile', align: 'left' },
      { key: 'shop', title: 'Shop', accessor: 'shop', align: 'left' },
      { key: 'cans', title: 'Cans', accessor: 'cans', align: 'right' },
      { key: 'blocks', title: 'Blocks', accessor: 'blocks', align: 'right' },
      { key: 'pieces', title: 'Pieces', accessor: 'pieces', align: 'right' },
      {
        key: 'totalCans',
        title: 'Total Cans',
        align: 'right',
        render: (r) => Number(r.totalCans).toFixed(2),
      },
      { key: 'discount', title: 'Discount', accessor: 'discount', align: 'right' },
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
    [isAdmin]
  );

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
                    onClick={() =>
                      setConfirmDelete({
                        open: true,
                        ids: selectedKeys.map((k) => Number(k)),
                      })
                    }
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

      <Modal
        open={modalOpen}
        onClose={closeModal}
        size="lg"
        title={editing ? 'Edit Sale' : 'Add Sale'}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="home-form">
          <div className="home-form__row home-form__row--2">
            <Field label="Date" required>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setField('date', e.target.value)}
                leftIcon={<CalendarIcon width={15} height={15} />}
              />
            </Field>
            <Field label="Time" required>
              <Input
                type="time"
                value={form.time}
                onChange={(e) => setField('time', e.target.value)}
                leftIcon={<ClockIcon width={15} height={15} />}
              />
            </Field>
          </div>

          <div className="home-form__section">
            <h4 className="home-form__section-title">Customer Information</h4>
            <div className="home-form__row home-form__row--3">
              <Field label="Name" required error={formErrors.name}>
                <Input
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  invalid={!!formErrors.name}
                  leftIcon={<PersonIcon width={15} height={15} />}
                />
              </Field>
              <Field label="Mobile" required error={formErrors.mobile}>
                <Input
                  value={form.mobile}
                  onChange={(e) => setField('mobile', e.target.value)}
                  invalid={!!formErrors.mobile}
                  inputMode="numeric"
                  maxLength={10}
                  leftIcon={<PhoneIcon width={15} height={15} />}
                />
              </Field>
              <Field label="Shop" required error={formErrors.shop}>
                <Input
                  value={form.shop}
                  onChange={(e) => setField('shop', e.target.value)}
                  invalid={!!formErrors.shop}
                  leftIcon={<StoreIcon width={15} height={15} />}
                />
              </Field>
            </div>
          </div>

          <div className="home-form__section">
            <h4 className="home-form__section-title">Sale Details</h4>
            <div className="home-form__row home-form__row--3">
              <Field label="Unit" required error={formErrors.unit}>
                <Select
                  value={form.unit}
                  onChange={(e) => setField('unit', e.target.value)}
                  options={UNIT_OPTIONS}
                  placeholder="Select unit"
                  invalid={!!formErrors.unit}
                />
              </Field>
              <Field label="Cans" error={formErrors.cans}>
                <Input
                  value={form.cans}
                  onChange={numericField('cans')}
                  inputMode="numeric"
                />
              </Field>
              <Field label="Blocks">
                <Input
                  value={form.blocks}
                  onChange={numericField('blocks')}
                  inputMode="numeric"
                />
              </Field>
              <Field label="Pieces">
                <Input
                  value={form.pieces}
                  onChange={numericField('pieces')}
                  inputMode="numeric"
                />
              </Field>
              <Field label="Discount">
                <Input
                  value={form.discount}
                  onChange={numericField('discount')}
                  inputMode="numeric"
                />
              </Field>
              <Field label="Sold By" required error={formErrors.soldBy}>
                <Input
                  value={form.soldBy}
                  onChange={(e) => setField('soldBy', e.target.value)}
                  invalid={!!formErrors.soldBy}
                />
              </Field>
            </div>
          </div>

          <div className="home-form__preview">
            <div className="home-form__preview-item">
              <span className="home-form__preview-label">Total Cans</span>
              <span className="home-form__preview-value home-form__preview-value--green">
                {previewTotalCans.toFixed(2)}
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

      <Modal
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, ids: [] })}
        size="sm"
        title="Confirm Delete"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmDelete({ open: false, ids: [] })}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={() => doDelete(confirmDelete.ids)}>
              Delete
            </Button>
          </>
        }
      >
        <p>
          Are you sure you want to delete{' '}
          <strong>
            {confirmDelete.ids.length} sale{confirmDelete.ids.length === 1 ? '' : 's'}
          </strong>
          ? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

export default Home;
