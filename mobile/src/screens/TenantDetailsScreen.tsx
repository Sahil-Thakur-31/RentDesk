import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TextInput, View } from 'react-native';
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

const TenantDetailsScreen = ({ route }: any) => {
  const { propertyId, tenantId } = route.params;
  const { properties, portfolio } = usePortfolio();
  const property = useMemo(() => properties.find((entry) => entry._id === propertyId), [properties, propertyId]);
  const [data, setData] = useState<any>(null);
  const [filter, setFilter] = useState<PaymentFilter>('all');
  const [editVisible, setEditVisible] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', idProofType: '', idProofNumber: '', emergencyContact: '' });
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const response = await api.get(`/properties/${propertyId}/tenants/${tenantId}/details`);
    setData(response.data);
  };

  useEffect(() => {
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

  const viewReceipt = async (payment: any) => {
    setSharingId(payment._id);
    try {
      const receipt = buildPaymentReceipt(
        {
          ...payment,
          tenantId: { fullName: tenant?.fullName, phone: tenant?.phone, depositAmount: tenant?.depositAmount },
          unitId: { unitNumber: tenant?.assignedUnit?.unitNumber }
        },
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
      fullName: tenant.fullName || '',
      phone: tenant.phone || '',
      email: tenant.email || '',
      idProofType: tenant.idProofType || '',
      idProofNumber: tenant.idProofNumber || '',
      emergencyContact: tenant.emergencyContact || ''
    });
    setError('');
    setEditVisible(true);
  };

  const saveEdit = async () => {
    if (!form.fullName.trim() || !form.phone.trim()) {
      setError('Full name and phone are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.patch(`/properties/${propertyId}/tenants/${tenantId}`, form);
      await load();
      setEditVisible(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to update tenant.');
    } finally {
      setSaving(false);
    }
  };

  const moveOut = () => {
    Alert.alert('Move out tenant?', `${tenant.fullName} will be marked as moved out and the unit freed up.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Move Out',
        style: 'destructive',
        onPress: async () => {
          await api.patch(`/properties/${propertyId}/tenants/${tenantId}/move-out`);
          await load();
        }
      }
    ]);
  };

  const reactivate = () => {
    Alert.alert('Reactivate tenant?', `${tenant.fullName} will be marked active again.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reactivate',
        onPress: async () => {
          await api.patch(`/properties/${propertyId}/tenants/${tenantId}/reactivate`);
          await load();
        }
      }
    ]);
  };

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
          <View style={styles.inlineActions}>
            <Button label="Edit" variant="secondary" small onPress={openEdit} />
            {tenant.isActive ? (
              <Button label="Move Out" variant="danger" small onPress={moveOut} />
            ) : (
              <Button label="Reactivate" variant="secondary" small onPress={reactivate} />
            )}
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
            <Text style={styles.sectionTitle}>Edit Tenant</Text>
            <Text style={styles.fieldLabel}>Full Name</Text>
            <TextInput style={styles.input} value={form.fullName} onChangeText={(value) => setForm((current) => ({ ...current, fullName: value }))} />
            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput style={styles.input} value={form.phone} onChangeText={(value) => setForm((current) => ({ ...current, phone: value }))} keyboardType="phone-pad" />
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput style={styles.input} value={form.email} onChangeText={(value) => setForm((current) => ({ ...current, email: value }))} autoCapitalize="none" />
            <Text style={styles.fieldLabel}>ID Proof Type</Text>
            <TextInput style={styles.input} value={form.idProofType} onChangeText={(value) => setForm((current) => ({ ...current, idProofType: value }))} />
            <Text style={styles.fieldLabel}>ID Proof Number</Text>
            <TextInput style={styles.input} value={form.idProofNumber} onChangeText={(value) => setForm((current) => ({ ...current, idProofNumber: value }))} />
            <Text style={styles.fieldLabel}>Emergency Contact</Text>
            <TextInput style={styles.input} value={form.emergencyContact} onChangeText={(value) => setForm((current) => ({ ...current, emergencyContact: value }))} keyboardType="phone-pad" />
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

export default TenantDetailsScreen;

