import React from 'react';
import { useConversions } from '../../../lib/useConversions';
import { Card } from '../../../components';

function fmtNum(n: number): string {
  if (n === Math.floor(n)) return String(n);
  return parseFloat(n.toFixed(4)).toString();
}

const ConversionSummaryCard: React.FC = () => {
  const conversions = useConversions();

  if (!conversions.length) return null;

  // Group by fromTypeName
  const groups = new Map<string, { toName: string; factor: number }[]>();
  for (const c of conversions) {
    if (!groups.has(c.fromTypeName)) groups.set(c.fromTypeName, []);
    groups.get(c.fromTypeName)!.push({ toName: c.toTypeName, factor: Number(c.factor) });
  }

  return (
    <Card title="Size Conversions">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {Array.from(groups.entries()).map(([fromName, targets]) => (
          <div key={fromName} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14, minWidth: 80, color: 'var(--color-text)' }}>
              1 {fromName}
            </span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>=</span>
            {targets.map((t, idx) => (
              <React.Fragment key={t.toName}>
                <span
                  style={{
                    background: '#f0fdfa',
                    color: '#0f766e',
                    border: '1px solid #99f6e4',
                    borderRadius: 999,
                    padding: '2px 12px',
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {fmtNum(t.factor)} {t.toName}
                </span>
                {idx < targets.length - 1 && (
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>·</span>
                )}
              </React.Fragment>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
};

export default ConversionSummaryCard;
