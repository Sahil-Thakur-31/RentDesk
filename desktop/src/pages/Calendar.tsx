import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import PropertyPicker from '../components/PropertyPicker';
import { formatDate, formatMonthKey, getCurrentMonthValue, shiftMonthValue } from '../lib/dateFormat';
import { useDataVersion } from '../lib/dataSync';

type CalendarEvent = {
  id: string;
  date: string;
  title: string;
  detail: string;
  propertyId: string;
  propertyName: string;
  type: 'due' | 'incoming' | 'expense' | 'other';
  viewPath: string;
};

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const typeStyles: Record<CalendarEvent['type'], string> = {
  due: 'bg-amber-50 text-amber-700 border-amber-200',
  incoming: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  expense: 'bg-rose-50 text-rose-700 border-rose-200',
  other: 'bg-sky-50 text-sky-700 border-sky-200'
};

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
  const dataVersion = useDataVersion();
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
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProperties = async () => {
      try {
        const [propertiesRes, portfolioRes] = await Promise.all([
          api.get('/properties?archived=false'),
          api.get('/portfolio')
        ]);
        setProperties(propertiesRes.data || []);
        const portfolio = portfolioRes.data?.portfolio;
        if (portfolio) {
          setPortfolioSettings({
            rentDueDay: Number(portfolio.rentDueDay || 5),
            electricityDueDay: Number(portfolio.electricityDueDay || 10),
            maintenanceDueDay: Number(portfolio.maintenanceDueDay || 7)
          });
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Unable to load calendar portfolios.');
      }
    };

    void loadProperties();
  }, [dataVersion]);

  useEffect(() => {
    const { start, end, month, year } = getMonthBounds(monthValue);
    const currentDate = selectedDate ? new Date(selectedDate) : null;
    if (!currentDate || currentDate.getFullYear() != year || currentDate.getMonth() != month - 1) {
      setSelectedDate(toDateInput(start));
    }

    const loadEvents = async () => {
      if (!properties.length) {
        setEvents([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const activeProperties = propertyId
          ? properties.filter((property) => property._id === propertyId)
          : properties;

        const eventBuckets = await Promise.all(
          activeProperties.map(async (property) => {
            const [rentRes, utilityRes, maintenanceRes, paymentRes, tenantRes] = await Promise.all([
              api.get(`/properties/${property._id}/rent-records?month=${month}&year=${year}&status=unpaid,partial`),
              api.get(`/properties/${property._id}/utility-bills?month=${monthValue}&status=unpaid,partial`),
              api.get(`/properties/${property._id}/maintenance`),
              api.get(`/properties/${property._id}/tenants?status=active`),
              api.get(
                `/properties/${property._id}/payments?startDate=${start.toISOString()}&endDate=${new Date(
                  end.getFullYear(),
                  end.getMonth(),
                  end.getDate(),
                  23,
                  59,
                  59
                ).toISOString()}`
              )
            ]);

            const dueDay = toDateInput(new Date(year, month - 1, portfolioSettings.rentDueDay));
            const utilityDay = toDateInput(new Date(year, month - 1, portfolioSettings.electricityDueDay));
            const maintenanceDay = toDateInput(new Date(year, month - 1, portfolioSettings.maintenanceDueDay));

            const rentEvents: CalendarEvent[] = (rentRes.data || []).map((record: any) => {
              const paidAmount = Number(record.paidAmount || 0);
              const remaining = Math.max(0, Number(record.rentAmount || 0) - paidAmount);
              const tenantName = record.tenantId?.fullName || 'Tenant';
              const unitName = record.unitId?.unitNumber || 'Unit';
              return {
                id: `rent-due-${record._id}`,
                date: dueDay,
                title: `${tenantName} - ${unitName} rent due`,
                detail: `${property.name} - Remaining \u20B9${remaining}`,
                propertyId: property._id,
                propertyName: property.name,
                type: 'due',
                viewPath: record.tenantId?._id
                  ? `/properties/${property._id}/tenants/${record.tenantId._id}`
                  : `/properties/${property._id}`
              };
            });

            const utilityEvents: CalendarEvent[] = (utilityRes.data || []).map((bill: any) => ({
              id: `utility-due-${bill._id}`,
              date: utilityDay,
              title: `${bill.tenantId?.fullName || bill.unitId?.currentTenant?.fullName || 'Tenant'} - ${bill.unitId?.unitNumber || 'Unit'} electricity`,
              detail: `${property.name} - Pending \u20B9${bill.amount}`,
              propertyId: property._id,
              propertyName: property.name,
              type: 'due',
              viewPath: bill.unitId?._id
                ? `/properties/${property._id}/units/${bill.unitId._id}`
                : `/properties/${property._id}`
            }));

            const maintenanceEvents: CalendarEvent[] = (maintenanceRes.data || [])
              .filter((record: any) => {
                const recordDate = new Date(record.date);
                return recordDate >= start && recordDate <= new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59);
              })
              .map((record: any) => ({
                id: `maintenance-expense-${record._id}`,
                date: toDateInput(new Date(record.date)),
                title: record.category || 'Maintenance expense',
                detail: `${property.name} - \u20B9${record.amount}${record.paidTo ? ` - ${record.paidTo}` : ''}`,
                propertyId: property._id,
                propertyName: property.name,
                type: 'expense',
                viewPath: '/transactions'
              }));

            const collectedMaintenanceTenantIds = new Set(
              (paymentRes.data || [])
                .filter((payment: any) => payment.type === 'maintenance' && /maintenance collected/i.test(String(payment.notes || '')))
                .map((payment: any) => getId(payment.tenantId))
            );

            const maintenanceDueEvents: CalendarEvent[] = (tenantRes.data || [])
              .filter((tenant: any) => !collectedMaintenanceTenantIds.has(getId(tenant._id)))
              .filter(() => Number(property.maintenanceCharge || 0) > 0)
              .map((tenant: any) => ({
                id: `maintenance-due-${tenant._id}`,
                date: maintenanceDay,
                title: `${tenant.fullName || 'Tenant'} - ${tenant.unitId?.unitNumber || 'Unit'} maintenance due`,
                detail: `${property.name} - Remaining \u20B9${property.maintenanceCharge || 0}`,
                propertyId: property._id,
                propertyName: property.name,
                type: 'due',
                viewPath: tenant._id ? `/properties/${property._id}/tenants/${tenant._id}` : `/properties/${property._id}`
              }));

            const paymentEvents: CalendarEvent[] = (paymentRes.data || [])
              .filter((payment: any) => !(payment.type === 'maintenance' && payment.sourceType === 'maintenance'))
              .map((payment: any) => {
                const type =
                  payment.type === 'rent' || payment.type === 'deposit' || payment.type === 'utility'
                    ? 'incoming'
                    : payment.type === 'refund' || payment.type === 'other'
                      ? 'other'
                      : 'incoming';

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
                  detail: `${property.name} - \u20B9${payment.amount}${payment.notes ? ` - ${payment.notes}` : ''}`,
                  propertyId: property._id,
                  propertyName: property.name,
                  type,
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
          eventBuckets.flat().sort((left, right) => left.date.localeCompare(right.date) || left.title.localeCompare(right.title))
        );
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Unable to load calendar events.');
      } finally {
        setLoading(false);
      }
    };

    void loadEvents();
  }, [monthValue, propertyId, properties, dataVersion, portfolioSettings]);

  const eventsByDate = useMemo(() => {
    return events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
      acc[event.date] = acc[event.date] || [];
      acc[event.date].push(event);
      return acc;
    }, {});
  }, [events]);

  const selectedDateEvents = eventsByDate[selectedDate] || [];
  const dayGrid = useMemo(() => makeDayGrid(monthValue), [monthValue]);
  const { month, year } = getMonthBounds(monthValue);

  const summary = useMemo(() => {
    return {
      due: events.filter((event) => event.type === 'due').length,
      incoming: events.filter((event) => event.type === 'incoming').length,
      expense: events.filter((event) => event.type === 'expense').length
    };
  }, [events]);

  return (
    <div className='space-y-6 pb-6'>
      <div className='rounded-3xl border border-black/5 bg-white p-6 shadow-sm'>
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <div>
            <div className='text-sm uppercase tracking-[0.22em] text-[var(--muted)]'>Portfolio Calendar</div>
            <div className='mt-2 text-2xl font-semibold'>See due items and activity in an actual month view</div>
          </div>
          <div className='flex flex-wrap items-center gap-3'>
            <PropertyPicker properties={properties} value={propertyId} onChange={setPropertyId} />
            <button
              type='button'
              className='rounded-xl border border-black/10 bg-white px-3 py-2 text-sm hover:bg-black/5'
              onClick={() => setMonthValue((current) => shiftMonthValue(current, -1))}
            >
              {'<'}
            </button>
            <input
              type='month'
              value={monthValue}
              onChange={(e) => setMonthValue(e.target.value)}
              className='rounded-xl border border-black/10 bg-white px-3 py-2 text-sm'
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
          </div>
        </div>

        <div className='mt-5 grid gap-4 md:grid-cols-3'>
          <div className='rounded-2xl border border-amber-100 bg-amber-50 p-4'>
            <div className='text-xs uppercase tracking-wide text-amber-700'>Due Items</div>
            <div className='mt-2 text-2xl font-semibold text-amber-950'>{summary.due}</div>
            <div className='text-sm text-amber-700'>pending rent and electricity items this month</div>
          </div>
          <div className='rounded-2xl border border-emerald-100 bg-emerald-50 p-4'>
            <div className='text-xs uppercase tracking-wide text-emerald-700'>Collected</div>
            <div className='mt-2 text-2xl font-semibold text-emerald-950'>{summary.incoming}</div>
            <div className='text-sm text-emerald-700'>rent, deposit, and maintenance collections</div>
          </div>
          <div className='rounded-2xl border border-rose-100 bg-rose-50 p-4'>
            <div className='text-xs uppercase tracking-wide text-rose-700'>Spent</div>
            <div className='mt-2 text-2xl font-semibold text-rose-950'>{summary.expense}</div>
            <div className='text-sm text-rose-700'>maintenance expense activity in this month</div>
          </div>
        </div>
      </div>

      {error && (
        <div className='rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>{error}</div>
      )}

      <div className='rounded-3xl border border-black/5 bg-white p-6 shadow-sm'>
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
                    <div key={event.id} className={`truncate rounded-lg border px-2 py-1 text-xs ${typeStyles[event.type]}`}>
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
                className='text-sm text-[var(--muted)] hover:text-[var(--text)]'
                onClick={() => setShowDayModal(false)}
              >
                Close
              </button>
            </div>

            <div className='mt-5 space-y-3'>
              {selectedDateEvents.length ? (
                selectedDateEvents.map((event) => (
                  <div key={event.id} className='rounded-2xl border border-black/5 bg-[var(--surface-1)] p-4'>
                    <div className='flex items-start justify-between gap-4'>
                      <div className='min-w-0'>
                        <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${typeStyles[event.type]}`}>
                          {event.type === 'due'
                            ? 'Due'
                            : event.type === 'incoming'
                              ? 'Money In'
                              : event.type === 'expense'
                                ? 'Expense'
                                : 'Other'}
                        </div>
                        <div className='mt-3 font-medium'>{event.title}</div>
                        <div className='mt-1 text-sm text-[var(--muted)]'>{event.detail}</div>
                      </div>
                      <button
                        type='button'
                        className='shrink-0 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm hover:bg-black/5'
                        onClick={() => {
                          setShowDayModal(false);
                          navigate(event.viewPath);
                        }}
                      >
                        View
                      </button>
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
