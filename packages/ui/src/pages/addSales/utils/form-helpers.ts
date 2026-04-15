import { SaleForm, SaleNumbers } from '../model/types';

const MOBILE_RE = /^[6-9]\d{9}$/;

export const isValidNumericInput = (value: string): boolean =>
  value === '' || /^\d*\.?\d*$/.test(value);

export const parseSaleNumbers = (form: SaleForm): SaleNumbers => ({
  cans: Number(form.cans) || 0,
  blocks: Number(form.blocks) || 0,
  pieces: Number(form.pieces) || 0,
  discount: Number(form.discount) || 0,
});

export const validateSaleForm = (
  form: SaleForm,
  numbers: SaleNumbers
): Partial<Record<keyof SaleForm, string>> => {
  const errs: Partial<Record<keyof SaleForm, string>> = {};

  if (!form.unit) errs.unit = 'Unit is required';
  if (!form.name.trim()) errs.name = 'Name is required';

  if (!form.mobile.trim()) errs.mobile = 'Mobile is required';
  else if (!MOBILE_RE.test(form.mobile)) errs.mobile = 'Enter a valid 10-digit Indian mobile';

  if (!form.shop.trim()) errs.shop = 'Shop is required';
  if (!form.soldBy.trim()) errs.soldBy = 'Sold by is required';

  if (numbers.cans < 0 || numbers.blocks < 0 || numbers.pieces < 0 || numbers.discount < 0) {
    errs.cans = 'Values must be non-negative';
  }

  if (numbers.cans + numbers.blocks + numbers.pieces === 0) {
    errs.cans = 'Enter at least one of cans, blocks or pieces';
  }

  return errs;
};
