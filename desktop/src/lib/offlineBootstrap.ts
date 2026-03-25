import type { AxiosInstance } from 'axios';
import { appStorage } from './appStorage';

const BOOTSTRAP_VERSION_KEY = 'rentdesk_offline_bootstrap_v1';

let activeBootstrapToken = '';
let activeBootstrapPromise: Promise<void> | null = null;

const getBootstrapContext = () => {
  const token = appStorage.getItem('rentdesk_token') || 'guest';
  const activePortfolioId = appStorage.getItem('rentdesk_active_portfolio_id') || 'no-portfolio';
  return `${token}::${activePortfolioId}`;
};

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

const shiftMonthKey = (value: string, delta: number) => {
  const [yearRaw, monthRaw] = value.split('-').map(Number);
  const base = new Date(yearRaw, (monthRaw || 1) - 1, 1);
  base.setMonth(base.getMonth() + delta);
  return monthKey(base.getFullYear(), base.getMonth() + 1);
};

const compareMonthKeys = (left: string, right: string) => {
  const [leftYear, leftMonth] = left.split('-').map(Number);
  const [rightYear, rightMonth] = right.split('-').map(Number);
  return leftYear * 12 + leftMonth - (rightYear * 12 + rightMonth);
};

const getMonthRange = (start: string, end: string) => {
  const months: string[] = [];
  let cursor = start;
  while (compareMonthKeys(cursor, end) <= 0) {
    months.push(cursor);
    cursor = shiftMonthKey(cursor, 1);
  }
  return months;
};

const runInBatches = async (tasks: Array<() => Promise<unknown>>, batchSize = 6) => {
  for (let index = 0; index < tasks.length; index += batchSize) {
    const batch = tasks.slice(index, index + batchSize);
    await Promise.allSettled(batch.map((task) => task()));
  }
};

export const preloadUserData = async (api: AxiosInstance) => {
  const bootstrapContext = getBootstrapContext();
  if (!bootstrapContext || bootstrapContext.startsWith('guest::')) return;

  if (activeBootstrapPromise && activeBootstrapToken === bootstrapContext) {
    return activeBootstrapPromise;
  }

  activeBootstrapToken = bootstrapContext;
  activeBootstrapPromise = (async () => {
    const [defaultPropsRes, activePropsRes, deletedPropsRes] = await Promise.allSettled([
      api.get('/properties'),
      api.get('/properties?archived=false'),
      api.get('/properties?archived=true')
    ]);

    const properties = Array.from(
      new Map(
        [
          ...((defaultPropsRes.status === 'fulfilled' ? defaultPropsRes.value.data : []) || []),
          ...((activePropsRes.status === 'fulfilled' ? activePropsRes.value.data : []) || []),
          ...((deletedPropsRes.status === 'fulfilled' ? deletedPropsRes.value.data : []) || [])
        ].map((property: any) => [String(property?._id || Math.random()), property])
      ).values()
    );
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const currentMonthKey = monthKey(currentYear, currentMonth);
    const earliestCreatedAt = properties.reduce((earliest, property: any) => {
      const createdAt = property?.createdAt || property?.updatedAt;
      if (!createdAt) return earliest;
      const parsed = new Date(createdAt);
      if (Number.isNaN(parsed.getTime())) return earliest;
      return !earliest || parsed < earliest ? parsed : earliest;
    }, null as Date | null);
    const earliestMonthKey = earliestCreatedAt
      ? monthKey(earliestCreatedAt.getFullYear(), earliestCreatedAt.getMonth() + 1)
      : currentMonthKey;
    const dashboardMonths = getMonthRange(earliestMonthKey, shiftMonthKey(currentMonthKey, 12));

    await Promise.allSettled([
      api.get('/portfolio/list'),
      api.get('/portfolio'),
      ...dashboardMonths.map((targetMonth) => {
        const [year, month] = targetMonth.split('-').map(Number);
        return api.get('/dashboard', { params: { month, year } });
      }),
      ...properties.flatMap((property: any) =>
        dashboardMonths.map((targetMonth) => {
          const [year, month] = targetMonth.split('-').map(Number);
          return api.get('/dashboard', {
            params: { month, year, propertyId: property._id }
          });
        })
      )
    ]);

    await runInBatches(
      properties.map((property: any) => async () => {
        const propertyId = String(property._id);
        const [
          propertyRes,
          overviewRes,
          activeUnitsRes,
          deletedUnitsRes,
          tenantsRes
        ] = await Promise.allSettled([
          api.get(`/properties/${propertyId}`),
          api.get(`/properties/${propertyId}/overview`),
          api.get(`/properties/${propertyId}/units?archived=false`),
          api.get(`/properties/${propertyId}/units?archived=true`),
          api.get(`/properties/${propertyId}/tenants`)
        ]);

        await Promise.allSettled([
          api.get(`/properties/${propertyId}/rent-records`),
          api.get(`/properties/${propertyId}/utility-bills`),
          api.get(`/properties/${propertyId}/maintenance`),
          api.get(`/properties/${propertyId}/payments`)
        ]);

        const units = [
          ...((activeUnitsRes.status === 'fulfilled' ? activeUnitsRes.value.data : []) || []),
          ...((deletedUnitsRes.status === 'fulfilled' ? deletedUnitsRes.value.data : []) || [])
        ];
        const tenants = (tenantsRes.status === 'fulfilled' ? tenantsRes.value.data : []) || [];

        await runInBatches(
          [
            ...units.map((unit: any) => () => api.get(`/properties/${propertyId}/units/${unit._id}/details`)),
            ...tenants.map((tenant: any) => () => api.get(`/properties/${propertyId}/tenants/${tenant._id}/details`))
          ],
          4
        );

        if (propertyRes.status === 'fulfilled' && overviewRes.status === 'fulfilled') {
          appStorage.setItem(
            `${BOOTSTRAP_VERSION_KEY}::${propertyId}`,
            new Date().toISOString()
          );
        }
      }),
      3
    );

    appStorage.setItem(BOOTSTRAP_VERSION_KEY, new Date().toISOString());
  })().finally(() => {
    activeBootstrapPromise = null;
  });

  return activeBootstrapPromise;
};

export const getBootstrapMarker = () => appStorage.getItem(BOOTSTRAP_VERSION_KEY);
