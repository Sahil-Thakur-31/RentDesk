import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import api from '../lib/api';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Pill from '../components/Pill';
import SegmentedControl from '../components/SegmentedControl';
import { formatDate } from '../lib/date';
import { colors, fonts } from '../lib/theme';
import { formatCurrency } from '../lib/format';

type PaymentFilter = 'all' | 'rent' | 'utility' | 'maintenance' | 'deposit' | 'other';

const TenantDetailsScreen = ({ route }: any) => {
  const { propertyId, tenantId } = route.params;
  const [data, setData] = useState<any>(null);
  const [filter, setFilter] = useState<PaymentFilter>('all');

  useEffect(() => {
    const load = async () => {
      const response = await api.get(`/properties/${propertyId}/tenants/${tenantId}/details`);
      setData(response.data);
    };
    void load();
  }, [propertyId, tenantId]);

  const payments = useMemo(() => {
    const list = data?.payments || [];
    if (filter === 'all') return list;
    if (filter === 'other') return list.filter((payment: any) => payment.type === 'other' || payment.type === 'refund');
    if (filter === 'deposit') return list.filter((payment: any) => payment.type === 'deposit' || payment.type === 'refund');
    return list.filter((payment: any) => payment.type === filter);
  }, [data?.payments, filter]);

  const depositHeld = useMemo(() => {
    return (data?.payments || []).reduce((sum: number, payment: any) => {
      if (payment.type === 'deposit') return sum + Number(payment.amount || 0);
      if (payment.type === 'refund') return sum - Number(payment.amount || 0);
      return sum;
    }, 0);
  }, [data?.payments]);

  const tenant = data?.tenant;

  return (
    <Screen title={tenant?.fullName || 'Tenant'} subtitle={tenant ? `${tenant.phone} • ${tenant.email || 'No email'}` : 'Loading tenant...'}>
      {tenant ? (
        <Card>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Assigned Unit</Text>
              <Text style={styles.value}>{tenant.assignedUnit?.unitNumber || '-'}</Text>
              <Text style={styles.meta}>{tenant.idProofType || 'No ID type'} • {tenant.idProofNumber || 'No ID number'}</Text>
            </View>
            <Pill label={tenant.isActive ? 'Active' : 'Moved Out'} tone={tenant.isActive ? 'success' : 'warning'} />
          </View>
          <View style={styles.statGrid}>
            <View style={styles.statBox}><Text style={styles.label}>Rent</Text><Text style={styles.value}>{formatCurrency(tenant.rentAmount)}</Text></View>
            <View style={styles.statBox}><Text style={styles.label}>Deposit Held</Text><Text style={styles.value}>{formatCurrency(depositHeld)}</Text></View>
          </View>
        </Card>
      ) : null}

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

export default TenantDetailsScreen;

