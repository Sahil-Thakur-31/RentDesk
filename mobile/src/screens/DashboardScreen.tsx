import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import api from '../lib/api';
import Screen from '../components/Screen';
import PropertyFilter from '../components/PropertyFilter';
import MonthSwitcher from '../components/MonthSwitcher';
import StatTile from '../components/StatTile';
import Card from '../components/Card';
import Button from '../components/Button';
import SegmentedControl from '../components/SegmentedControl';
import { useI18n } from '../context/I18nContext';
import { usePortfolio } from '../context/PortfolioContext';
import { colors, fonts } from '../lib/theme';
import { formatCurrency } from '../lib/format';
import { getCurrentMonthValue, getMonthParts } from '../lib/date';

const getId = (value: any) => String(value?._id || value || '');
const startOfMonth = (monthKey: string) => new Date(`${monthKey}-01T00:00:00`);
const endOfMonth = (monthKey: string) => {
  const start = startOfMonth(monthKey);
  return new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
};

type ActionTab = 'rent' | 'electricity' | 'maintenance' | 'deposit' | 'other';

const DashboardScreen = ({ navigation }: any) => {
  const { t } = useI18n();
  const { properties } = usePortfolio();
  const [propertyId, setPropertyId] = useState('');
  const [monthKey, setMonthKey] = useState(getCurrentMonthValue());
  const [dashboard, setDashboard] = useState<any>(null);
  const [summaryCounts, setSummaryCounts] = useState({
    properties: 0,
    units: 0,
    tenants: 0
  });
  const [nextActions, setNextActions] = useState<Record<ActionTab, any[]>>({
    rent: [],
    electricity: [],
    maintenance: [],
    deposit: [],
    other: []
  });
  const [actionTab, setActionTab] = useState<ActionTab>('rent');
  const [loading, setLoading] = useState(false);
  const { month, year } = getMonthParts(monthKey);

  const selectedProperties = useMemo(() => {
    return propertyId ? properties.filter((property) => property._id === propertyId) : properties;
  }, [properties, propertyId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const dashboardRes = await api.get('/dashboard', { params: { propertyId: propertyId || undefined, month, year } });
        setDashboard(dashboardRes.data);

        const monthStart = startOfMonth(monthKey).toISOString();
        const monthEnd = endOfMonth(monthKey).toISOString();
        const perPropertyData = await Promise.all(
          selectedProperties.map(async (property) => {
            const [rentRes, utilityRes, tenantRes, paymentRes] = await Promise.all([
              api.get(`/properties/${property._id}/rent-records`, { params: { month, year, status: 'unpaid,partial' } }),
              api.get(`/properties/${property._id}/utility-bills`, { params: { month: monthKey, status: 'unpaid' } }),
              api.get(`/properties/${property._id}/tenants`),
              api.get(`/properties/${property._id}/payments`, {
                params: { startDate: monthStart, endDate: monthEnd }
              })
            ]);
            return {
              property,
              rents: rentRes.data || [],
              bills: utilityRes.data || [],
              tenants: tenantRes.data || [],
              payments: paymentRes.data || []
            };
          })
        );

        const rent = perPropertyData.flatMap(({ property, rents }) =>
          rents.map((record: any) => ({
            id: record._id,
            title: record.tenantId?.fullName || 'Tenant',
            meta: `${record.unitId?.unitNumber || '-'} • ${property.name}`,
            amount: Math.max(0, (record.rentAmount || 0) - (record.paidAmount || 0))
          }))
        );

        const electricity = perPropertyData.flatMap(({ property, bills }) =>
          bills.map((bill: any) => ({
            id: bill._id,
            title: bill.unitId?.unitNumber || 'Unit',
            meta: property.name,
            amount: bill.amount || 0
          }))
        );

        const maintenance = perPropertyData.flatMap(({ property, tenants, payments }) => {
          const collectedTenantIds = new Set(
            payments
              .filter((payment: any) => payment.type === 'maintenance')
              .filter((payment: any) => String(payment.notes || '').toLowerCase().includes('maintenance collected'))
              .map((payment: any) => getId(payment.tenantId))
          );
          return tenants
            .filter((tenant: any) => tenant.isActive)
            .filter((tenant: any) => !collectedTenantIds.has(getId(tenant._id)))
            .filter(() => Number(property.maintenanceCharge || 0) > 0)
            .map((tenant: any) => ({
              id: tenant._id,
              title: tenant.fullName,
              meta: `${tenant.unitId?.unitNumber || tenant.assignedUnit || '-'} • ${property.name}`,
              amount: Number(property.maintenanceCharge || 0)
            }));
        });

        const deposit = perPropertyData.flatMap(({ property, tenants, payments }) => {
          const heldByTenant = new Map<string, number>();
          payments
            .filter((payment: any) => payment.type === 'deposit' || payment.type === 'refund')
            .forEach((payment: any) => {
              const tenantKey = getId(payment.tenantId);
              if (!tenantKey) return;
              const current = heldByTenant.get(tenantKey) || 0;
              heldByTenant.set(tenantKey, payment.type === 'deposit' ? current + Number(payment.amount || 0) : current - Number(payment.amount || 0));
            });
          return tenants
            .filter((tenant: any) => tenant.isActive)
            .map((tenant: any) => ({
              tenant,
              remaining: Math.max(0, Number(tenant.depositAmount || 0) - Math.max(0, heldByTenant.get(getId(tenant._id)) || 0))
            }))
            .filter((item: any) => item.remaining > 0)
            .map((item: any) => ({
              id: item.tenant._id,
              title: item.tenant.fullName,
              meta: `${item.tenant.unitId?.unitNumber || item.tenant.assignedUnit || '-'} • ${property.name}`,
              amount: item.remaining
            }));
        });

        setSummaryCounts({
          properties: selectedProperties.length,
          units: Number(dashboardRes.data?.totals?.totalUnits || 0),
          tenants: perPropertyData.reduce((sum, entry) => sum + (entry.tenants || []).filter((tenant: any) => tenant.isActive).length, 0)
        });
        setNextActions({ rent, electricity, maintenance, deposit, other: [] });
      } catch {
        setDashboard(null);
        setSummaryCounts({ properties: 0, units: 0, tenants: 0 });
        setNextActions({ rent: [], electricity: [], maintenance: [], deposit: [], other: [] });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [month, monthKey, propertyId, properties, selectedProperties, year]);

  const totals = dashboard?.totals || {};

  return (
    <Screen
      title="Dashboard"
      right={<Button label="Add Payment" small onPress={() => navigation.navigate('TransactionsTab', { openAddPayment: true })} />}
    >
      <PropertyFilter properties={properties} value={propertyId} onChange={setPropertyId} />
      <MonthSwitcher value={monthKey} onChange={setMonthKey} />

      <View style={styles.grid}>
        <StatTile label="Rent" value={`${formatCurrency(totals.collectedRent)} / ${formatCurrency(totals.monthlyExpectedRent)}`} note={`${formatCurrency(totals.pendingRent)} pending`} tone={totals.pendingRent > 0 ? 'warning' : 'success'} />
        <StatTile label="Electricity" value={`${formatCurrency(totals.monthlyElectricity?.collected)} / ${formatCurrency(totals.monthlyElectricity?.total)}`} note={`${formatCurrency(totals.monthlyElectricity?.unpaid)} unpaid`} tone={(totals.monthlyElectricity?.unpaid || 0) > 0 ? 'warning' : 'success'} />
        <StatTile label="Maintenance" value={`${formatCurrency(totals.monthlyMaintenanceCollected)} / ${formatCurrency(totals.monthlyMaintenanceExpected)}`} note={`${formatCurrency(totals.monthlyMaintenancePending)} pending`} tone={totals.monthlyMaintenancePending > 0 ? 'warning' : 'success'} />
        <StatTile label="Deposit" value={`${formatCurrency(totals.depositCollected)} / ${formatCurrency(totals.depositRequired)}`} note={`${formatCurrency(totals.depositPending)} pending`} tone={totals.depositPending > 0 ? 'warning' : 'success'} />
        <StatTile label="Other Cash" value={formatCurrency(totals.otherCashIntake)} note="Extra income" />
        <StatTile label="Properties" value={summaryCounts.properties} note="In current filter" />
        <StatTile label="Units" value={summaryCounts.units} note={`${totals.occupiedUnits || 0} occupied`} />
        <StatTile label="Tenants" value={summaryCounts.tenants} note="Active tenants" />
        <StatTile label="Occupancy" value={`${totals.occupiedUnits || 0}/${totals.totalUnits || 0}`} note={`${totals.vacantUnits || 0} vacant`} tone={(totals.vacantUnits || 0) > 0 ? 'warning' : 'success'} />
      </View>

      <Card>
        <Text style={styles.sectionTitle}>{t('Next Actions')}</Text>
        <SegmentedControl
          options={[
            { label: 'Rent', value: 'rent' },
            { label: 'Electricity', value: 'electricity' },
            { label: 'Maintenance', value: 'maintenance' },
            { label: 'Deposit', value: 'deposit' },
            { label: 'Others', value: 'other' }
          ]}
          value={actionTab}
          onChange={setActionTab}
        />
        <View style={styles.actionList}>
          {(nextActions[actionTab] || []).length ? (
            nextActions[actionTab].slice(0, 6).map((item) => (
              <Pressable key={item.id} style={styles.actionCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>{item.title}</Text>
                  <Text style={styles.actionMeta} numberOfLines={1}>
                    {item.meta}
                  </Text>
                </View>
                <Text style={styles.actionAmount}>{formatCurrency(item.amount)}</Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.emptyText}>{loading ? t('Loading') : t('Nothing pending here.')}</Text>
          )}
        </View>
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sectionTitle: { fontFamily: fonts.headingSemi, fontSize: 20, color: colors.text, marginBottom: 12 },
  actionList: { gap: 10, marginTop: 12 },
  actionCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  actionTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  actionMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  actionAmount: { fontFamily: fonts.headingSemi, fontSize: 18, color: colors.text },
  emptyText: { fontFamily: fonts.body, color: colors.muted }
});

export default DashboardScreen;

