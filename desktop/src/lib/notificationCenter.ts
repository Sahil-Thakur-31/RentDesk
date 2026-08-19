import { useEffect, useMemo, useState } from 'react';
import { cachedGet } from './queryCache';

export type NotificationItem = {
  id: string;
  title: string;
  description: string;
  time: string;
  tone: 'info' | 'warning' | 'success';
  path?: string;
};

const getId = (value: any) => String(value?._id || value || '');
const today = () => new Date();
const monthValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const relativeTime = (dateValue: string | Date) => {
  const diffMs = today().getTime() - new Date(dateValue).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

export const useNotificationsFeed = () => {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const portfolioData = await cachedGet('/portfolio');
        const portfolio = portfolioData?.portfolio;
        const properties = portfolioData?.properties || [];
        if (!portfolio || !properties.length) {
          if (active) setItems([]);
          return;
        }

        const now = today();
        const currentMonth = monthValue(now);
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const start = new Date(year, now.getMonth(), 1).toISOString();
        const end = new Date(year, now.getMonth() + 1, 0, 23, 59, 59).toISOString();
        const reminderStart = (dueDay: number) => Math.max(1, dueDay - Number(portfolio.reminderLeadDays || 1));

        const buckets = await Promise.all(
          properties.map(async (property: any) => {
            const [rentData, utilityData, tenantData, paymentData, maintenanceData] = await Promise.all([
              cachedGet(`/properties/${property._id}/rent-records`, { month, year, status: 'unpaid,partial,paid' }),
              cachedGet(`/properties/${property._id}/utility-bills`, { month: currentMonth, status: 'unpaid,partial,paid' }),
              cachedGet(`/properties/${property._id}/tenants`, { status: 'active' }),
              cachedGet(`/properties/${property._id}/payments`, { startDate: start, endDate: end }),
              cachedGet(`/properties/${property._id}/maintenance`)
            ]);

            const next: NotificationItem[] = [];
            const payments = paymentData || [];
            const rentRecords = rentData || [];
            const utilityBills = utilityData || [];
            const activeTenants = tenantData || [];
            const maintenanceExpenses = (maintenanceData || []).filter((item: any) => {
              const recordDate = new Date(item.date);
              return recordDate >= new Date(start) && recordDate <= new Date(end);
            });

            if (now.getDate() >= reminderStart(Number(portfolio.rentDueDay || 5))) {
              rentRecords
                .filter((record: any) => record.status === 'unpaid' || record.status === 'partial')
                .forEach((record: any) => {
                  const paidAmount = Number(record.paidAmount || 0);
                  const remaining = Math.max(0, Number(record.rentAmount || 0) - paidAmount);
                  next.push({
                    id: `rent-${record._id}`,
                    title: 'Rent due',
                    description: `${record.tenantId?.fullName || record.unitId?.unitNumber || 'Tenant'} - ${property.name} - ?${remaining} pending`,
                    time: `Due on ${portfolio.rentDueDay}`,
                    tone: 'warning',
                    path: record.tenantId?._id ? `/properties/${property._id}/tenants/${record.tenantId._id}` : `/properties/${property._id}`
                  });
                });
            }

            if (now.getDate() >= reminderStart(Number(portfolio.electricityDueDay || 10))) {
              utilityBills
                .filter((bill: any) => bill.status === 'unpaid' || bill.status === 'partial')
                .forEach((bill: any) => {
                  next.push({
                    id: `utility-${bill._id}`,
                    title: 'Electricity due',
                    description: `${bill.tenantId?.fullName || bill.unitId?.currentTenant?.fullName || bill.unitId?.unitNumber || 'Tenant'} - ${property.name} - ?${bill.amount} pending`,
                    time: `Due on ${portfolio.electricityDueDay}`,
                    tone: 'warning',
                    path: bill.unitId?._id ? `/properties/${property._id}/units/${bill.unitId._id}` : `/properties/${property._id}`
                  });
                });
            }

            if (now.getDate() >= reminderStart(Number(portfolio.maintenanceDueDay || 7))) {
              const paidMaintenance = new Set(
                payments
                  .filter((payment: any) => payment.type === 'maintenance' && /maintenance collected/i.test(String(payment.notes || '')))
                  .map((payment: any) => getId(payment.tenantId))
              );
              activeTenants.forEach((tenant: any) => {
                if ((property.maintenanceCharge || 0) <= 0) return;
                if (paidMaintenance.has(getId(tenant._id))) return;
                next.push({
                  id: `maintenance-due-${tenant._id}`,
                  title: 'Maintenance due',
                  description: `${tenant.fullName} - ${property.name} - ?${property.maintenanceCharge || 0} pending`,
                  time: `Due on ${portfolio.maintenanceDueDay}`,
                  tone: 'warning',
                  path: tenant._id ? `/properties/${property._id}/tenants/${tenant._id}` : `/properties/${property._id}`
                });
              });
            }

            payments.slice(-6).forEach((payment: any) => {
              if (!payment.date) return;
              next.push({
                id: `payment-${payment._id}`,
                title:
                  payment.type === 'rent'
                    ? 'Rent received'
                    : payment.type === 'utility'
                      ? 'Utility paid'
                      : payment.type === 'maintenance'
                        ? 'Maintenance recorded'
                        : payment.type === 'deposit'
                          ? 'Deposit received'
                          : 'Payment update',
                description: `${payment.tenantId?.fullName || payment.unitId?.unitNumber || property.name} - ?${payment.amount}${payment.notes ? ` - ${payment.notes}` : ''}`,
                time: relativeTime(payment.date),
                tone: payment.type === 'refund' ? 'info' : 'success',
                path: payment.tenantId?._id
                  ? `/properties/${property._id}/tenants/${payment.tenantId._id}`
                  : payment.unitId?._id
                    ? `/properties/${property._id}/units/${payment.unitId._id}`
                    : '/transactions'
              });
            });

            maintenanceExpenses.forEach((expense: any) => {
              next.push({
                id: `expense-${expense._id}`,
                title: 'Maintenance spent',
                description: `${property.name} - ?${expense.amount}${expense.category ? ` - ${expense.category}` : ''}`,
                time: relativeTime(expense.date),
                tone: 'info',
                path: '/transactions'
              });
            });

            return next;
          })
        );

        if (active) {
          const merged = buckets.flat();
          const unique = merged.filter((item, index, arr) => arr.findIndex((entry) => entry.id === item.id) === index);
          setItems(unique.slice(0, 50));
        }
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  return useMemo(() => ({ notifications: items, loading }), [items, loading]);
};
