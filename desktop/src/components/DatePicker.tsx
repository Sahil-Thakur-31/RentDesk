import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';
import { getCurrentLocale } from '../lib/i18n';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  picker?: 'date' | 'month';
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

const parseDateValue = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m) return null;
  return { year: y, month: m - 1, day: d || 1 };
};

const weekdayLabels = () => {
  const base = new Date(2023, 0, 1); // a Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d.toLocaleDateString(getCurrentLocale(), { weekday: 'narrow' });
  });
};

const monthLabels = () => {
  return Array.from({ length: 12 }, (_, i) => new Date(2023, i, 1).toLocaleDateString(getCurrentLocale(), { month: 'short' }));
};

const DatePicker = ({ value, onChange, picker = 'date', className = '', placeholder, disabled }: DatePickerProps) => {
  const today = new Date();
  const parsed = parseDateValue(value || '');
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'main' | 'year' | 'decade'>('main');
  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth());
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = parseDateValue(value || '');
    if (p) {
      setViewYear(p.year);
      setViewMonth(p.month);
    }
  }, [value]);

  useEffect(() => {
    if (open) setView('main');
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const updateCoords = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCoords({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    };
    updateCoords();

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const displayText = () => {
    if (!value) return placeholder || (picker === 'month' ? 'Select month' : 'Select date');
    const p = parseDateValue(value);
    if (!p) return placeholder || '';
    if (picker === 'month') {
      return new Date(p.year, p.month, 1).toLocaleDateString(getCurrentLocale(), { month: 'long', year: 'numeric' });
    }
    return new Date(p.year, p.month, p.day).toLocaleDateString(getCurrentLocale(), {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const selectDay = (day: number) => {
    onChange(`${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`);
    setOpen(false);
  };

  const selectMonth = (monthIndex: number) => {
    onChange(`${viewYear}-${pad2(monthIndex + 1)}`);
    setOpen(false);
  };

  const selectYear = (y: number) => {
    setViewYear(y);
    setView('main');
  };

  const selectDecade = (y: number) => {
    setViewYear(y);
    setView('year');
  };

  const goToToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    if (picker === 'month') {
      onChange(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}`);
    } else {
      onChange(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`);
    }
    setOpen(false);
  };

  const renderDateGrid = () => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startOffset = firstOfMonth.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
    const cells: { day: number; inCurrentMonth: boolean; y: number; m: number }[] = [];

    for (let i = startOffset - 1; i >= 0; i--) {
      cells.push({ day: daysInPrevMonth - i, inCurrentMonth: false, y: viewMonth === 0 ? viewYear - 1 : viewYear, m: viewMonth === 0 ? 11 : viewMonth - 1 });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, inCurrentMonth: true, y: viewYear, m: viewMonth });
    }
    while (cells.length < 42) {
      const idx = cells.length - startOffset - daysInMonth + 1;
      cells.push({ day: idx, inCurrentMonth: false, y: viewMonth === 11 ? viewYear + 1 : viewYear, m: viewMonth === 11 ? 0 : viewMonth + 1 });
    }

    return (
      <>
        <div className="grid grid-cols-7 gap-1 px-3 pt-1 text-center text-[11px] font-semibold uppercase text-[var(--muted)]">
          {weekdayLabels().map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 px-3 pb-3 pt-1.5">
          {cells.map((cell, i) => {
            const isSelected = parsed && cell.inCurrentMonth && parsed.year === cell.y && parsed.month === cell.m && parsed.day === cell.day;
            const isToday =
              cell.inCurrentMonth &&
              cell.y === today.getFullYear() &&
              cell.m === today.getMonth() &&
              cell.day === today.getDate();
            return (
              <button
                key={i}
                type="button"
                onClick={() => cell.inCurrentMonth && selectDay(cell.day)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm transition ${
                  !cell.inCurrentMonth
                    ? 'text-slate-300 cursor-default'
                    : isSelected
                      ? 'bg-[var(--accent)] text-white font-semibold'
                      : isToday
                        ? 'border border-[var(--accent)] text-[var(--accent)] font-semibold hover:bg-[var(--accent-soft)]'
                        : 'text-[var(--text)] hover:bg-[var(--surface-1)]'
                }`}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </>
    );
  };

  const renderMonthGrid = () => (
    <div className="grid grid-cols-3 gap-2 p-3">
      {monthLabels().map((label, i) => {
        const isSelected = parsed && parsed.year === viewYear && parsed.month === i;
        const isCurrent = viewYear === today.getFullYear() && i === today.getMonth();
        return (
          <button
            key={label}
            type="button"
            onClick={() => selectMonth(i)}
            className={`rounded-lg px-3 py-2.5 text-sm transition ${
              isSelected
                ? 'bg-[var(--accent)] text-white font-semibold'
                : isCurrent
                  ? 'border border-[var(--accent)] text-[var(--accent)] font-semibold hover:bg-[var(--accent-soft)]'
                  : 'text-[var(--text)] hover:bg-[var(--surface-1)]'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  const yearRangeStart = Math.floor(viewYear / 12) * 12;
  const renderYearGrid = () => (
    <div className="grid grid-cols-3 gap-2 p-3">
      {Array.from({ length: 12 }, (_, i) => yearRangeStart + i).map((y) => {
        const isSelected = y === viewYear;
        const isCurrent = y === today.getFullYear();
        return (
          <button
            key={y}
            type="button"
            onClick={() => selectYear(y)}
            className={`rounded-lg px-3 py-2.5 text-sm transition ${
              isSelected
                ? 'bg-[var(--accent)] text-white font-semibold'
                : isCurrent
                  ? 'border border-[var(--accent)] text-[var(--accent)] font-semibold hover:bg-[var(--accent-soft)]'
                  : 'text-[var(--text)] hover:bg-[var(--surface-1)]'
            }`}
          >
            {y}
          </button>
        );
      })}
    </div>
  );

  const decadeRangeStart = Math.floor(viewYear / 144) * 144;
  const renderDecadeGrid = () => (
    <div className="grid grid-cols-3 gap-2 p-3">
      {Array.from({ length: 12 }, (_, i) => decadeRangeStart + i * 12).map((y) => {
        const rangeEnd = y + 11;
        const isSelected = viewYear >= y && viewYear <= rangeEnd;
        const isCurrent = today.getFullYear() >= y && today.getFullYear() <= rangeEnd;
        return (
          <button
            key={y}
            type="button"
            onClick={() => selectDecade(y)}
            className={`rounded-lg px-2 py-2.5 text-xs font-medium transition ${
              isSelected
                ? 'bg-[var(--accent)] text-white font-semibold'
                : isCurrent
                  ? 'border border-[var(--accent)] text-[var(--accent)] font-semibold hover:bg-[var(--accent-soft)]'
                  : 'text-[var(--text)] hover:bg-[var(--surface-1)]'
            }`}
          >
            {y}-{rangeEnd}
          </button>
        );
      })}
    </div>
  );

  const headerLabel =
    view === 'decade'
      ? `${decadeRangeStart}-${decadeRangeStart + 143}`
      : view === 'year'
        ? `${yearRangeStart}-${yearRangeStart + 11}`
        : picker === 'month'
          ? String(viewYear)
          : new Date(viewYear, viewMonth, 1).toLocaleDateString(getCurrentLocale(), { month: 'long', year: 'numeric' });

  const stepBack = () => {
    if (view === 'decade') {
      setViewYear((y) => y - 144);
    } else if (view === 'year') {
      setViewYear((y) => y - 12);
    } else if (picker === 'month') {
      setViewYear((y) => y - 1);
    } else if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const stepForward = () => {
    if (view === 'decade') {
      setViewYear((y) => y + 144);
    } else if (view === 'year') {
      setViewYear((y) => y + 12);
    } else if (picker === 'month') {
      setViewYear((y) => y + 1);
    } else if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center justify-between gap-2 bg-white text-left text-sm text-[var(--text)] disabled:opacity-55 disabled:cursor-not-allowed ${className || 'w-full px-3 py-2 rounded-xl'}`}
      >
        <span className={value ? '' : 'text-[var(--muted)]'}>{displayText()}</span>
        <CalendarIcon width={16} height={16} className="shrink-0 text-[var(--muted)]" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 1000 }}
            className="w-[280px] overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.18)]"
          >
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <button type="button" onClick={stepBack} className="icon-btn h-7 w-7">
                <ChevronLeftIcon width={15} height={15} />
              </button>
              <button
                type="button"
                onClick={() => setView(view === 'main' ? 'year' : view === 'year' ? 'decade' : 'decade')}
                disabled={view === 'decade'}
                className="rounded-lg px-2 py-1 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-1)] hover:text-[var(--accent)] disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-[var(--text)]"
              >
                {headerLabel}
              </button>
              <button type="button" onClick={stepForward} className="icon-btn h-7 w-7">
                <ChevronRightIcon width={15} height={15} />
              </button>
            </div>
            {view === 'decade' ? renderDecadeGrid() : view === 'year' ? renderYearGrid() : picker === 'month' ? renderMonthGrid() : renderDateGrid()}
            {view === 'main' && (
              <div className="border-t border-black/5 px-3 py-2">
                <button type="button" onClick={goToToday} className="text-xs font-medium text-[var(--accent)] hover:underline">
                  {picker === 'month' ? 'This month' : 'Today'}
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
};

export default DatePicker;
