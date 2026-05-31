import type { IceSizeConversionDto } from '@nihal-ice-factory/shared-models';

function fmtNum(n: number): string {
  if (n === Math.floor(n)) return String(n);
  return parseFloat(n.toPrecision(6)).toString();
}

export interface ConversionResult {
  toName: string;
  value:  number;
  label:  string;
}

export interface SaleConvTotal {
  typeName: string;
  total:    number;
}

// ─── Transitive engine ───────────────────────────────────────────────────────

/**
 * Builds a full conversion map including transitive paths and inverses.
 * Returns Map<"fromLower|||toDisplay" → factor>.
 */
function buildFullMap(
  conversions: IceSizeConversionDto[],
): { fullMap: Map<string, number>; nameMap: Map<string, string> } {
  // nameMap: lowercase → original-case display name
  const nameMap = new Map<string, string>();
  for (const c of conversions) {
    nameMap.set(c.fromTypeName.trim().toLowerCase(), c.fromTypeName.trim());
    nameMap.set(c.toTypeName.trim().toLowerCase(),   c.toTypeName.trim());
  }
  const names = Array.from(nameMap.keys());

  // Direct edges (forward + inverse)
  const direct = new Map<string, number>();
  for (const c of conversions) {
    const fk = c.fromTypeName.trim().toLowerCase();
    const td = c.toTypeName.trim();
    direct.set(`${fk}|||${td}`, Number(c.factor));
    const tk = c.toTypeName.trim().toLowerCase();
    const fd = c.fromTypeName.trim();
    if (!direct.has(`${tk}|||${fd}`)) direct.set(`${tk}|||${fd}`, 1 / Number(c.factor));
  }

  // BFS from every node to derive all transitive paths
  const fullMap = new Map<string, number>(direct);
  for (const start of names) {
    const dist = new Map<string, number>([[start, 1]]);
    const queue = [start];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const next of names) {
        if (dist.has(next)) continue;
        const nextDisplay = nameMap.get(next)!;
        const edgeKey     = `${curr}|||${nextDisplay}`;
        const f           = direct.get(edgeKey);
        if (f !== undefined) {
          const derived = dist.get(curr)! * f;
          dist.set(next, derived);
          fullMap.set(`${start}|||${nextDisplay}`, derived);
          queue.push(next);
        }
      }
    }
  }

  return { fullMap, nameMap };
}

// ─── Public helpers ──────────────────────────────────────────────────────────

/**
 * Returns all direct conversions FROM a type for a given quantity.
 * Used in form inputs — direct only to keep it concise.
 */
export function getConvertedAmounts(
  fromName: string,
  qty: number,
  conversions: IceSizeConversionDto[],
): ConversionResult[] {
  if (!qty || qty <= 0) return [];
  const key = fromName.trim().toLowerCase();
  return conversions
    .filter(c => c.fromTypeName.trim().toLowerCase() === key)
    .map(c => {
      const value = qty * Number(c.factor);
      return { toName: c.toTypeName, value, label: `≈ ${fmtNum(value)} ${c.toTypeName}` };
    });
}

/**
 * Aggregates ALL items in a sale into grand totals per type,
 * including transitive paths (e.g. Block→Can→Piece shown even if Block→Piece not stored).
 */
export function getSaleConversionTotals(
  items: { iceTypeName: string; quantity: number }[],
  conversions: IceSizeConversionDto[],
): SaleConvTotal[] {
  if (!conversions.length) return [];

  const { fullMap, nameMap } = buildFullMap(conversions);
  const totals = new Map<string, { total: number; display: string }>();

  for (const item of items) {
    const fromKey = item.iceTypeName.trim().toLowerCase();
    for (const [toLower, toDisplay] of nameMap.entries()) {
      if (toLower === fromKey) continue;
      const factor = fullMap.get(`${fromKey}|||${toDisplay}`);
      if (factor === undefined) continue;
      const entry = totals.get(toLower) ?? { total: 0, display: toDisplay };
      totals.set(toLower, { total: entry.total + item.quantity * factor, display: toDisplay });
    }
  }

  return Array.from(totals.values()).map(e => ({ typeName: e.display, total: e.total }));
}

/** Single-line string for a single item's direct conversions. */
export function conversionLine(
  fromName: string,
  qty: number,
  conversions: IceSizeConversionDto[],
): string {
  return getConvertedAmounts(fromName, qty, conversions).map(r => r.label).join(' · ');
}
