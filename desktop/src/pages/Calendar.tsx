import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import PropertyPicker from '../components/PropertyPicker';
import DatePicker from '../components/DatePicker';
import { CloseIcon, ChevronDownIcon } from '../components/icons';
import { formatDate, formatMonthKey, getCurrentMonthValue, shiftMonthValue } from '../lib/dateFormat';
import { cachedGet } from '../lib/queryCache';
import { toast } from '../lib/toast';
import { formatCurrency } from '../lib/format';
import { getHolidaysForYear } from '../lib/indianHolidays';
import { getMoonPhaseForDate, MOON_PHASE_ICONS, MOON_PHASE_LABELS } from '../lib/moonPhase';

type CalendarCategory =
  | 'rentDue'
  | 'electricityDue'
  | 'maintenanceDue'
  | 'rentReceived'
  | 'utilityPaid'
  | 'maintenanceCollected'
  | 'depositReceived'
  | 'depositRefunded'
  | 'otherPayment'
  | 'maintenanceSpent'
  | 'nationalHoliday'
  | 'festival'
  | 'moonPhase';

type CalendarEvent = {
  id: string;
  date: string;
  title: string;
  detail: string;
  propertyId: string;
  propertyName: string;
  category: CalendarCategory;
  viewPath: string;
};

const CATEGORY_META: Record<CalendarCategory, { label: string; group: string; className: string; dot: string }> = {
  rentDue: { label: 'Rent Due', group: 'Needs Attention', className: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  electricityDue: { label: 'Electricity Due', group: 'Needs Attention', className: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  maintenanceDue: { label: 'Maintenance Due', group: 'Needs Attention', className: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  rentReceived: { label: 'Rent Received', group: 'Money In', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  utilityPaid: { label: 'Utility Paid', group: 'Money In', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  maintenanceCollected: { label: 'Maintenance Collected', group: 'Money In', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  depositReceived: { label: 'Deposit Received', group: 'Money In', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  depositRefunded: { label: 'Deposit Refunded', group: 'Other', className: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
  otherPayment: { label: 'Other Payment', group: 'Other', className: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
  maintenanceSpent: { label: 'Maintenance Spent', group: 'Expenses', className: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  nationalHoliday: { label: 'National Holiday', group: 'Calendar', className: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  festival: { label: 'Festival', group: 'Calendar', className: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200', dot: 'bg-fuchsia-500' },
  moonPhase: { label: 'Moon Phase', group: 'Calendar', className: 'bg-slate-100 text-slate-600 border-slate-300', dot: 'bg-slate-400' }
};

const ALL_CATEGORIES = Object.keys(CATEGORY_META) as CalendarCategory[];
const GROUP_ORDER = ['Needs Attention', 'Money In', 'Other', 'Expenses', 'Calendar'];

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getId = (value: any) => String(value?._id || value || '');
const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

const getMonthBounds = (monthValue: string) => {
  const [year, month] = monthValue.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start, end, year, month };
};

const makeDayGrid = (monthValue: string) => {
  const { start } = getMonthBounds(monthValue);
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - start.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
};

const Calendar = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<any[]>([]);
  const [portfolioSettings, setPortfolioSettings] = useState({
    rentDueDay: 5,
    electricityDueDay: 10,
    maintenanceDueDay: 7
  });
  const [propertyId, setPropertyId] = useState('');
  const [monthValue, setMonthValue] = useState(getCurrentMonthValue());
  const [selectedDate, setSelectedDate] = useState(toDateInput(new Date()));
  const [showDayModal, setShowDayModal] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCategories, setVisibleCategories] = useState<Set<CalendarCategory>>(new Set(ALL_CATEGORIES));
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const [filterCoords, setFilterCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const loadProperties = async () => {
      try {
        const [propertiesData, portfolioData] = await Promise.all([
          cachedGet('/properties', { archived: false }),
          cachedGet('/portfolio')
        ]);
        setProperties(propertiesData || []);
        const portfolio = portfolioData?.portfolio;
        if (portfolio) {
          setPortfolioSettings({
            rentDueDay: Number(portfolio.rentDueDay || 5),
            electricityDueDay: Number(portfolio.electricityDueDay || 10),
            maintenanceDueDay: Number(portfolio.maintenanceDueDay || 7)
          });
        }
      } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Unable to load calendar portfolios.');
      }
    };

    void loadProperties();
  }, []);

  useEffect(() => {
    if (!showFilterPanel) return;

    const updateCoords = () => {
      const rect = filterTriggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setFilterCoords({ top: rect.bottom + 6, left: Math.max(12, rect.right - 320) });
    };
    updateCoords();

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (filterTriggerRef.current?.contains(target) || filterPanelRef.current?.contains(target)) return;
      setShowFilterPanel(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowFilterPanel(false);
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
  }, [showFilterPanel]);

  useEffect(() => {
    const { start, end, month, year } = getMonthBounds(monthValue);
    const currentDate = selectedDate ? new Date(selectedDate) : null;
    if (!currentDate || currentDate.getFullYear() != year || currentDate.getMonth() != month - 1) {
      setSelectedDate(toDateInput(start));
    }

    const buildCalendarExtraEvents = (): CalendarEvent[] => {
      const extras: CalendarEvent[] = [];
      const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

      getHolidaysForYear(year)
        .filter((holiday) => holiday.date.startsWith(monthPrefix))
        .forEach((holiday) => {
          extras.push({
            id: `holiday-${holiday.date}-${holiday.name}`,
            date: holiday.date,
            title: holiday.name,
            detail: holiday.category === 'festival' ? 'Festival' : 'National Holiday',
            propertyId: '',
            propertyName: '',
            category: holiday.category,
            viewPath: ''
          });
        });

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const phase = getMoonPhaseForDate(d);
        if (phase) {
          extras.push({
            id: `moon-${toDateInput(d)}`,
            date: toDateInput(d),
            title: `${MOON_PHASE_ICONS[phase]} ${MOON_PHASE_LABELS[phase]}`,
            detail: MOON_PHASE_LABELS[phase],
            propertyId: '',
            propertyName: '',
            category: 'moonPhase',
            viewPath: ''
          });
        }
      }

      return extras;
    };

    const loadEvents = async () => {
      const extraEvents = buildCalendarExtraEvents();

      if (!properties.length) {
        setEvents(extraEvents.sort((left, right) => left.date.localeCompare(right.date)));
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const activeProperties = propertyId
          ? properties.filter((property) => property._id === propertyId)
          : properties;

        const eventBuckets = await Promise.all(
          activeProperties.map(async (property) => {
            const paymentEndDate = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59).toISOString();
            const [rentData, utilityData, maintenanceData, tenantData, paymentData] = await Promise.all([
              cachedGet(`/properties/${property._id}/rent-records`, { month, year, status: 'unpaid,partial' }),
              cachedGet(`/properties/${property._id}/utility-bills`, { month: monthValue, status: 'unpaid,partial' }),
              cachedGet(`/properties/${property._id}/maintenance`),
              cachedGet(`/properties/${property._id}/tenants`, { status: 'active' }),
              cachedGet(`/properties/${property._id}/payments`, { startDate: start.toISOString(), endDate: paymentEndDate })
            ]);

            const dueDay = toDateInput(new Date(year, month - 1, portfolioSettings.rentDueDay));
            const utilityDay = toDateInput(new Date(year, month - 1, portfolioSettings.electricityDueDay));
            const maintenanceDay = toDateInput(new Date(year, month - 1, portfolioSettings.maintenanceDueDay));

            const rentEvents: CalendarEvent[] = (rentData || []).map((record: any) => {
              const paidAmount = Number(record.paidAmount || 0);
              const remaining = Math.max(0, Number(record.rentAmount || 0) - paidAmount);
              const tenantName = record.tenantId?.fullName || 'Tenant';
              const unitName = record.unitId?.unitNumber || 'Unit';
              return {
                id: `rent-due-${record._id}`,
                date: dueDay,
                title: `${tenantName} - ${unitName} rent due`,
                detail: `${property.name} - Remaining ₹${formatCurrency(remaining)}`,
                propertyId: property._id,
                propertyName: property.name,
                category: 'rentDue',
                viewPath: record.tenantId?._id
                  ? `/properties/${property._id}/tenants/${record.tenantId._id}`
                  : `/properties/${property._id}`
              } as CalendarEvent;
            });

            const utilityEvents: CalendarEvent[] = (utilityData || []).map((bill: any) => ({
              id: `utility-due-${bill._id}`,
              date: utilityDay,
              title: `${bill.tenantId?.fullName || bill.unitId?.currentTenant?.fullName || 'Tenant'} - ${bill.unitId?.unitNumber || 'Unit'} electricity`,
              detail: `${property.name} - Pending ₹${formatCurrency(bill.amount)}`,
              propertyId: property._id,
              propertyName: property.name,
              category: 'electricityDue',
              viewPath: bill.unitId?._id
                ? `/properties/${property._id}/units/${bill.unitId._id}`
                : `/properties/${property._id}`
            }));

            const maintenanceEvents: CalendarEvent[] = (maintenanceData || [])
              .filter((record: any) => {
                const recordDate = new Date(record.date);
                return recordDate >= start && recordDate <= new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59);
              })
              .map((record: any) => ({
                id: `maintenance-expense-${record._id}`,
                date: toDateInput(new Date(record.date)),
                title: record.category || 'Maintenance expense',
                detail: `${property.name} - ₹${formatCurrency(record.amount)}${record.paidTo ? ` - ${record.paidTo}` : ''}`,
                propertyId: property._id,
                propertyName: property.name,
                category: 'maintenanceSpent',
                viewPath: '/transactions'
              }));

            const collectedMaintenanceTenantIds = new Set(
              (paymentData || [])
                .filter((payment: any) => payment.type === 'maintenance' && /maintenance collected/i.test(String(payment.notes || '')))
                .map((payment: any) => getId(payment.tenantId))
            );

            const maintenanceDueEvents: CalendarEvent[] = (tenantData || [])
              .filter((tenant: any) => !collectedMaintenanceTenantIds.has(getId(tenant._id)))
              .filter(() => Number(property.maintenanceCharge || 0) > 0)
              .map((tenant: any) => ({
                id: `maintenance-due-${tenant._id}`,
                date: maintenanceDay,
                title: `${tenant.fullName || 'Tenant'} - ${tenant.unitId?.unitNumber || 'Unit'} maintenance due`,
                detail: `${property.name} - Remaining ₹${formatCurrency(property.maintenanceCharge || 0)}`,
                propertyId: property._id,
                propertyName: property.name,
                category: 'maintenanceDue',
                viewPath: tenant._id ? `/properties/${property._id}/tenants/${tenant._id}` : `/properties/${property._id}`
              }));

            const paymentEvents: CalendarEvent[] = (paymentData || [])
              .filter((payment: any) => !(payment.type === 'maintenance' && payment.sourceType === 'maintenance'))
              .map((payment: any) => {
                const category: CalendarCategory =
                  payment.type === 'rent'
                    ? 'rentReceived'
                    : payment.type === 'utility'
                      ? 'utilityPaid'
                      : payment.type === 'deposit'
                        ? 'depositReceived'
                        : payment.type === 'refund'
                          ? 'depositRefunded'
                          : payment.type === 'maintenance'
                            ? 'maintenanceCollected'
                            : 'otherPayment';

                const labelMap: Record<string, string> = {
                  rent: `${payment.tenantId?.fullName || payment.unitId?.unitNumber || 'Tenant'} rent received`,
                  utility: `${payment.tenantId?.fullName || payment.unitId?.unitNumber || 'Tenant'} utility paid`,
                  deposit: `${payment.tenantId?.fullName || 'Tenant'} deposit received`,
                  refund: `${payment.tenantId?.fullName || 'Tenant'} deposit refunded`,
                  maintenance: `${payment.tenantId?.fullName || payment.unitId?.unitNumber || 'Tenant'} maintenance received`,
                  other: payment.notes || 'Other payment'
                };

                return {
                  id: `payment-${payment._id}`,
                  date: toDateInput(new Date(payment.date)),
                  title: labelMap[payment.type] || 'Payment',
                  detail: `${property.name} - ₹${formatCurrency(payment.amount)}${payment.notes ? ` - ${payment.notes}` : ''}`,
                  propertyId: property._id,
                  propertyName: property.name,
                  category,
                  viewPath: payment.tenantId?._id
                    ? `/properties/${property._id}/tenants/${payment.tenantId._id}`
                    : payment.unitId?._id
                      ? `/properties/${property._id}/units/${payment.unitId._id}`
                      : '/transactions'
                } as CalendarEvent;
              });

            return [...rentEvents, ...utilityEvents, ...maintenanceDueEvents, ...maintenanceEvents, ...paymentEvents];
          })
        );

        setEvents(
          [...extraEvents, ...eventBuckets.flat()].sort(
            (left, right) => left.date.localeCompare(right.date) || left.title.localeCompare(right.title)
          )
        );
      } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Unable to load calendar events.');
      } finally {
        setLoading(false);
      }
    };

    void loadEvents();
  }, [monthValue, propertyId, properties, portfolioSettings]);

  const filteredEvents = useMemo(
    () => events.filter((event) => visibleCategories.has(event.category)),
    [events, visibleCategories]
  );

  const eventsByDate = useMemo(() => {
    return filteredEvents.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
      acc[event.date] = acc[event.date] || [];
      acc[event.date].push(event);
      return acc;
    }, {});
  }, [filteredEvents]);

  const selectedDateEvents = eventsByDate[selectedDate] || [];
  const dayGrid = useMemo(() => makeDayGrid(monthValue), [monthValue]);
  const { month, year } = getMonthBounds(monthValue);

  const summary = useMemo(() => {
    return {
      due: events.filter((event) => CATEGORY_META[event.category].group === 'Needs Attention').length,
      incoming: events.filter((event) => CATEGORY_META[event.category].group === 'Money In').length,
      expense: events.filter((event) => CATEGORY_META[event.category].group === 'Expenses').length
    };
  }, [events]);

  const categoriesByGroup = useMemo(() => {
    const map = new Map<string, CalendarCategory[]>();
    ALL_CATEGORIES.forEach((category) => {
      const group = CATEGORY_META[category].group;
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(category);
    });
    return map;
  }, []);

  const toggleCategory = (category: CalendarCategory) => {
    setVisibleCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const toggleGroup = (group: string) => {
    const groupCategories = categoriesByGroup.get(group) || [];
    const allOn = groupCategories.every((category) => visibleCategories.has(category));
    setVisibleCategories((prev) => {
      const next = new Set(prev);
      groupCategories.forEach((category) => {
        if (allOn) next.delete(category);
        else next.add(category);
      });
      return next;
    });
  };

  return (
    <div className='space-y-6 pb-6'>
      <div className='card !rounded-3xl p-6'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='text-sm uppercase tracking-[0.22em] text-[var(--muted)]'>Portfolio Calendar</div>
          <div className='flex flex-wrap items-center gap-3'>
            <PropertyPicker properties={properties} value={propertyId} onChange={setPropertyId} />
            <button
              type='button'
              className='rounded-xl border border-black/10 bg-white px-3 py-2 text-sm hover:bg-black/5'
              onClick={() => setMonthValue((current) => shiftMonthValue(current, -1))}
            >
              {'<'}
            </button>
            <DatePicker
              picker='month'
              value={monthValue}
              onChange={(next) => setMonthValue(next)}
              className='w-[150px] rounded-xl border border-black/10 px-3 py-2'
            />
            <button
              type='button'
              className='rounded-xl border border-black/10 bg-white px-3 py-2 text-sm hover:bg-black/5'
              onClick={() => setMonthValue((current) => shiftMonthValue(current, 1))}
            >
              {'>'}
            </button>
            <button
              type='button'
              className='rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white'
              onClick={() => {
                const currentMonth = getCurrentMonthValue();
                setMonthValue(currentMonth);
                const today = new Date();
                setSelectedDate(toDateInput(today));
              }}
            >
              Today
            </button>
            <button
              ref={filterTriggerRef}
              type='button'
              onClick={() => setShowFilterPanel((prev) => !prev)}
              className='flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm hover:bg-black/5'
            >
              Filters
              {visibleCategories.size < ALL_CATEGORIES.length && (
                <span className='flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[11px] font-semibold text-white'>
                  {visibleCategories.size}
                </span>
              )}
              <ChevronDownIcon width={14} height={14} className='text-[var(--muted)]' />
            </button>
          </div>
        </div>

        {showFilterPanel &&
          createPortal(
            <div
              ref={filterPanelRef}
              style={{ position: 'fixed', top: filterCoords.top, left: filterCoords.left, zIndex: 1000 }}
              className='w-[320px] max-h-[70vh] overflow-y-auto rounded-2xl border border-black/5 bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.18)]'
            >
              <div className='mb-2 flex items-center justify-between'>
                <div className='text-sm font-semibold'>Show on calendar</div>
                <div className='flex items-center gap-2 text-xs font-medium'>
                  <button type='button' className='text-[var(--accent)] hover:underline' onClick={() => setVisibleCategories(new Set(ALL_CATEGORIES))}>
                    All
                  </button>
                  <span className='text-[var(--muted)]'>·</span>
                  <button type='button' className='text-[var(--accent)] hover:underline' onClick={() => setVisibleCategories(new Set())}>
                    None
                  </button>
                </div>
              </div>
              {GROUP_ORDER.map((group) => {
                const groupCategories = categoriesByGroup.get(group) || [];
                return (
                  <div key={group} className='mb-3 last:mb-0'>
                    <button
                      type='button'
                      onClick={() => toggleGroup(group)}
                      className='mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)] hover:text-[var(--text)]'
                    >
                      {group}
                    </button>
                    <div className='space-y-1'>
                      {groupCategories.map((category) => (
                        <label
                          key={category}
                          className='flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm hover:bg-[var(--surface-1)] cursor-pointer'
                        >
                          <input
                            type='checkbox'
                            checked={visibleCategories.has(category)}
                            onChange={() => toggleCategory(category)}
                            className='h-3.5 w-3.5 accent-[var(--accent)]'
                          />
                          <span className={`h-2 w-2 rounded-full ${CATEGORY_META[category].dot}`} />
                          <span>{CATEGORY_META[category].label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>,
            document.body
          )}

        <div className='mt-4 grid gap-3 md:grid-cols-3'>
          <div className='flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-2.5'>
            <div>
              <div className='text-[11px] uppercase tracking-wide text-amber-700'>Due Items</div>
              <div className='text-[11px] text-amber-700/80'>rent and electricity due</div>
            </div>
            <div className='text-xl font-semibold text-amber-950'>{summary.due}</div>
          </div>
          <div className='flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-2.5'>
            <div>
              <div className='text-[11px] uppercase tracking-wide text-emerald-700'>Collected</div>
              <div className='text-[11px] text-emerald-700/80'>rent, deposit &amp; maintenance</div>
            </div>
            <div className='text-xl font-semibold text-emerald-950'>{summary.incoming}</div>
          </div>
          <div className='flex items-center justify-between rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-2.5'>
            <div>
              <div className='text-[11px] uppercase tracking-wide text-rose-700'>Spent</div>
              <div className='text-[11px] text-rose-700/80'>maintenance expenses</div>
            </div>
            <div className='text-xl font-semibold text-rose-950'>{summary.expense}</div>
          </div>
        </div>
      </div>

      <div className='card !rounded-3xl p-6'>
        <div className='mb-4 flex items-center justify-between'>
          <div>
            <div className='text-sm uppercase tracking-[0.22em] text-[var(--muted)]'>Month View</div>
            <div className='mt-1 text-xl font-semibold'>{formatMonthKey(monthValue)}</div>
          </div>
          {loading ? <div className='text-sm text-[var(--muted)]'>Loading events...</div> : null}
        </div>

        <div className='grid grid-cols-7 gap-2 text-xs uppercase tracking-wide text-[var(--muted)]'>
          {weekdayLabels.map((label) => (
            <div key={label} className='px-2 py-1'>
              {label}
            </div>
          ))}
        </div>

        <div className='mt-2 grid grid-cols-7 gap-2'>
          {dayGrid.map((date) => {
            const dateKey = toDateInput(date);
            const isCurrentMonth = date.getMonth() === month - 1 && date.getFullYear() === year;
            const isSelected = dateKey === selectedDate;
            const dayEvents = eventsByDate[dateKey] || [];

            return (
              <button
                key={dateKey}
                type='button'
                onClick={() => {
                  setSelectedDate(dateKey);
                  if (!isCurrentMonth) {
                    setMonthValue(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
                  }
                  setShowDayModal(true);
                }}
                className={`min-h-[140px] rounded-2xl border p-3 text-left transition ${
                  isSelected
                    ? 'border-[var(--accent)] bg-[var(--surface-1)] shadow-sm'
                    : 'border-black/5 bg-white hover:bg-[var(--surface-1)]'
                }`}
              >
                <div className={`text-sm font-medium ${isCurrentMonth ? 'text-[var(--text)]' : 'text-[var(--muted)]'}`}>
                  {date.getDate()}
                </div>
                <div className='mt-2 space-y-1.5'>
                  {dayEvents.slice(0, 3).map((event) => (
                    <div key={event.id} className={`truncate rounded-lg border px-2 py-1 text-xs ${CATEGORY_META[event.category].className}`}>
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 ? <div className='text-xs text-[var(--muted)]'>+{dayEvents.length - 3} more</div> : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {showDayModal && (
        <div className='fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/30 p-6 backdrop-blur-sm'>
          <div className='w-full max-w-3xl rounded-[28px] border border-black/5 bg-white p-6 shadow-2xl'>
            <div className='flex items-start justify-between gap-4'>
              <div>
                <div className='text-xs uppercase tracking-[0.22em] text-[var(--muted)]'>Day View</div>
                <div className='mt-2 text-2xl font-semibold'>
                  {formatDate(selectedDate, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </div>
                <div className='mt-1 text-sm text-[var(--muted)]'>
                  {selectedDateEvents.length} event{selectedDateEvents.length === 1 ? '' : 's'}
                </div>
              </div>
              <button
                type='button'
                className='modal-close-btn'
                onClick={() => setShowDayModal(false)}
                aria-label='Close'
              >
                <CloseIcon width={18} height={18} />
              </button>
            </div>

            <div className='mt-5 space-y-3'>
              {selectedDateEvents.length ? (
                selectedDateEvents.map((event) => (
                  <div key={event.id} className='rounded-2xl border border-black/5 bg-[var(--surface-1)] p-4'>
                    <div className='flex items-start justify-between gap-4'>
                      <div className='min-w-0'>
                        <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${CATEGORY_META[event.category].className}`}>
                          {CATEGORY_META[event.category].label}
                        </div>
                        <div className='mt-3 font-medium'>{event.title}</div>
                        <div className='mt-1 text-sm text-[var(--muted)]'>{event.detail}</div>
                      </div>
                      {event.viewPath && (
                        <button
                          type='button'
                          className='btn btn-sm btn-info shrink-0'
                          onClick={() => {
                            setShowDayModal(false);
                            navigate(event.viewPath);
                          }}
                        >
                          View
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className='rounded-2xl border border-dashed border-black/10 bg-[var(--surface-1)] px-4 py-8 text-sm text-[var(--muted)]'>
                  Nothing is scheduled for this day yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
