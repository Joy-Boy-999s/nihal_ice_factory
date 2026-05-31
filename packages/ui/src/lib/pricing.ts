import type { IceTypeDto } from '@nihal-ice-factory/shared-models';
import type { SaleItem } from '../pages/addSales/model/types';

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Returns all active IceType entries for the given factory plant,
 * sorted by iceTypeName.
 * Returns an empty array when no plant is selected or none are configured.
 */
export function getIceTypesForPlant(
  apiTypes: IceTypeDto[],
  plantUnit?: string,
): IceTypeDto[] {
  if (!plantUnit) return [];
  return apiTypes
    .filter((t) => t.isActive && t.plantUnit === plantUnit)
    .sort((a, b) => a.iceTypeName.localeCompare(b.iceTypeName));
}

/**
 * Builds the initial items array for the sale form when a plant is selected.
 * Each ice type gets an input row starting at quantity "0".
 */
export function buildFormItems(iceTypes: IceTypeDto[]): SaleItem[] {
  return iceTypes.map((t) => ({
    iceTypeId:   t.id,
    iceTypeName: t.iceTypeName,
    iceTypeCode: t.iceTypeCode,
    price:       Number(t.price),
    quantity:    '0',
  }));
}

// ── Totals ────────────────────────────────────────────────────────────────

/** Sum of (quantity × price) minus discount, floored at 0. */
export function calculateTotal(items: SaleItem[], discount: number): number {
  const subtotal = items.reduce(
    (sum, i) => sum + (Number(i.quantity) || 0) * i.price,
    0,
  );
  return Math.max(0, subtotal - discount);
}

/** Sum of all quantities. */
export function calculateTotalUnits(items: SaleItem[]): number {
  return items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
}

// ── Display ───────────────────────────────────────────────────────────────

export function formatCurrency(value: number): string {
  return `${Number(value || 0).toLocaleString('en-IN')} Rs`;
}
