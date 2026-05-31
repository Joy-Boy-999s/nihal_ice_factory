import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import './Select.css';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps {
  options: SelectOption[];
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  id?: string;
  className?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
}

const ChevronDown: React.FC = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CheckMark: React.FC = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

interface DropdownPos {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  openUp: boolean;
}

export const Select: React.FC<SelectProps> = ({
  options,
  placeholder,
  invalid,
  disabled,
  value,
  onChange,
  id,
  className = '',
  name,
  size = 'md',
}) => {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<DropdownPos | null>(null);
    const [activeIdx, setActiveIdx] = useState(-1);

    const triggerRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const selectedOpt = options.find((o) => o.value === value);

    /* ── Position calculation ──────────────────────────────────── */
    const calcPos = useCallback((): DropdownPos | null => {
      if (!triggerRef.current) return null;
      const r = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom - 8;
      const spaceAbove = r.top - 8;
      const maxH = 280;
      const openUp = spaceBelow < Math.min(maxH, options.length * 44) && spaceAbove > spaceBelow;
      return {
        left: r.left,
        width: r.width,
        openUp,
        ...(openUp
          ? { bottom: window.innerHeight - r.top + 4 }
          : { top: r.bottom + 4 }),
      };
    }, [options.length]);

    /* ── Open / close ──────────────────────────────────────────── */
    const openMenu = useCallback(() => {
      const p = calcPos();
      setPos(p);
      setOpen(true);
      const idx = options.findIndex((o) => o.value === value);
      setActiveIdx(idx >= 0 ? idx : 0);
    }, [calcPos, options, value]);

    const closeMenu = useCallback(() => {
      setOpen(false);
      triggerRef.current?.focus();
    }, []);

    const handleSelect = useCallback(
      (optValue: string) => {
        const synthetic = {
          target: { value: optValue, name: name ?? '' },
          currentTarget: { value: optValue },
          preventDefault: () => {},
          stopPropagation: () => {},
        } as unknown as React.ChangeEvent<HTMLSelectElement>;
        onChange?.(synthetic);
        closeMenu();
      },
      [onChange, closeMenu, name],
    );

    /* ── Re-measure on scroll / resize so position stays fresh ── */
    useLayoutEffect(() => {
      if (!open) return;
      const update = () => {
        const p = calcPos();
        if (p) setPos(p);
      };
      window.addEventListener('scroll', update, true);
      window.addEventListener('resize', update);
      return () => {
        window.removeEventListener('scroll', update, true);
        window.removeEventListener('resize', update);
      };
    }, [open, calcPos]);

    /* ── Close on outside click ──────────────────────────────── */
    useEffect(() => {
      if (!open) return;
      const handler = (e: MouseEvent) => {
        if (
          !triggerRef.current?.contains(e.target as Node) &&
          !listRef.current?.contains(e.target as Node)
        ) {
          setOpen(false);
        }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    /* ── Scroll active item into view ────────────────────────── */
    useEffect(() => {
      if (!open || !listRef.current || activeIdx < 0) return;
      const el = listRef.current.querySelectorAll<HTMLElement>('[role="option"]')[activeIdx];
      el?.scrollIntoView({ block: 'nearest' });
    }, [activeIdx, open]);

    /* ── Keyboard navigation ─────────────────────────────────── */
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (disabled) return;

        if (!open) {
          if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
            e.preventDefault();
            openMenu();
          }
          return;
        }

        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setActiveIdx((i) => Math.min(i + 1, options.length - 1));
            break;
          case 'ArrowUp':
            e.preventDefault();
            setActiveIdx((i) => Math.max(i - 1, 0));
            break;
          case 'Enter':
          case ' ':
            e.preventDefault();
            if (activeIdx >= 0 && activeIdx < options.length) {
              handleSelect(options[activeIdx].value);
            }
            break;
          case 'Escape':
          case 'Tab':
            e.preventDefault();
            closeMenu();
            break;
          default: {
            /* type-ahead */
            const ch = e.key.toLowerCase();
            if (ch.length === 1) {
              const idx = options.findIndex((o) =>
                o.label.toLowerCase().startsWith(ch),
              );
              if (idx >= 0) setActiveIdx(idx);
            }
          }
        }
      },
      [disabled, open, options, activeIdx, handleSelect, openMenu, closeMenu],
    );

    /* ── Class names ─────────────────────────────────────────── */
    const wrapClass = [
      'ui-select',
      `ui-select--${size}`,
      invalid ? 'ui-select--invalid' : '',
      disabled ? 'ui-select--disabled' : '',
      open ? 'ui-select--open' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    /* ── Dropdown portal ─────────────────────────────────────── */
    const dropdown =
      open && pos
        ? createPortal(
            <ul
              ref={listRef}
              role="listbox"
              aria-label={placeholder ?? 'Options'}
              className={`ui-select__dropdown${pos.openUp ? ' ui-select__dropdown--up' : ''}`}
              style={{
                position: 'fixed',
                left: pos.left,
                width: pos.width,
                zIndex: 9999,
                ...(pos.openUp ? { bottom: pos.bottom } : { top: pos.top }),
              }}
            >
              {options.length === 0 ? (
                <li className="ui-select__option ui-select__option--empty" aria-disabled>
                  No options available
                </li>
              ) : (
                options.map((opt, idx) => {
                  const isSelected = opt.value === value;
                  const isActive = idx === activeIdx;
                  return (
                    <li
                      key={opt.value}
                      role="option"
                      aria-selected={isSelected}
                      className={[
                        'ui-select__option',
                        isSelected ? 'ui-select__option--selected' : '',
                        isActive ? 'ui-select__option--active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(opt.value);
                      }}
                    >
                      <span className="ui-select__option-label">{opt.label}</span>
                      {isSelected && (
                        <span className="ui-select__option-check">
                          <CheckMark />
                        </span>
                      )}
                    </li>
                  );
                })
              )}
            </ul>,
            document.body,
          )
        : null;

    return (
      <>
        <div className={wrapClass}>
          <button
            ref={triggerRef}
            type="button"
            id={id}
            className="ui-select__trigger"
            onClick={() => (open ? closeMenu() : openMenu())}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
          >
            <span
              className={[
                'ui-select__value',
                !selectedOpt ? 'ui-select__value--placeholder' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {selectedOpt ? selectedOpt.label : (placeholder ?? 'Select…')}
            </span>
            <span className="ui-select__chevron">
              <ChevronDown />
            </span>
          </button>
        </div>

        {dropdown}
      </>
  );
};
