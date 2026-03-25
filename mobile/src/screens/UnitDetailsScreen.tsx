import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import api from '../lib/api';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Pill from '../components/Pill';
import SegmentedControl from '../components/SegmentedControl';
import { formatDate } from '../lib/date';
import { colors, fonts } from '../lib/theme';
import { formatCurrency } from '../lib/format';

type PaymentFilter = 'all' | 'rent' | 'utility' | 'maintenance' | 'deposit' | 'other';

const UnitDetailsScreen = ({ route, navigation }: any) => {
  const { propertyId, unitId } = route.params;
  const [data, setData] = useState<any>(null);
  const [filter, setFilter] = useState<PaymentFilter>('all');

  useEffect(() => {
    const load = async () => {
      const response = await api.get(`/properties/${propertyId}/units/${unitId}/details`);
      setData(response.data);
    };
    void load();
  }, [propertyId, unitId]);

  const payments = useMemo(() => {
    const list = data?.payments || [];
    if (filter === 'all') return list;
    if (filter === 'other') return list.filter((payment: any) => payment.type === 'other' || payment.type === 'refund');
    if (filter === 'deposit') return list.filter((payment: any) => payment.type === 'deposit' || payment.type === 'refund');
    return list.filter((payment: any) => payment.type === filter);
  }, [data?.payments, filter]);

  const unit = data?.unit;

  return (
    <Screen title={unit?.unitNumber || 'Unit'} subtitle={unit ? `${unit.unitType} • ${formatCurrency(unit.monthlyRent)}` : 'Loading unit...'}>
      {unit ? (
        <Card>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.label}>Current Tenant</Text>
              {unit.currentTenant ? (
                <Pressable onPress={() => navigation.navigate('TenantDetails', { propertyId, tenantId: unit.currentTenant._id })}>
                  <Text style={styles.value}>{unit.currentTenant.fullName}</Text>
                </Pressable>
              ) : (
                <Text style={styles.value}>No active tenant</Text>
              )}
              <Text style={styles.meta}>Meter reading {unit.lastMeterReading || 0}</Text>
            </View>
            <Pill label={unit.status === 'maintenance' ? 'Under Repair' : unit.status} tone={unit.status === 'occupied' ? 'success' : unit.status === 'maintenance' ? 'warning' : 'default'} />
          </View>
          <View style={styles.statGrid}>
            <View style={styles.statBox}><Text style={styles.label}>Rent</Text><Text style={styles.value}>{formatCurrency(unit.monthlyRent)}</Text></View>
            <View style={styles.statBox}><Text style={styles.label}>Deposit</Text><Text style={styles.value}>{formatCurrency(unit.deposit)}</Text></View>
          </View>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.sectionTitle}>Tenant History</Text>
        <View style={styles.list}>
          {(data?.tenants || []).map((tenant: any) => (
            <Pressable key={tenant._id} style={styles.listRow} onPress={() => navigation.navigate('TenantDetails', { propertyId, tenantId: tenant._id })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.value}>{tenant.fullName}</Text>
                <Text style={styles.meta}>{tenant.phone || tenant.email || '-'}</Text>
              </View>
              <Pill label={tenant.isActive ? 'Active' : 'Past'} tone={tenant.isActive ? 'success' : 'default'} />
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Payments</Text>
        <SegmentedControl
          options={[
            { label: 'All', value: 'all' },
            { label: 'Rent', value: 'rent' },
            { label: 'Utility', value: 'utility' },
            { label: 'Maintenance', value: 'maintenance' },
            { label: 'Deposit', value: 'deposit' },
            { label: 'Others', value: 'other' }
          ]}
          value={filter}
          onChange={(value) => setFilter(value as PaymentFilter)}
        />
        <View style={styles.list}>
          {payments.map((payment: any) => (
            <View key={payment._id} style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.value}>{payment.type}</Text>
                <Text style={styles.meta}>{formatDate(payment.date)}</Text>
              </View>
              <Text style={styles.amount}>{formatCurrency(payment.amount)}</Text>
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  label: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 },
  value: { fontFamily: fonts.headingSemi, fontSize: 18, color: colors.text, marginTop: 4 },
  meta: { fontFamily: fonts.body, color: colors.muted, marginTop: 4 },
  statGrid: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statBox: { flex: 1, borderRadius: 16, backgroundColor: colors.surface, padding: 12 },
  sectionTitle: { fontFamily: fonts.headingSemi, fontSize: 20, color: colors.text, marginBottom: 12 },
  list: { gap: 10, marginTop: 12 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  amount: { fontFamily: fonts.headingSemi, fontSize: 18, color: colors.text }
});

export default UnitDetailsScreen;

