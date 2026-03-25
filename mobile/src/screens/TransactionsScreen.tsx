import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import api from '../lib/api';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Button from '../components/Button';
import SegmentedControl from '../components/SegmentedControl';
import PropertyFilter from '../components/PropertyFilter';
import MonthSwitcher from '../components/MonthSwitcher';
import Pill from '../components/Pill';
import { usePortfolio } from '../context/PortfolioContext';
import { colors, fonts } from '../lib/theme';
import { capitalize, formatCurrency } from '../lib/format';
import { formatDate, getCurrentMonthValue, getMonthParts } from '../lib/date';

const getId = (value: any) => String(value?._id || value || '');
const startOfMonth = (monthKey: string) => new Date(`${monthKey}-01T00:00:00`);
const endOfMonth = (monthKey: string) => {
  const start = startOfMonth(monthKey);
  return new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
};
const monthActionDate = (monthKey: string) => {
  const today = new Date();
  const [year, month] = monthKey.split('-').map(Number);
  if (today.getFullYear() === year && today.getMonth() + 1 === month) return today.toISOString();
  return new Date(year, month - 1, 15, 12, 0, 0).toISOString();
};

type TransactionType = 'all' | 'rent' | 'utility' | 'maintenance' | 'deposit' | 'other';
type PaymentType = 'rent' | 'utility' | 'maintenance' | 'deposit' | 'other';

const ChoiceChips = ({
  items,
  value,
  onChange,
  getLabel
}: {
  items: any[];
  value: string;
  onChange: (value: string) => void;
  getLabel: (item: any) => string;
}) => (
  <View style={styles.chipWrap}>
    {items.map((item) => {
      const active = value === item._id;
      return (
        <Pressable key={item._id} onPress={() => onChange(item._id)} style={[styles.choiceChip, active && styles.choiceChipActive]}>
          <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{getLabel(item)}</Text>
        </Pressable>
      );
    })}
  </View>
);

const TransactionsScreen = ({ navigation, route }: any) => {
  const { properties, refresh } = usePortfolio();
  const [propertyId, setPropertyId] = useState('');
  const [type, setType] = useState<TransactionType>('all');
  const [monthKey, setMonthKey] = useState(getCurrentMonthValue());
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [modalPropertyId, setModalPropertyId] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType>('rent');
  const [paymentMonth, setPaymentMonth] = useState(getCurrentMonthValue());
  const [maintenanceMode, setMaintenanceMode] = useState<'collected' | 'spent'>('collected');
  const [depositMode, setDepositMode] = useState<'collect' | 'refund'>('collect');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [rentLookup, setRentLookup] = useState<any[]>([]);
  const [utilityLookup, setUtilityLookup] = useState<any[]>([]);
  const [paymentLookup, setPaymentLookup] = useState<any[]>([]);

  const selectedProperties = useMemo(
    () => (propertyId ? properties.filter((property) => property._id === propertyId) : properties),
    [properties, propertyId]
  );

  const modalProperty = useMemo(() => properties.find((property) => property._id === modalPropertyId), [modalPropertyId, properties]);
  const selectedTenant = useMemo(() => tenants.find((tenant) => tenant._id === selectedTenantId), [selectedTenantId, tenants]);
  const selectedUnit = useMemo(() => units.find((unit) => unit._id === selectedUnitId), [selectedUnitId, units]);
  const [selectedMonthNumber, selectedYearNumber] = [getMonthParts(paymentMonth).month, getMonthParts(paymentMonth).year];
  const selectedRentRecord = useMemo(
    () =>
      rentLookup.find(
        (record) => getId(record.tenantId) === selectedTenantId && Number(record.month) === selectedMonthNumber && Number(record.year) === selectedYearNumber
      ) || null,
    [rentLookup, selectedTenantId, selectedMonthNumber, selectedYearNumber]
  );
  const selectedUtilityBill = useMemo(
    () => utilityLookup.find((bill) => getId(bill.unitId) === selectedUnitId && bill.month === paymentMonth) || null,
    [paymentMonth, selectedUnitId, utilityLookup]
  );
  const depositHeld = useMemo(() => {
    if (!selectedTenantId) return 0;
    return paymentLookup.reduce((sum, payment) => {
      if (getId(payment.tenantId) !== selectedTenantId) return sum;
      if (payment.type === 'deposit') return sum + Number(payment.amount || 0);
      if (payment.type === 'refund') return sum - Number(payment.amount || 0);
      return sum;
    }, 0);
  }, [paymentLookup, selectedTenantId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const monthStart = startOfMonth(monthKey).toISOString();
        const monthEnd = endOfMonth(monthKey).toISOString();
        const responses = await Promise.all(
          selectedProperties.map(async (property) => {
            const response = await api.get(`/properties/${property._id}/payments`, { params: { startDate: monthStart, endDate: monthEnd } });
            return (response.data || []).map((item: any) => ({ ...item, propertyName: property.name }));
          })
        );
        setItems(responses.flat());
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [monthKey, selectedProperties]);

  useEffect(() => {
    if (!modalVisible || !modalPropertyId) {
      setTenants([]);
      setUnits([]);
      setRentLookup([]);
      setUtilityLookup([]);
      setPaymentLookup([]);
      return;
    }

    const loadLookups = async () => {
      const monthStart = startOfMonth(paymentMonth).toISOString();
      const monthEnd = endOfMonth(paymentMonth).toISOString();
      const { month, year } = getMonthParts(paymentMonth);
      const [tenantRes, unitRes, rentRes, utilityRes, paymentRes] = await Promise.all([
        api.get(`/properties/${modalPropertyId}/tenants`),
        api.get(`/properties/${modalPropertyId}/units`),
        api.get(`/properties/${modalPropertyId}/rent-records`, { params: { month, year } }),
        api.get(`/properties/${modalPropertyId}/utility-bills`, { params: { month: paymentMonth } }),
        api.get(`/properties/${modalPropertyId}/payments`, { params: { startDate: monthStart, endDate: monthEnd } })
      ]);
      setTenants(tenantRes.data || []);
      setUnits(unitRes.data || []);
      setRentLookup(rentRes.data || []);
      setUtilityLookup(utilityRes.data || []);
      setPaymentLookup(paymentRes.data || []);
    };

    void loadLookups();
  }, [modalPropertyId, modalVisible, paymentMonth]);

  useEffect(() => {
    if (paymentType === 'rent' && selectedTenant) {
      const remaining = Math.max(0, Number(selectedRentRecord?.rentAmount || selectedTenant.rentAmount || 0) - Number(selectedRentRecord?.paidAmount || 0));
      setAmount(String(remaining || ''));
      setSelectedUnitId(getId(selectedTenant.assignedUnit || selectedTenant.unitId));
    }
    if (paymentType === 'utility' && selectedUtilityBill) {
      setAmount(String(selectedUtilityBill.amount || ''));
    }
    if (paymentType === 'maintenance' && maintenanceMode === 'collected' && selectedTenant && modalProperty) {
      setAmount(String(Number(modalProperty.maintenanceCharge || 0) || ''));
      setSelectedUnitId(getId(selectedTenant.assignedUnit || selectedTenant.unitId));
    }
    if (paymentType === 'deposit' && selectedTenant) {
      const target = depositMode === 'collect'
        ? Math.max(0, Number(selectedTenant.depositAmount || 0) - Math.max(0, depositHeld))
        : Math.max(0, depositHeld);
      setAmount(String(target || ''));
      setSelectedUnitId(getId(selectedTenant.assignedUnit || selectedTenant.unitId));
    }
  }, [depositHeld, depositMode, maintenanceMode, modalProperty, paymentType, selectedRentRecord, selectedTenant, selectedUtilityBill]);

  const filteredItems = useMemo(() => {
    if (type === 'all') return items;
    if (type === 'other') return items.filter((item) => item.type === 'other');
    if (type === 'deposit') return items.filter((item) => item.type === 'deposit' || item.type === 'refund');
    return items.filter((item) => item.type === type);
  }, [items, type]);

  const openModal = () => {
    setModalPropertyId(propertyId || properties[0]?._id || '');
    setPaymentType('rent');
    setPaymentMonth(monthKey);
    setMaintenanceMode('collected');
    setDepositMode('collect');
    setSelectedTenantId('');
    setSelectedUnitId('');
    setAmount('');
    setNotes('');
    setError('');
    setMessage('');
    setModalVisible(true);
  };

  useEffect(() => {
    if (!route?.params?.openAddPayment) return;
    openModal();
    navigation.setParams?.({ openAddPayment: false });
  }, [navigation, route?.params?.openAddPayment, propertyId, properties, monthKey]);

  const submitPayment = async () => {
    if (!modalPropertyId) {
      setError('Choose a property first.');
      return;
    }

    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      if (paymentType === 'rent') {
        if (!selectedTenant) throw new Error('Choose a tenant first.');
        const payload = {
          unitId: getId(selectedTenant.assignedUnit || selectedTenant.unitId),
          tenantId: selectedTenant._id,
          month: selectedMonthNumber,
          year: selectedYearNumber,
          rentAmount: Number(selectedRentRecord?.rentAmount || selectedTenant.rentAmount || 0),
          paidAmount: Number(amount || 0),
          paymentMode: 'cash',
          paidDate: monthActionDate(paymentMonth)
        };
        if (selectedRentRecord?._id) {
          await api.post(`/properties/${modalPropertyId}/rent-records/${selectedRentRecord._id}/collect`, {
            amount: Number(amount || 0),
            paymentMode: 'cash',
            paidDate: monthActionDate(paymentMonth)
          });
        } else {
          await api.post(`/properties/${modalPropertyId}/rent-records`, payload);
        }
      }

      if (paymentType === 'utility') {
        if (!selectedUtilityBill?._id) throw new Error('Create the utility bill first from Utilities.');
        await api.patch(`/properties/${modalPropertyId}/utility-bills/${selectedUtilityBill._id}`, {
          status: 'paid'
        });
      }

      if (paymentType === 'maintenance') {
        if (maintenanceMode === 'collected') {
          if (!selectedTenant) throw new Error('Choose a tenant first.');
          await api.post(`/properties/${modalPropertyId}/payments`, {
            type: 'maintenance',
            amount: Number(amount || 0),
            date: monthActionDate(paymentMonth),
            unitId: getId(selectedTenant.assignedUnit || selectedTenant.unitId),
            tenantId: selectedTenant._id,
            notes: `Maintenance collected for ${paymentMonth}`
          });
        } else {
          await api.post(`/properties/${modalPropertyId}/payments`, {
            type: 'maintenance',
            amount: Number(amount || 0),
            date: monthActionDate(paymentMonth),
            notes: notes || 'Maintenance spent'
          });
        }
      }

      if (paymentType === 'deposit') {
        if (!selectedTenant) throw new Error('Choose a tenant first.');
        await api.post(`/properties/${modalPropertyId}/payments`, {
          type: depositMode === 'collect' ? 'deposit' : 'refund',
          amount: Number(amount || 0),
          date: monthActionDate(paymentMonth),
          unitId: getId(selectedTenant.assignedUnit || selectedTenant.unitId),
          tenantId: selectedTenant._id,
          notes: depositMode === 'collect' ? 'Security deposit collected' : 'Security deposit refunded'
        });
      }

      if (paymentType === 'other') {
        await api.post(`/properties/${modalPropertyId}/payments`, {
          type: 'other',
          amount: Number(amount || 0),
          date: monthActionDate(paymentMonth),
          notes
        });
      }

      setModalVisible(false);
      setMessage('Payment saved.');
      await refresh();
      const monthStart = startOfMonth(monthKey).toISOString();
      const monthEnd = endOfMonth(monthKey).toISOString();
      const responses = await Promise.all(
        selectedProperties.map(async (property) => {
          const response = await api.get(`/properties/${property._id}/payments`, { params: { startDate: monthStart, endDate: monthEnd } });
          return (response.data || []).map((item: any) => ({ ...item, propertyName: property.name }));
        })
      );
      setItems(responses.flat());
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Unable to save payment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen title="Transactions" right={<Button label="Add Payment" onPress={openModal} small />}>
      <SegmentedControl
        options={[
          { label: 'All', value: 'all' },
          { label: 'Rent', value: 'rent' },
          { label: 'Utility', value: 'utility' },
          { label: 'Maintenance', value: 'maintenance' },
          { label: 'Deposit', value: 'deposit' },
          { label: 'Others', value: 'other' }
        ]}
        value={type}
        onChange={(value) => setType(value as TransactionType)}
      />
      <PropertyFilter properties={properties} value={propertyId} onChange={setPropertyId} />
      <MonthSwitcher value={monthKey} onChange={setMonthKey} />

      {(message || error) ? (
        <Card style={error ? styles.errorCard : styles.successCard}>
          <Text style={error ? styles.errorText : styles.successText}>{error || message}</Text>
        </Card>
      ) : null}

      <View style={styles.list}>
        {filteredItems.length ? (
          filteredItems.map((item) => (
            <Card key={item._id}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{capitalize(item.type)}</Text>
                  <Text style={styles.itemMeta}>{item.propertyName || '-'}</Text>
                  <Text style={styles.itemMeta}>{formatDate(item.date)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 8 }}>
                  <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
                  <Pill label={item.type === 'refund' ? 'Refund' : capitalize(item.type)} />
                </View>
              </View>
              {item.notes ? <Text style={[styles.itemMeta, { marginTop: 10 }]}>{item.notes}</Text> : null}
            </Card>
          ))
        ) : (
          <Card><Text style={styles.itemMeta}>{loading ? 'Loading...' : 'No transactions for this filter.'}</Text></Card>
        )}
      </View>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>Add Payment</Text>
              <Pressable onPress={() => setModalVisible(false)}><Text style={styles.link}>Close</Text></Pressable>
            </View>

            <SegmentedControl
              options={[
                { label: 'Rent', value: 'rent' },
                { label: 'Utility', value: 'utility' },
                { label: 'Maintenance', value: 'maintenance' },
                { label: 'Deposit', value: 'deposit' },
                { label: 'Other', value: 'other' }
              ]}
              value={paymentType}
              onChange={(value) => setPaymentType(value as PaymentType)}
            />

            <Text style={styles.fieldLabel}>Property</Text>
            <PropertyFilter properties={properties} value={modalPropertyId} onChange={setModalPropertyId} />
            <MonthSwitcher value={paymentMonth} onChange={setPaymentMonth} />

            {(paymentType === 'rent' || paymentType === 'maintenance' || paymentType === 'deposit') ? (
              <>
                <Text style={styles.fieldLabel}>Tenant</Text>
                <ChoiceChips items={tenants.filter((tenant) => tenant.isActive)} value={selectedTenantId} onChange={setSelectedTenantId} getLabel={(tenant) => tenant.fullName} />
              </>
            ) : null}

            {paymentType === 'utility' ? (
              <>
                <Text style={styles.fieldLabel}>Unit</Text>
                <ChoiceChips items={units} value={selectedUnitId} onChange={setSelectedUnitId} getLabel={(unit) => unit.unitNumber} />
              </>
            ) : null}

            {paymentType === 'maintenance' ? (
              <SegmentedControl
                options={[
                  { label: 'Collected', value: 'collected' },
                  { label: 'Spent', value: 'spent' }
                ]}
                value={maintenanceMode}
                onChange={(value) => setMaintenanceMode(value as 'collected' | 'spent')}
              />
            ) : null}

            {paymentType === 'deposit' ? (
              <SegmentedControl
                options={[
                  { label: 'Collect', value: 'collect' },
                  { label: 'Refund', value: 'refund' }
                ]}
                value={depositMode}
                onChange={(value) => setDepositMode(value as 'collect' | 'refund')}
              />
            ) : null}

            <Text style={styles.fieldLabel}>Amount</Text>
            <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" />

            {(paymentType === 'other' || (paymentType === 'maintenance' && maintenanceMode === 'spent')) ? (
              <>
                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput style={[styles.input, styles.notesInput]} value={notes} onChangeText={setNotes} placeholder="Reason or note" multiline />
              </>
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <View style={styles.modalActions}>
              <Button label="Save Payment" onPress={submitPayment} loading={submitting} />
              <Button label="Cancel" variant="secondary" onPress={() => setModalVisible(false)} />
            </View>
          </Card>
        </View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  list: { gap: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  itemTitle: { fontFamily: fonts.headingSemi, fontSize: 18, color: colors.text },
  itemMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 4 },
  amount: { fontFamily: fonts.headingSemi, fontSize: 20, color: colors.text },
  successCard: { borderColor: '#bbf7d0', backgroundColor: '#ecfdf5' },
  errorCard: { borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  successText: { fontFamily: fonts.bodyBold, color: colors.success },
  errorText: { fontFamily: fonts.bodyBold, color: colors.danger },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.28)', justifyContent: 'center', padding: 18 },
  modalCard: { gap: 12, maxHeight: '88%' },
  modalTitle: { fontFamily: fonts.headingSemi, fontSize: 24, color: colors.text },
  link: { fontFamily: fonts.bodyBold, color: colors.accent },
  fieldLabel: { fontFamily: fonts.bodyBold, color: colors.text, marginTop: 2 },
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
  notesInput: { minHeight: 82, textAlignVertical: 'top' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border
  },
  choiceChipActive: { backgroundColor: colors.accentSoft, borderColor: '#9ee9dc' },
  choiceChipText: { fontFamily: fonts.bodyBold, color: colors.text },
  choiceChipTextActive: { color: colors.accent },
  modalActions: { gap: 10, marginTop: 4 }
});

export default TransactionsScreen;

