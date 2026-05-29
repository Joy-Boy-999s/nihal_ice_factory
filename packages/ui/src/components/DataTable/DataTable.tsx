import React, { useMemo, useState } from 'react';
import './DataTable.css';

export interface Column<T> {
  key: string;
  title: React.ReactNode;
  render?: (row: T, index: number) => React.ReactNode;
  accessor?: keyof T;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowKey: (row: T) => React.Key;
  loading?: boolean;
  emptyMessage?: React.ReactNode;
  selectable?: boolean;
  selectedKeys?: React.Key[];
  onSelectionChange?: (keys: React.Key[]) => void;
  pageSize?: number;
}

export function DataTable<T>({
  data,
  columns,
  rowKey,
  loading = false,
  emptyMessage = 'No records found',
  selectable = false,
  selectedKeys,
  onSelectionChange,
  pageSize = 10,
}: DataTableProps<T>): React.ReactElement {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pagedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, currentPage, pageSize]);

  const allKeys = useMemo(() => pagedData.map(rowKey), [pagedData, rowKey]);
  const allSelectedOnPage =
    allKeys.length > 0 && allKeys.every((k) => selectedKeys?.includes(k));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelectedOnPage) {
      onSelectionChange((selectedKeys ?? []).filter((k) => !allKeys.includes(k)));
    } else {
      const next = new Set(selectedKeys ?? []);
      allKeys.forEach((k) => next.add(k));
      onSelectionChange(Array.from(next));
    }
  };

  const toggleRow = (key: React.Key) => {
    if (!onSelectionChange) return;
    const set = new Set(selectedKeys ?? []);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    onSelectionChange(Array.from(set));
  };

  return (
    <div className="ui-table-wrap">
      <div className="ui-table-scroll">
        <table className="ui-table">
          <thead>
            <tr>
              {selectable && (
                <th className="ui-table__select">
                  <input
                    type="checkbox"
                    checked={allSelectedOnPage}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width, textAlign: col.align ?? 'left' }}
                >
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="ui-table__state"
                >
                  <span className="ui-table__spinner" /> Loading…
                </td>
              </tr>
            ) : pagedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="ui-table__state"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pagedData.map((row, idx) => {
                const key = rowKey(row);
                const isSelected = selectedKeys?.includes(key);
                return (
                  <tr key={key} className={isSelected ? 'ui-table__row--selected' : ''}>
                    {selectable && (
                      <td className="ui-table__select">
                        <input
                          type="checkbox"
                          checked={!!isSelected}
                          onChange={() => toggleRow(key)}
                          aria-label="Select row"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        style={{ textAlign: col.align ?? 'left' }}
                      >
                        {col.render
                          ? col.render(row, (currentPage - 1) * pageSize + idx)
                          : col.accessor
                          ? String(row[col.accessor] ?? '')
                          : null}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {data.length > pageSize && (
        <div className="ui-table__pagination">
          <span className="ui-table__page-info">
            Showing {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, data.length)} of {data.length}
          </span>
          <div className="ui-table__page-controls">
            <button
              type="button"
              className="ui-table__page-btn"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Prev
            </button>
            <span className="ui-table__page-num">
              Page {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              className="ui-table__page-btn"
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
