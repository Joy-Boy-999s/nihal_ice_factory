import React, { Suspense, lazy, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SalesHelpService } from '@nihal-ice-factory/shared-services';
import { Button, Card, Field, Input, PageHeader, Select, useToast } from '../../components';
import { buildAuthConfig, logout } from '../../lib/auth';
import { calculateTotal, calculateTotalCans, formatCurrency, } from '../../lib/pricing';
import { createInitialForm, UNIT_OPTIONS } from './utils/constants';
import { isValidNumericInput, parseSaleNumbers, validateSaleForm } from './utils/form-helpers';
import { SaleForm } from './model/types';
import './styles/addsale.css';

const SaleFormSection = lazy(() => import('./components/SaleFormSection'));
const SaleTotalsPreview = lazy(() => import('./components/SaleTotalsPreview'));
const SalePreviewModal = lazy(() => import('./components/SalePreviewModal'));

const AddSale: React.FC = () => {
	const navigate = useNavigate();
	const toast = useToast();
	const salesService = useMemo(() => new SalesHelpService(), []);

	const [form, setForm] = useState<SaleForm>(createInitialForm());
	const [errors, setErrors] = useState<Partial<Record<keyof SaleForm, string>>>({});
	const [saving, setSaving] = useState(false);
	const [previewOpen, setPreviewOpen] = useState(false);

	const setField = <K extends keyof SaleForm>(key: K, value: SaleForm[K]) => {
		setForm((prev) => ({ ...prev, [key]: value }));
		setErrors((prev) => ({ ...prev, [key]: undefined }));
	};

	const numericField = (key: keyof SaleForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
		const v = e.target.value;
		if (isValidNumericInput(v)) setField(key, v as SaleForm[keyof SaleForm]);
	};

	const { cans: cansN, blocks: blocksN, pieces: piecesN, discount: discountN } =
		parseSaleNumbers(form);
	const totalCans = calculateTotalCans(cansN, blocksN, piecesN);
	const totalAmount = calculateTotal(cansN, blocksN, piecesN, discountN);

	const validate = (): boolean => {
		const errs = validateSaleForm(form, {
			cans: cansN,
			blocks: blocksN,
			pieces: piecesN,
			discount: discountN,
		});
		setErrors(errs);
		return Object.keys(errs).length === 0;
	};

	const handleReview = (e: React.FormEvent) => {
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
			if (!res?.status) {
				throw new Error(res?.internalMessage || 'Create failed');
			}
			toast.success('Sale created');
			setPreviewOpen(false);
			setForm(createInitialForm());
			setErrors({});
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
					<p className="add-sale-shell__hint">
						Tip: enter quantities first and the live totals will update automatically.
					</p>

					<form className="add-sale-form" onSubmit={handleReview} noValidate>
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

						<Suspense fallback={<div className="add-sale-lazy-placeholder" aria-hidden />}>
							<SaleFormSection
								title="Sale Details"
								description="Enter unit, product quantities, discount, and seller"
							>
								<div className="add-sale-grid add-sale-grid--3">
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
							</SaleFormSection>
						</Suspense>

						<Suspense fallback={<div className="add-sale-lazy-placeholder" aria-hidden />}>
							<SaleTotalsPreview
								totalCansText={totalCans.toFixed(2)}
								totalAmountText={formatCurrency(totalAmount)}
							/>
						</Suspense>

						<div className="add-sale-actions">
							<Button variant="secondary" type="button" onClick={() => navigate('/')}>
								Cancel
							</Button>
							<Button type="submit">
								Review &amp; Save
							</Button>
						</div>
					</form>
				</div>
			</Card>

			<Suspense fallback={null}>
				<SalePreviewModal
					open={previewOpen}
					form={form}
					totalCans={totalCans}
					totalAmount={totalAmount}
					saving={saving}
					onEdit={handleBackToEdit}
					onConfirm={handleConfirmSave}
				/>
			</Suspense>
		</div>
	);
};

export default AddSale;
