export const PRICE_PER_CAN = 240;
export const PRICE_PER_BLOCK = 80;
export const PRICE_PER_PIECE = 20;

export function calculateTotal(
  cans: number,
  blocks: number,
  pieces: number,
  discount = 0
): number {
  const subtotal =
    cans * PRICE_PER_CAN +
    blocks * PRICE_PER_BLOCK +
    pieces * PRICE_PER_PIECE;
  return Math.max(0, subtotal - discount);
}

export function calculateTotalCans(
  cans: number,
  blocks: number,
  pieces: number
): number {
  return cans + blocks / 3 + pieces / 12;
}

export function formatCurrency(value: number): string {
  return `${Number(value || 0).toLocaleString('en-IN')} Rs`;
}
