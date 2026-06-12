/**
 * Seller details printed on invoices. Configure the real values via Vercel
 * env vars — GST breakup only renders when a GSTIN is set.
 *
 * Prices in this app are GST-INCLUSIVE: the breakup shown on the invoice is
 * derived from the charged total, so amounts never change.
 */
export const COMPANY = {
  name:    'Nihal Ice Factory',
  tagline: 'Pure Ice — Delivered Fresh',
  gstin:   (import.meta.env.VITE_COMPANY_GSTIN as string | undefined) ?? '',
  address: (import.meta.env.VITE_COMPANY_ADDRESS as string | undefined) ?? '',
  /** HSN for ice and snow */
  hsnCode: (import.meta.env.VITE_ICE_HSN_CODE as string | undefined) ?? '2201',
  gstRatePercent: Number(import.meta.env.VITE_GST_RATE ?? 5),
};

export interface GstBreakup {
  taxableValue: number;
  cgst: number;
  sgst: number;
  ratePercent: number;
}

/** Splits a GST-inclusive total into taxable value + CGST/SGST halves. */
export function gstBreakupFromInclusive(total: number, ratePercent = COMPANY.gstRatePercent): GstBreakup {
  const taxableValue = Math.round((total / (1 + ratePercent / 100)) * 100) / 100;
  const tax = Math.round((total - taxableValue) * 100) / 100;
  const cgst = Math.round((tax / 2) * 100) / 100;
  return { taxableValue, cgst, sgst: Math.round((tax - cgst) * 100) / 100, ratePercent };
}
