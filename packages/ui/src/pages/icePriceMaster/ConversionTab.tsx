import React, { useEffect, useMemo, useState } from 'react';
import { IceTypeDto, IceSizeConversionDto } from '@nihal-ice-factory/shared-models';
import { IceSizeConversionService } from '@nihal-ice-factory/shared-services';
import { Button, useToast } from '../../components';
import { buildAuthConfig } from '../../lib/auth';

interface Props {
  iceTypes: IceTypeDto[];
}

function uniqueNames(types: IceTypeDto[]): string[] {
  return Array.from(new Set(types.map(t => t.iceTypeName))).sort();
}

function cellKey(from: string, to: string): string {
  return `${from}|||${to}`;
}

function fmtFactor(n: number): string {
  if (!isFinite(n) || n <= 0) return '';
  const rounded = parseFloat(n.toPrecision(6));
  return rounded === Math.floor(rounded) ? String(rounded) : String(rounded);
}

interface CellInfo {
  factor:    number;
  isDerived: boolean;
}

/**
 * From all manual cells, build a directed graph (including inverses),
 * then BFS from every node to discover all transitive conversions.
 */
function computeAll(
  names: string[],
  manualCells: Record<string, string>,
): Record<string, CellInfo> {
  // Build direct edges: manual entries + their inverses
  const direct: Record<string, number> = {};

  for (const [key, val] of Object.entries(manualCells)) {
    if (!val) continue;
    const f = Number(val);
    if (isNaN(f) || f <= 0) continue;
    direct[key] = f;
    const [from, to] = key.split('|||');
    const invKey = cellKey(to, from);
    if (!direct[invKey]) direct[invKey] = 1 / f;
  }

  const result: Record<string, CellInfo> = {};

  // BFS from every starting node
  for (const start of names) {
    const dist: Record<string, number> = { [start]: 1 };
    const queue = [start];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const next of names) {
        if (next in dist) continue;
        const k = cellKey(curr, next);
        if (direct[k] !== undefined) {
          dist[next] = dist[curr] * direct[k];
          queue.push(next);
        }
      }
    }

    for (const [target, factor] of Object.entries(dist)) {
      if (target === start) continue;
      const k        = cellKey(start, target);
      const manualVal = manualCells[k];
      const isManual  = !!manualVal && Number(manualVal) > 0;
      result[k] = { factor, isDerived: !isManual };
    }
  }

  return result;
}

const ConversionTab: React.FC<Props> = ({ iceTypes }) => {
  const toast   = useToast();
  const service = useMemo(() => new IceSizeConversionService(), []);
  const names   = useMemo(() => uniqueNames(iceTypes), [iceTypes]);

  const [manualCells, setManualCells] = useState<Record<string, string>>({});
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);

  // Load saved (manual) conversions once
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    service.getAll(buildAuthConfig()).then(res => {
      if (cancelled) return;
      setLoading(false);
      if (!res?.status) return;
      const raw =
        (res.data as { data?: IceSizeConversionDto[] })?.data ??
        (res.data as IceSizeConversionDto[]) ?? [];
      const list: IceSizeConversionDto[] = Array.isArray(raw) ? raw : [];
      const next: Record<string, string> = {};
      for (const c of list) {
        next[cellKey(c.fromTypeName, c.toTypeName)] = fmtFactor(Number(c.factor));
      }
      setManualCells(next);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names.join(',')]);

  // All conversions = manual + derived (recomputed on every keystroke)
  const allCells = useMemo(
    () => computeAll(names, manualCells),
    [names, manualCells],
  );

  const setManual = (from: string, to: string, value: string) => {
    setManualCells(prev => ({ ...prev, [cellKey(from, to)]: value }));
  };

  const handleSave = async () => {
    for (const [key, val] of Object.entries(manualCells)) {
      if (!val) continue;
      const n = Number(val);
      if (isNaN(n) || n <= 0) {
        const [from, to] = key.split('|||');
        toast.error(`Invalid value for 1 ${from} → ${to}. Must be a positive number.`);
        return;
      }
    }

    setSaving(true);
    try {
      const conversions = Object.entries(manualCells)
        .filter(([, val]) => val !== '' && val !== undefined)
        .map(([key, val]) => {
          const [fromTypeName, toTypeName] = key.split('|||');
          return { fromTypeName, toTypeName, factor: Number(val) };
        });

      const res = await service.saveAll(conversions, buildAuthConfig());
      if (!res?.status) throw new Error(res?.internalMessage || 'Save failed');
      toast.success('Conversions saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => setManualCells({});

  if (names.length === 0) {
    return (
      <div className="ipm-conv-empty">
        <p>No ice types configured yet. Add ice types in the <strong>Ice Types</strong> tab first.</p>
      </div>
    );
  }

  if (names.length === 1) {
    return (
      <div className="ipm-conv-empty">
        <p>You need at least <strong>2 ice types</strong> to define conversions.</p>
      </div>
    );
  }

  return (
    <div className="ipm-conv-tab">
      <div className="ipm-conv-card">
        <div className="ipm-conv-card__header">
          <h3 className="ipm-conv-card__title">Size Conversions</h3>
          <p className="ipm-conv-card__desc">
            Fill in the white cells — <em>1 [row] = value [column]</em>.
            Teal cells are calculated automatically.
          </p>
        </div>

        {loading ? (
          <div className="ipm-conv-loading">Loading conversions…</div>
        ) : (
          <>
            <div className="ipm-conv-matrix-wrap">
              <table className="ipm-conv-matrix">
                <thead>
                  <tr>
                    <th className="ipm-conv-matrix__corner">
                      <span className="ipm-conv-matrix__corner-from">From ↓</span>
                      <span className="ipm-conv-matrix__corner-to">To →</span>
                    </th>
                    {names.map(col => (
                      <th key={col} className="ipm-conv-matrix__col-head">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {names.map(row => (
                    <tr key={row}>
                      <td className="ipm-conv-matrix__row-head">{row}</td>
                      {names.map(col => {
                        if (row === col) {
                          return <td key={col} className="ipm-conv-matrix__self">—</td>;
                        }
                        const key        = cellKey(row, col);
                        const manualVal  = manualCells[key] ?? '';
                        const computed   = allCells[key];
                        const isDerived  = computed?.isDerived && !manualVal;

                        if (isDerived && computed) {
                          // Read-only derived cell
                          return (
                            <td key={col} className="ipm-conv-matrix__derived-cell">
                              <span className="ipm-conv-derived-val">
                                ≈ {fmtFactor(computed.factor)}
                              </span>
                            </td>
                          );
                        }

                        return (
                          <td key={col} className="ipm-conv-matrix__input-cell">
                            <input
                              type="number"
                              min="0.0001"
                              step="any"
                              className="ipm-conv-cell-input"
                              placeholder="—"
                              value={manualVal}
                              onChange={e => setManual(row, col, e.target.value)}
                              aria-label={`1 ${row} = ? ${col}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="ipm-conv-matrix-hint">
              Only enter what you know directly — e.g. set 1 Can = 3 Blocks and 1 Block = 4 Pieces,
              and 1 Can = 12 Pieces fills in automatically.
            </p>

            <div className="ipm-conv-actions">
              <Button id="clear-conv" variant="secondary" onClick={handleClear} disabled={saving}>
                Clear Manual
              </Button>
              <Button id="save-conv" onClick={handleSave} loading={saving}>
                Save Conversions
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ConversionTab;
