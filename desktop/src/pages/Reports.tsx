import { useEffect, useState } from 'react';
import api from '../lib/api';
import PropertyPicker from '../components/PropertyPicker';
import DatePicker from '../components/DatePicker';
import { formatMonthKey, getCurrentDateValue, getCurrentMonthValue, shiftMonthValue } from '../lib/dateFormat';
import { cachedGet, useCachedQuery } from '../lib/queryCache';
import { toast } from '../lib/toast';

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
  const { data: propertiesData } = useCachedQuery<any[]>('/properties');
  const properties = propertiesData || [];
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

  useEffect(() => {
    if (!propertyId) {
      setTenants([]);
      setTenantId('');
      return;
    }

    const loadTenants = async () => {
      try {
        const nextTenants = await cachedGet(`/properties/${propertyId}/tenants`);
        setTenants(nextTenants || []);
        setTenantId((current) => ((nextTenants || []).some((tenant: any) => tenant._id === current) ? current : ''));
      } catch {
        setTenants([]);
        setTenantId('');
      }
    };

    void loadTenants();
  }, [propertyId]);

  const downloadReport = async (path: string, params: Record<string, string>, fallbackName: string) => {
    setLoading(true);
    try {
      const response = await api.get(path, {
        params,
        responseType: 'blob'
      });
      downloadBlob(response.data, parseDownloadName(response.headers['content-disposition'], fallbackName));
      toast.success('Report downloaded.');
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
      toast.error(nextError);
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
            <DatePicker
              picker="month"
              className="w-[150px] rounded-2xl border border-black/10 px-3 py-2.5"
              value={reportMonth}
              onChange={(next) => setReportMonth(next)}
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
              className="btn btn-primary !py-2.5"
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
              className="btn btn-secondary !py-2.5"
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
            <DatePicker
              picker="month"
              className="w-[150px] rounded-2xl border border-black/10 px-3 py-2.5"
              value={utilityMonth}
              onChange={(next) => setUtilityMonth(next)}
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
              className="btn btn-primary !py-2.5"
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
              className="btn btn-secondary !py-2.5"
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
            <DatePicker
              className="rounded-2xl border border-black/10 px-3 py-2.5"
              value={incomeStart}
              onChange={(next) => setIncomeStart(next)}
            />
            <DatePicker
              className="rounded-2xl border border-black/10 px-3 py-2.5"
              value={incomeEnd}
              onChange={(next) => setIncomeEnd(next)}
            />
          </div>
          <div className="flex gap-3">
            <button
              className="btn btn-primary !py-2.5"
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
              className="btn btn-secondary !py-2.5"
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
            <DatePicker
              className="rounded-2xl border border-black/10 px-3 py-2.5"
              value={maintenanceStart}
              onChange={(next) => setMaintenanceStart(next)}
            />
            <DatePicker
              className="rounded-2xl border border-black/10 px-3 py-2.5"
              value={maintenanceEnd}
              onChange={(next) => setMaintenanceEnd(next)}
            />
          </div>
          <div className="flex gap-3">
            <button
              className="btn btn-primary !py-2.5"
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
              className="btn btn-secondary !py-2.5"
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
                className="btn btn-primary !py-2.5"
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
                className="btn btn-secondary !py-2.5"
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

