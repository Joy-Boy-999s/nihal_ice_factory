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
import { buildAuthConfig, logout } from '../../lib/auth';
import { todayISO, nowHHMM } from '../../lib/date';
import {
  calculateTotal,
  calculateTotalCans,
  formatCurrency,
} from '../../lib/pricing';
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
        if (!res.status || res.errorCode !== 200) {
          throw new Error(res.internalMessage || 'Update failed');
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
        if (!res.status || (res.errorCode !== 201 && res.errorCode !== 200)) {
          throw new Error(res.internalMessage || 'Create failed');
        }
        const raw = res.data?.data ?? res.data;
        const newSale = { ...raw, totalCans: Number(raw.totalCans) };
        setSales((prev) => [newSale, ...prev]);
        toast.success('Sale created');
      }

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

  const generatePrintContent = (records: any[]) => `
    <html>
      <head>
        <title>Sales Receipts</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #0f172a; }
          .bill { max-width: 600px; margin: 20px auto; border: 1px solid #e5e7eb; padding: 24px; border-radius: 10px; page-break-after: always; }
          .bill:last-child { page-break-after: auto; }
          h2 { text-align: center; margin-top: 0; }
          p { margin: 4px 0; font-size: 14px; }
          .items li { margin: 4px 0; }
          .total { font-weight: bold; font-size: 16px; }
          @media print { .bill { margin: 0 auto; border: none; } }
        </style>
      </head>
      <body>
        ${records
          .map(
            (r) => `
          <div class="bill">
            <h2>KP Ice Factory — Sales Receipt</h2>
            <p><strong>Serial No:</strong> ${r.id}</p>
            <p><strong>Date:</strong> ${r.date} &nbsp; <strong>Time:</strong> ${r.time}</p>
            <p><strong>Unit:</strong> ${r.unit}</p>
            <p><strong>Customer:</strong> ${r.name} (${r.mobile})</p>
            <p><strong>Shop:</strong> ${r.shop}</p>
            <hr />
            <div class="items">
              <ul>
                <li>Cans: ${r.cans} × 240 Rs = ${r.cans * 240} Rs</li>
                <li>Blocks: ${r.blocks} × 80 Rs = ${r.blocks * 80} Rs</li>
                <li>Pieces: ${r.pieces} × 20 Rs = ${r.pieces * 20} Rs</li>
                <li>Discount: ${r.discount} Rs</li>
              </ul>
            </div>
            <p class="total">Total Cans: ${Number(r.totalCans).toFixed(2)}</p>
            <p class="total">Total Amount: ${r.totalAmount} Rs</p>
            <p><strong>Sold By:</strong> ${r.soldBy}</p>
          </div>`
          )
          .join('')}
      </body>
    </html>`;

  const handlePrint = async (sale: Sale) => {
    try {
      const res = await salesService.getPrintData(sale.id, buildAuthConfig());
      if (!res.status || res.errorCode !== 200) {
        throw new Error(res.internalMessage || 'Failed to fetch print data');
      }
      const data =
        res.data && typeof res.data === 'object' && res.data.data
          ? { ...res.data.data, totalCans: Number(res.data.data.totalCans) }
          : res.data;
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(generatePrintContent([data]));
        win.document.close();
        win.print();
      }
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
      const promises = selectedKeys.map((k) =>
        salesService.getPrintData(Number(k), buildAuthConfig())
      );
      const results = await Promise.all(promises);
      const records = results
        .filter((r: any) => r.status && r.errorCode === 200)
        .map((r: any) => {
          const d = r.data?.data ?? r.data;
          return { ...d, totalCans: Number(d.totalCans) };
        });
      if (records.length === 0) throw new Error('No print data available');
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(generatePrintContent(records));
        win.document.close();
        win.print();
      }
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
            <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => handlePrint(row)}>
              Print
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmDelete({ open: true, ids: [row.id] })}
            >
              Delete
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="home-page">
      <PageHeader
        title="Sales"
        subtitle="Manage your factory sales records"
        actions={
          <>
            <Button variant="secondary" onClick={handleExport}>
              Export Excel
            </Button>
            <Button onClick={openAdd}>+ Add Sale</Button>
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
              />
            </div>
            {selectedKeys.length > 0 && (
              <>
                <Button size="sm" variant="secondary" onClick={handleBulkPrint}>
                  Print ({selectedKeys.length})
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() =>
                    setConfirmDelete({
                      open: true,
                      ids: selectedKeys.map((k) => Number(k)),
                    })
                  }
                >
                  Delete ({selectedKeys.length})
                </Button>
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
              <Field label="Name" required error={formErrors.name}>
                <Input
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  invalid={!!formErrors.name}
                />
              </Field>
              <Field label="Mobile" required error={formErrors.mobile}>
                <Input
                  value={form.mobile}
                  onChange={(e) => setField('mobile', e.target.value)}
                  invalid={!!formErrors.mobile}
                  inputMode="numeric"
                  maxLength={10}
                />
              </Field>
              <Field label="Shop" required error={formErrors.shop}>
                <Input
                  value={form.shop}
                  onChange={(e) => setField('shop', e.target.value)}
                  invalid={!!formErrors.shop}
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
