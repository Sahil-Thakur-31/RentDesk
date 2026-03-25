import { useEffect, useState } from 'react';
import api from '../lib/api';
import PropertyPicker from '../components/PropertyPicker';
import { formatMonthKey, getCurrentDateValue, getCurrentMonthValue, shiftMonthValue } from '../lib/dateFormat';
import { useDataVersion } from '../lib/dataSync';

const parseDownloadName = (header?: string, fallback = 'report') => {
  const match = header?.match(/filename="?([^";]+)"?/i);
  return match?.[1] || fallback;
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

const Reports = () => {
  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [reportMonth, setReportMonth] = useState(getCurrentMonthValue());
  const [utilityMonth, setUtilityMonth] = useState(getCurrentMonthValue());
  const [incomeStart, setIncomeStart] = useState(getCurrentDateValue());
  const [incomeEnd, setIncomeEnd] = useState(getCurrentDateValue());
  const [maintenanceStart, setMaintenanceStart] = useState(getCurrentDateValue());
  const [maintenanceEnd, setMaintenanceEnd] = useState(getCurrentDateValue());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const dataVersion = useDataVersion();

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get('/properties');
        setProperties(response.data || []);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Unable to load properties right now.');
      }
    };
    void load();
  }, [dataVersion]);

  useEffect(() => {
    if (!propertyId) {
      setTenants([]);
      setTenantId('');
      return;
    }

    const loadTenants = async () => {
      try {
        const response = await api.get(`/properties/${propertyId}/tenants`);
        const nextTenants = response.data || [];
        setTenants(nextTenants);
        setTenantId((current) => (nextTenants.some((tenant: any) => tenant._id === current) ? current : ''));
      } catch {
        setTenants([]);
        setTenantId('');
      }
    };

    void loadTenants();
  }, [propertyId, dataVersion]);

  const downloadReport = async (path: string, params: Record<string, string>, fallbackName: string) => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.get(path, {
        params,
        responseType: 'blob'
      });
      downloadBlob(response.data, parseDownloadName(response.headers['content-disposition'], fallbackName));
      setMessage('Report downloaded.');
    } catch (err: any) {
      let nextError = err?.response?.data?.message || 'Unable to download this report.';
      if (err?.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          nextError = parsed?.message || nextError;
        } catch {
          // keep fallback message
        }
      }
      setError(nextError);
    } finally {
      setLoading(false);
    }
  };

  const [rentYear, rentMonthNumber] = reportMonth.split('-');

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-wrap items-center gap-3">
        <PropertyPicker properties={properties} value={propertyId} onChange={setPropertyId} />
        {!propertyId ? <div className="text-sm text-[var(--muted)]">Choose one property to export reports.</div> : null}
      </div>

      {(message || error) && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            error
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm space-y-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Monthly Rent</div>
            <div className="mt-2 text-2xl font-semibold">{formatMonthKey(reportMonth)}</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="h-11 w-11 rounded-2xl border border-black/10 bg-white text-lg font-semibold shadow-sm hover:border-[var(--accent)] hover:text-[var(--accent)]"
              onClick={() => setReportMonth((prev) => shiftMonthValue(prev, -1))}
            >
              {'<'}
            </button>
            <input
              type="month"
              className="rounded-2xl border border-black/10 px-3 py-2.5 text-sm"
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
            />
            <button
              type="button"
              className="h-11 w-11 rounded-2xl border border-black/10 bg-white text-lg font-semibold shadow-sm hover:border-[var(--accent)] hover:text-[var(--accent)]"
              onClick={() => setReportMonth((prev) => shiftMonthValue(prev, 1))}
            >
              {'>'}
            </button>
          </div>
          <div className="flex gap-3">
            <button
              className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              disabled={!propertyId || loading}
              onClick={() =>
                downloadReport(
                  `/properties/${propertyId}/reports/monthly-rent`,
                  { month: rentMonthNumber, year: rentYear, format: 'excel' },
                  `monthly-rent-${reportMonth}.xlsx`
                )
              }
            >
              Excel
            </button>
            <button
              className="rounded-2xl border border-black/10 px-4 py-2.5 text-sm hover:bg-black/5 disabled:opacity-60"
              disabled={!propertyId || loading}
              onClick={() =>
                downloadReport(
                  `/properties/${propertyId}/reports/monthly-rent`,
                  { month: rentMonthNumber, year: rentYear, format: 'pdf' },
                  `monthly-rent-${reportMonth}.pdf`
                )
              }
            >
              PDF
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm space-y-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Utility Bills</div>
            <div className="mt-2 text-2xl font-semibold">{formatMonthKey(utilityMonth)}</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="h-11 w-11 rounded-2xl border border-black/10 bg-white text-lg font-semibold shadow-sm hover:border-[var(--accent)] hover:text-[var(--accent)]"
              onClick={() => setUtilityMonth((prev) => shiftMonthValue(prev, -1))}
            >
              {'<'}
            </button>
            <input
              type="month"
              className="rounded-2xl border border-black/10 px-3 py-2.5 text-sm"
              value={utilityMonth}
              onChange={(e) => setUtilityMonth(e.target.value)}
            />
            <button
              type="button"
              className="h-11 w-11 rounded-2xl border border-black/10 bg-white text-lg font-semibold shadow-sm hover:border-[var(--accent)] hover:text-[var(--accent)]"
              onClick={() => setUtilityMonth((prev) => shiftMonthValue(prev, 1))}
            >
              {'>'}
            </button>
          </div>
          <div className="flex gap-3">
            <button
              className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              disabled={!propertyId || loading}
              onClick={() =>
                downloadReport(
                  `/properties/${propertyId}/reports/utility-bills`,
                  { month: utilityMonth, format: 'excel' },
                  `utility-bills-${utilityMonth}.xlsx`
                )
              }
            >
              Excel
            </button>
            <button
              className="rounded-2xl border border-black/10 px-4 py-2.5 text-sm hover:bg-black/5 disabled:opacity-60"
              disabled={!propertyId || loading}
              onClick={() =>
                downloadReport(
                  `/properties/${propertyId}/reports/utility-bills`,
                  { month: utilityMonth, format: 'pdf' },
                  `utility-bills-${utilityMonth}.pdf`
                )
              }
            >
              PDF
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm space-y-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Property Income</div>
            <div className="mt-2 text-2xl font-semibold">Cash ledger</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="date"
              className="rounded-2xl border border-black/10 px-3 py-2.5 text-sm"
              value={incomeStart}
              onChange={(e) => setIncomeStart(e.target.value)}
            />
            <input
              type="date"
              className="rounded-2xl border border-black/10 px-3 py-2.5 text-sm"
              value={incomeEnd}
              onChange={(e) => setIncomeEnd(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <button
              className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              disabled={!propertyId || loading}
              onClick={() =>
                downloadReport(
                  `/properties/${propertyId}/reports/property-income`,
                  { start: incomeStart, end: incomeEnd, format: 'excel' },
                  `property-income-${incomeStart}-${incomeEnd}.xlsx`
                )
              }
            >
              Excel
            </button>
            <button
              className="rounded-2xl border border-black/10 px-4 py-2.5 text-sm hover:bg-black/5 disabled:opacity-60"
              disabled={!propertyId || loading}
              onClick={() =>
                downloadReport(
                  `/properties/${propertyId}/reports/property-income`,
                  { start: incomeStart, end: incomeEnd, format: 'pdf' },
                  `property-income-${incomeStart}-${incomeEnd}.pdf`
                )
              }
            >
              PDF
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm space-y-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Maintenance Spent</div>
            <div className="mt-2 text-2xl font-semibold">Expense report</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="date"
              className="rounded-2xl border border-black/10 px-3 py-2.5 text-sm"
              value={maintenanceStart}
              onChange={(e) => setMaintenanceStart(e.target.value)}
            />
            <input
              type="date"
              className="rounded-2xl border border-black/10 px-3 py-2.5 text-sm"
              value={maintenanceEnd}
              onChange={(e) => setMaintenanceEnd(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <button
              className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              disabled={!propertyId || loading}
              onClick={() =>
                downloadReport(
                  `/properties/${propertyId}/reports/maintenance-expenses`,
                  { start: maintenanceStart, end: maintenanceEnd, format: 'excel' },
                  `maintenance-${maintenanceStart}-${maintenanceEnd}.xlsx`
                )
              }
            >
              Excel
            </button>
            <button
              className="rounded-2xl border border-black/10 px-4 py-2.5 text-sm hover:bg-black/5 disabled:opacity-60"
              disabled={!propertyId || loading}
              onClick={() =>
                downloadReport(
                  `/properties/${propertyId}/reports/maintenance-expenses`,
                  { start: maintenanceStart, end: maintenanceEnd, format: 'pdf' },
                  `maintenance-${maintenanceStart}-${maintenanceEnd}.pdf`
                )
              }
            >
              PDF
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm space-y-4 xl:col-span-2">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Tenant Payment History</div>
            <div className="mt-2 text-2xl font-semibold">Individual ledger</div>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,320px)_auto] md:items-end">
            <div>
              <label className="text-xs text-[var(--muted)]">Tenant</label>
              <select
                className="mt-2 w-full rounded-2xl border border-black/10 px-3 py-2.5 text-sm"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                disabled={!propertyId}
              >
                <option value="">Select tenant</option>
                {tenants.map((tenant) => (
                  <option key={tenant._id} value={tenant._id}>
                    {tenant.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                disabled={!propertyId || !tenantId || loading}
                onClick={() =>
                  downloadReport(
                    `/properties/${propertyId}/reports/tenant/${tenantId}`,
                    { format: 'excel' },
                    'tenant-history.xlsx'
                  )
                }
              >
                Excel
              </button>
              <button
                className="rounded-2xl border border-black/10 px-4 py-2.5 text-sm hover:bg-black/5 disabled:opacity-60"
                disabled={!propertyId || !tenantId || loading}
                onClick={() =>
                  downloadReport(
                    `/properties/${propertyId}/reports/tenant/${tenantId}`,
                    { format: 'pdf' },
                    'tenant-history.pdf'
                  )
                }
              >
                PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;

