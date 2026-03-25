import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import api from '../lib/api';
import Screen from '../components/Screen';
import PropertyFilter from '../components/PropertyFilter';
import SegmentedControl from '../components/SegmentedControl';
import Card from '../components/Card';
import Pill from '../components/Pill';
import Button from '../components/Button';
import { usePortfolio } from '../context/PortfolioContext';
import { colors, fonts } from '../lib/theme';
import { formatCurrency } from '../lib/format';

type PortfolioTab = 'properties' | 'units' | 'tenants';

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

const PortfolioScreen = ({ navigation }: any) => {
  const { properties, refresh } = usePortfolio();
  const [tab, setTab] = useState<PortfolioTab>('properties');
  const [propertyId, setPropertyId] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [formPropertyId, setFormPropertyId] = useState('');
  const [formUnits, setFormUnits] = useState<any[]>([]);
  const [propertyForm, setPropertyForm] = useState({
    name: '',
    propertyType: 'building',
    address: '',
    city: '',
    state: '',
    pincode: '',
    notes: '',
    maintenanceCharge: '',
    electricityUnitRate: '',
    commonElectricityCharge: ''
  });
  const [unitForm, setUnitForm] = useState({
    unitNumber: '',
    unitType: '',
    floor: '',
    monthlyRent: '',
    deposit: '',
    lastMeterReading: ''
  });
  const [tenantForm, setTenantForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    idProofType: '',
    idProofNumber: '',
    emergencyContact: '',
    assignedUnit: '',
    depositPaid: ''
  });

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'properties') {
        setItems(propertyId ? properties.filter((property) => property._id === propertyId) : properties);
        return;
      }

      const sourceProperties = propertyId ? properties.filter((property) => property._id === propertyId) : properties;
      const results = await Promise.all(
        sourceProperties.map(async (property) => {
          const path = tab === 'units' ? 'units' : 'tenants';
          const response = await api.get(`/properties/${property._id}/${path}`);
          return (response.data || []).map((item: any) => ({ ...item, propertyName: property.name, propertyId: property._id }));
        })
      );
      setItems(results.flat());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [properties, propertyId, tab]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!modalVisible || tab === 'properties' || !formPropertyId) {
      setFormUnits([]);
      return;
    }

    const loadUnits = async () => {
      try {
        const response = await api.get(`/properties/${formPropertyId}/units`);
        setFormUnits(response.data || []);
      } catch {
        setFormUnits([]);
      }
    };

    void loadUnits();
  }, [formPropertyId, modalVisible, tab]);

  const openModal = () => {
    setError('');
    setMessage('');
    setPropertyForm({
      name: '',
      propertyType: 'building',
      address: '',
      city: '',
      state: '',
      pincode: '',
      notes: '',
      maintenanceCharge: '',
      electricityUnitRate: '',
      commonElectricityCharge: ''
    });
    setUnitForm({
      unitNumber: '',
      unitType: '',
      floor: '',
      monthlyRent: '',
      deposit: '',
      lastMeterReading: ''
    });
    setTenantForm({
      fullName: '',
      phone: '',
      email: '',
      idProofType: '',
      idProofNumber: '',
      emergencyContact: '',
      assignedUnit: '',
      depositPaid: ''
    });
    setFormPropertyId(propertyId || properties[0]?._id || '');
    setModalVisible(true);
  };

  const submit = async () => {
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      if (tab === 'properties') {
        await api.post('/properties', {
          ...propertyForm,
          maintenanceCharge: Number(propertyForm.maintenanceCharge || 0),
          electricityUnitRate: Number(propertyForm.electricityUnitRate || 0),
          commonElectricityCharge: Number(propertyForm.commonElectricityCharge || 0)
        });
        await refresh();
      }

      if (tab === 'units') {
        if (!formPropertyId) throw new Error('Choose a property first.');
        await api.post(`/properties/${formPropertyId}/units`, {
          unitNumber: unitForm.unitNumber,
          unitType: unitForm.unitType,
          floor: unitForm.floor ? Number(unitForm.floor) : undefined,
          monthlyRent: Number(unitForm.monthlyRent || 0),
          deposit: Number(unitForm.deposit || 0),
          lastMeterReading: unitForm.lastMeterReading ? Number(unitForm.lastMeterReading) : undefined
        });
      }

      if (tab === 'tenants') {
        if (!formPropertyId) throw new Error('Choose a property first.');
        await api.post(`/properties/${formPropertyId}/tenants`, {
          ...tenantForm,
          depositPaid: Number(tenantForm.depositPaid || 0)
        });
      }

      setModalVisible(false);
      setMessage(`${tab.slice(0, -1).charAt(0).toUpperCase()}${tab.slice(1, -1)} added.`);
      await refresh();
      await loadItems();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Unable to save right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      title="Portfolio"
      right={
        <View style={styles.headerActions}>
          <Button label="Add" small onPress={openModal} />
          <Pressable onPress={() => refresh()}>
            <Text style={styles.link}>Refresh</Text>
          </Pressable>
        </View>
      }
    >
      <SegmentedControl
        options={[
          { label: 'Properties', value: 'properties' },
          { label: 'Units', value: 'units' },
          { label: 'Tenants', value: 'tenants' }
        ]}
        value={tab}
        onChange={(value) => setTab(value as PortfolioTab)}
      />
      <PropertyFilter properties={properties} value={propertyId} onChange={setPropertyId} />

      {(message || error) ? (
        <Card style={error ? styles.errorCard : styles.successCard}>
          <Text style={error ? styles.errorText : styles.successText}>{error || message}</Text>
        </Card>
      ) : null}

      <View style={styles.list}>
        {items.length ? (
          items.map((item) => {
            if (tab === 'properties') {
              return (
                <Pressable key={item._id} onPress={() => navigation.navigate('PropertyDetails', { propertyId: item._id })}>
                  <Card>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.title}>{item.name}</Text>
                        <Text style={styles.meta}>{item.address}</Text>
                        <Text style={styles.meta}>{`${item.city}, ${item.state}`}</Text>
                      </View>
                      <Pill label={item.propertyType} />
                    </View>
                  </Card>
                </Pressable>
              );
            }

            if (tab === 'units') {
              return (
                <Pressable
                  key={item._id}
                  onPress={() => navigation.navigate('UnitDetails', { propertyId: item.propertyId, unitId: item._id })}
                >
                  <Card>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.title}>{item.unitNumber}</Text>
                        <Text style={styles.meta}>{item.propertyName}</Text>
                        <Text style={styles.meta}>{`${item.unitType} • ${formatCurrency(item.monthlyRent)}`}</Text>
                      </View>
                      <Pill
                        label={item.status === 'maintenance' ? 'Under Repair' : item.status}
                        tone={item.status === 'occupied' ? 'success' : item.status === 'maintenance' ? 'warning' : 'default'}
                      />
                    </View>
                  </Card>
                </Pressable>
              );
            }

            return (
              <Pressable
                key={item._id}
                onPress={() => navigation.navigate('TenantDetails', { propertyId: item.propertyId, tenantId: item._id })}
              >
                <Card>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.title}>{item.fullName}</Text>
                      <Text style={styles.meta}>{item.propertyName}</Text>
                      <Text style={styles.meta}>{item.phone}</Text>
                    </View>
                    <Pill label={item.isActive ? 'Active' : 'Moved Out'} tone={item.isActive ? 'success' : 'warning'} />
                  </View>
                </Card>
              </Pressable>
            );
          })
        ) : (
          <Card>
            <Text style={styles.meta}>{loading ? 'Loading...' : 'Nothing to show here yet.'}</Text>
          </Card>
        )}
      </View>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>
                Add {tab === 'properties' ? 'Property' : tab === 'units' ? 'Unit' : 'Tenant'}
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Text style={styles.link}>Close</Text>
              </Pressable>
            </View>

            {tab !== 'properties' ? (
              <>
                <Text style={styles.fieldLabel}>Property</Text>
                <ChoiceChips items={properties} value={formPropertyId} onChange={setFormPropertyId} getLabel={(item) => item.name} />
              </>
            ) : null}

            {tab === 'properties' ? (
              <>
                <Text style={styles.fieldLabel}>Property Name</Text>
                <TextInput style={styles.input} value={propertyForm.name} onChangeText={(value) => setPropertyForm((current) => ({ ...current, name: value }))} />
                <Text style={styles.fieldLabel}>Type</Text>
                <TextInput style={styles.input} value={propertyForm.propertyType} onChangeText={(value) => setPropertyForm((current) => ({ ...current, propertyType: value }))} />
                <Text style={styles.fieldLabel}>Address</Text>
                <TextInput style={styles.input} value={propertyForm.address} onChangeText={(value) => setPropertyForm((current) => ({ ...current, address: value }))} />
                <Text style={styles.fieldLabel}>City</Text>
                <TextInput style={styles.input} value={propertyForm.city} onChangeText={(value) => setPropertyForm((current) => ({ ...current, city: value }))} />
                <Text style={styles.fieldLabel}>State</Text>
                <TextInput style={styles.input} value={propertyForm.state} onChangeText={(value) => setPropertyForm((current) => ({ ...current, state: value }))} />
                <Text style={styles.fieldLabel}>Pincode</Text>
                <TextInput style={styles.input} value={propertyForm.pincode} onChangeText={(value) => setPropertyForm((current) => ({ ...current, pincode: value }))} keyboardType="number-pad" />
                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput style={[styles.input, styles.notesInput]} value={propertyForm.notes} onChangeText={(value) => setPropertyForm((current) => ({ ...current, notes: value }))} multiline />
                <Text style={styles.fieldLabel}>Maintenance Charge</Text>
                <TextInput style={styles.input} value={propertyForm.maintenanceCharge} onChangeText={(value) => setPropertyForm((current) => ({ ...current, maintenanceCharge: value.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" />
                <Text style={styles.fieldLabel}>Electricity Rate</Text>
                <TextInput style={styles.input} value={propertyForm.electricityUnitRate} onChangeText={(value) => setPropertyForm((current) => ({ ...current, electricityUnitRate: value.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" />
                <Text style={styles.fieldLabel}>Common Electricity</Text>
                <TextInput style={styles.input} value={propertyForm.commonElectricityCharge} onChangeText={(value) => setPropertyForm((current) => ({ ...current, commonElectricityCharge: value.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" />
              </>
            ) : null}

            {tab === 'units' ? (
              <>
                <Text style={styles.fieldLabel}>Unit Number</Text>
                <TextInput style={styles.input} value={unitForm.unitNumber} onChangeText={(value) => setUnitForm((current) => ({ ...current, unitNumber: value }))} />
                <Text style={styles.fieldLabel}>Unit Type</Text>
                <TextInput style={styles.input} value={unitForm.unitType} onChangeText={(value) => setUnitForm((current) => ({ ...current, unitType: value }))} />
                <Text style={styles.fieldLabel}>Floor</Text>
                <TextInput style={styles.input} value={unitForm.floor} onChangeText={(value) => setUnitForm((current) => ({ ...current, floor: value.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" />
                <Text style={styles.fieldLabel}>Monthly Rent</Text>
                <TextInput style={styles.input} value={unitForm.monthlyRent} onChangeText={(value) => setUnitForm((current) => ({ ...current, monthlyRent: value.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" />
                <Text style={styles.fieldLabel}>Deposit</Text>
                <TextInput style={styles.input} value={unitForm.deposit} onChangeText={(value) => setUnitForm((current) => ({ ...current, deposit: value.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" />
                <Text style={styles.fieldLabel}>Meter Reading</Text>
                <TextInput style={styles.input} value={unitForm.lastMeterReading} onChangeText={(value) => setUnitForm((current) => ({ ...current, lastMeterReading: value.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" />
              </>
            ) : null}

            {tab === 'tenants' ? (
              <>
                <Text style={styles.fieldLabel}>Full Name</Text>
                <TextInput style={styles.input} value={tenantForm.fullName} onChangeText={(value) => setTenantForm((current) => ({ ...current, fullName: value }))} />
                <Text style={styles.fieldLabel}>Phone</Text>
                <TextInput style={styles.input} value={tenantForm.phone} onChangeText={(value) => setTenantForm((current) => ({ ...current, phone: value }))} keyboardType="phone-pad" />
                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput style={styles.input} value={tenantForm.email} onChangeText={(value) => setTenantForm((current) => ({ ...current, email: value }))} autoCapitalize="none" />
                <Text style={styles.fieldLabel}>ID Proof Type</Text>
                <TextInput style={styles.input} value={tenantForm.idProofType} onChangeText={(value) => setTenantForm((current) => ({ ...current, idProofType: value }))} />
                <Text style={styles.fieldLabel}>ID Proof Number</Text>
                <TextInput style={styles.input} value={tenantForm.idProofNumber} onChangeText={(value) => setTenantForm((current) => ({ ...current, idProofNumber: value }))} />
                <Text style={styles.fieldLabel}>Emergency Contact</Text>
                <TextInput style={styles.input} value={tenantForm.emergencyContact} onChangeText={(value) => setTenantForm((current) => ({ ...current, emergencyContact: value }))} keyboardType="phone-pad" />
                <Text style={styles.fieldLabel}>Unit</Text>
                <ChoiceChips items={formUnits} value={tenantForm.assignedUnit} onChange={(value) => setTenantForm((current) => ({ ...current, assignedUnit: value }))} getLabel={(item) => item.unitNumber} />
                <Text style={styles.fieldLabel}>Deposit Paid</Text>
                <TextInput style={styles.input} value={tenantForm.depositPaid} onChangeText={(value) => setTenantForm((current) => ({ ...current, depositPaid: value.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" />
              </>
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <View style={styles.modalActions}>
              <Button label={submitting ? 'Saving...' : 'Save'} onPress={submit} loading={submitting} />
              <Button label="Cancel" variant="secondary" onPress={() => setModalVisible(false)} />
            </View>
          </Card>
        </View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  link: { fontFamily: fonts.bodyBold, color: colors.accent, marginTop: 12 },
  list: { gap: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  title: { fontFamily: fonts.headingSemi, fontSize: 18, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 4 },
  successCard: { borderColor: '#bbf7d0', backgroundColor: '#ecfdf5' },
  errorCard: { borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  successText: { fontFamily: fonts.bodyBold, color: colors.success },
  errorText: { fontFamily: fonts.bodyBold, color: colors.danger },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.28)', justifyContent: 'center', padding: 18 },
  modalCard: { gap: 12, maxHeight: '90%' },
  modalTitle: { fontFamily: fonts.headingSemi, fontSize: 24, color: colors.text },
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

export default PortfolioScreen;
