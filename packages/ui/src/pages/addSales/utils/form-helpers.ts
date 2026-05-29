import { SaleForm } from '../model/types';

const MOBILE_RE = /^[6-9]\d{9}$/;

export const isValidNumericInput = (value: string): boolean =>
  value === '' || /^\d*\.?\d*$/.test(value);

export type SaleFormErrors = Partial<Record<keyof Omit<SaleForm, 'items'>, string>> & {
  items?: string;
};

export const validateSaleForm = (form: SaleForm): SaleFormErrors => {
  const errs: SaleFormErrors = {};

  if (!form.unit)          errs.unit    = 'Unit is required';
  if (!form.name.trim())   errs.name    = 'Name is required';
  if (!form.shop.trim())   errs.shop    = 'Shop is required';
  if (!form.soldBy.trim()) errs.soldBy  = 'Sold by is required';

  if (!form.mobile.trim())            errs.mobile = 'Mobile is required';
  else if (!MOBILE_RE.test(form.mobile)) errs.mobile = 'Enter a valid 10-digit Indian mobile';

  const discount = Number(form.discount) || 0;
  if (discount < 0) errs.discount = 'Discount must be non-negative';

  // At least one item must have a positive quantity.
  const hasQty = form.items.some((i) => Number(i.quantity) > 0);
  if (form.items.length > 0 && !hasQty) {
    errs.items = 'Enter a quantity for at least one item';
  }

  return errs;
};
