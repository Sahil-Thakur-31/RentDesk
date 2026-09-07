import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import api from '../lib/api';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Button from '../components/Button';
import Pill from '../components/Pill';
import SegmentedControl from '../components/SegmentedControl';
import { formatDate } from '../lib/date';
import { colors, fonts } from '../lib/theme';
import { formatCurrency } from '../lib/format';
import { usePortfolio } from '../context/PortfolioContext';
import { buildPaymentReceipt } from '../lib/receipt';
import { shareReceipt } from '../lib/exportFile';

type PaymentFilter = 'all' | 'rent' | 'utility' | 'maintenance' | 'deposit' | 'other';

const UnitDetailsScreen = ({ route, navigation }: any) => {
  const { propertyId, unitId } = route.params;
  const { properties, portfolio } = usePortfolio();
  const property = useMemo(() => properties.find((entry) => entry._id === propertyId), [properties, propertyId]);
  const [data, setData] = useState<any>(null);
  const [filter, setFilter] = useState<PaymentFilter>('all');
  const [editVisible, setEditVisible] = useState(false);
  const [form, setForm] = useState({ unitNumber: '', unitType: '', floor: '', monthlyRent: '', deposit: '' });
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const response = await api.get(`/properties/${propertyId}/units/${unitId}/details`);
    setData(response.data);
  };

  useEffect(() => {
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

  const viewReceipt = async (payment: any) => {
    setSharingId(payment._id);
    try {
      const receipt = buildPaymentReceipt(
        { ...payment, unitId: { unitNumber: unit?.unitNumber } },
        property?.name || '-',
        property?.address
      );
      await shareReceipt(receipt, portfolio?.name);
    } finally {
      setSharingId(null);
    }
  };

  const openEdit = () => {
    setForm({
      unitNumber: unit.unitNumber || '',
      unitType: unit.unitType || '',
      floor: unit.floor != null ? String(unit.floor) : '',
      monthlyRent: unit.monthlyRent != null ? String(unit.monthlyRent) : '',
      deposit: unit.deposit != null ? String(unit.deposit) : ''
    });
    setError('');
    setEditVisible(true);
  };

  const saveEdit = async () => {
    if (!form.unitNumber.trim() || !form.unitType.trim()) {
      setError('Unit number and type are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.patch(`/properties/${propertyId}/units/${unitId}`, {
        unitNumber: form.unitNumber,
        unitType: form.unitType,
        floor: form.floor ? Number(form.floor) : undefined,
        monthlyRent: Number(form.monthlyRent || 0),
        deposit: Number(form.deposit || 0)
      });
      await load();
      setEditVisible(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to update unit.');
    } finally {
      setSaving(false);
    }
  };

  const archiveUnit = () => {
    Alert.alert('Archive this unit?', 'The unit will be hidden from active lists. It can be restored later.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/properties/${propertyId}/units/${unitId}`);
            navigation.goBack();
          } catch (err: any) {
            Alert.alert('Unable to archive unit', err?.response?.data?.message || 'Move the tenant out first.');
          }
        }
      }
    ]);
  };

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
          <View style={styles.inlineActions}>
            <Button label="Edit" variant="secondary" small onPress={openEdit} />
            {!unit.currentTenant ? <Button label="Archive" variant="danger" small onPress={archiveUnit} /> : null}
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
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={styles.amount}>{formatCurrency(payment.amount)}</Text>
                <Button label="Receipt" variant="secondary" small loading={sharingId === payment._id} onPress={() => viewReceipt(payment)} />
              </View>
            </View>
          ))}
        </View>
      </Card>

      <Modal visible={editVisible} transparent animationType="fade" onRequestClose={() => setEditVisible(false)}>
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Edit Unit</Text>
            <Text style={styles.fieldLabel}>Unit Number</Text>
            <TextInput style={styles.input} value={form.unitNumber} onChangeText={(value) => setForm((current) => ({ ...current, unitNumber: value }))} />
            <Text style={styles.fieldLabel}>Unit Type</Text>
            <TextInput style={styles.input} value={form.unitType} onChangeText={(value) => setForm((current) => ({ ...current, unitType: value }))} />
            <Text style={styles.fieldLabel}>Floor</Text>
            <TextInput style={styles.input} value={form.floor} onChangeText={(value) => setForm((current) => ({ ...current, floor: value.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" />
            <Text style={styles.fieldLabel}>Monthly Rent</Text>
            <TextInput style={styles.input} value={form.monthlyRent} onChangeText={(value) => setForm((current) => ({ ...current, monthlyRent: value.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" />
            <Text style={styles.fieldLabel}>Deposit</Text>
            <TextInput style={styles.input} value={form.deposit} onChangeText={(value) => setForm((current) => ({ ...current, deposit: value.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Button label="Save" onPress={saveEdit} loading={saving} />
            <Button label="Cancel" variant="secondary" onPress={() => setEditVisible(false)} />
          </Card>
        </View>
      </Modal>
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
  amount: { fontFamily: fonts.headingSemi, fontSize: 18, color: colors.text },
  inlineActions: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  fieldLabel: { fontFamily: fonts.bodyBold, color: colors.text, marginTop: 2 },
  errorText: { fontFamily: fonts.bodyBold, color: colors.danger },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.body,
    color: colors.text,
    backgroundColor: '#fff'
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.28)', justifyContent: 'center', padding: 18 },
  modalCard: { gap: 12, maxHeight: '90%' }
});

export default UnitDetailsScreen;

