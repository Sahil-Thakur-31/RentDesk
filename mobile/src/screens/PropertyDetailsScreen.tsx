import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import api from '../lib/api';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Button from '../components/Button';
import Pill from '../components/Pill';
import { colors, fonts } from '../lib/theme';
import { formatCurrency } from '../lib/format';
import { getCurrentMonthValue, getMonthParts } from '../lib/date';

const PropertyDetailsScreen = ({ route, navigation }: any) => {
  const { propertyId } = route.params;
  const [property, setProperty] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [editVisible, setEditVisible] = useState(false);
  const [form, setForm] = useState({
    name: '',
    propertyType: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    notes: '',
    maintenanceCharge: '',
    electricityUnitRate: '',
    commonElectricityCharge: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { month, year } = getMonthParts(getCurrentMonthValue());

  const load = async () => {
    const [propertyRes, overviewRes, unitsRes] = await Promise.all([
      api.get(`/properties/${propertyId}`),
      api.get(`/properties/${propertyId}/overview`, { params: { month, year } }),
      api.get(`/properties/${propertyId}/units`)
    ]);
    setProperty(propertyRes.data);
    setOverview(overviewRes.data?.totals || null);
    setUnits(unitsRes.data || []);
  };

  useEffect(() => {
    void load();
  }, [month, propertyId, year]);

  const openEdit = () => {
    setForm({
      name: property.name || '',
      propertyType: property.propertyType || '',
      address: property.address || '',
      city: property.city || '',
      state: property.state || '',
      pincode: property.pincode || '',
      notes: property.notes || '',
      maintenanceCharge: property.maintenanceCharge != null ? String(property.maintenanceCharge) : '',
      electricityUnitRate: property.electricityUnitRate != null ? String(property.electricityUnitRate) : '',
      commonElectricityCharge: property.commonElectricityCharge != null ? String(property.commonElectricityCharge) : ''
    });
    setError('');
    setEditVisible(true);
  };

  const saveEdit = async () => {
    if (!form.name.trim() || !form.address.trim()) {
      setError('Name and address are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.patch(`/properties/${propertyId}`, {
        ...form,
        maintenanceCharge: Number(form.maintenanceCharge || 0),
        electricityUnitRate: Number(form.electricityUnitRate || 0),
        commonElectricityCharge: Number(form.commonElectricityCharge || 0)
      });
      await load();
      setEditVisible(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to update property.');
    } finally {
      setSaving(false);
    }
  };

  const archiveProperty = () => {
    Alert.alert('Archive this property?', 'It will be hidden from active lists. It can be restored later.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/properties/${propertyId}`);
            navigation.goBack();
          } catch (err: any) {
            Alert.alert('Unable to archive property', err?.response?.data?.message || 'Move all tenants out first.');
          }
        }
      }
    ]);
  };

  return (
    <Screen title={property?.name || 'Property'} subtitle={property ? `${property.city}, ${property.state}` : 'Loading property...'}>
      {property ? (
        <Card>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.value}>{property.address}</Text>
              <Text style={styles.meta}>{property.notes || 'No notes added yet.'}</Text>
            </View>
            <Pill label={property.propertyType} />
          </View>
          <View style={styles.statGrid}>
            <View style={styles.statBox}><Text style={styles.statLabel}>Rent</Text><Text style={styles.statValue}>{formatCurrency(overview?.monthlyExpectedRent)}</Text></View>
            <View style={styles.statBox}><Text style={styles.statLabel}>Collected</Text><Text style={styles.statValue}>{formatCurrency(overview?.collectedRent)}</Text></View>
            <View style={styles.statBox}><Text style={styles.statLabel}>Pending</Text><Text style={styles.statValue}>{formatCurrency(overview?.pendingRent)}</Text></View>
            <View style={styles.statBox}><Text style={styles.statLabel}>Units</Text><Text style={styles.statValue}>{overview?.totalUnits || 0}</Text></View>
          </View>
          <View style={styles.inlineActions}>
            <Button label="Edit" variant="secondary" small onPress={openEdit} />
            <Button label="Archive" variant="danger" small onPress={archiveProperty} />
          </View>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.sectionTitle}>Units</Text>
        <View style={styles.list}>
          {units.map((unit) => (
            <Pressable key={unit._id} style={styles.listRow} onPress={() => navigation.navigate('UnitDetails', { propertyId, unitId: unit._id })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.value}>{unit.unitNumber}</Text>
                <Text style={styles.meta}>{`${unit.unitType} • ${formatCurrency(unit.monthlyRent)}`}</Text>
              </View>
              <Pill label={unit.status === 'maintenance' ? 'Under Repair' : unit.status} />
            </Pressable>
          ))}
        </View>
      </Card>

      <Modal visible={editVisible} transparent animationType="fade" onRequestClose={() => setEditVisible(false)}>
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Edit Property</Text>
            <Text style={styles.fieldLabel}>Property Name</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={(value) => setForm((current) => ({ ...current, name: value }))} />
            <Text style={styles.fieldLabel}>Type</Text>
            <TextInput style={styles.input} value={form.propertyType} onChangeText={(value) => setForm((current) => ({ ...current, propertyType: value }))} />
            <Text style={styles.fieldLabel}>Address</Text>
            <TextInput style={styles.input} value={form.address} onChangeText={(value) => setForm((current) => ({ ...current, address: value }))} />
            <Text style={styles.fieldLabel}>City</Text>
            <TextInput style={styles.input} value={form.city} onChangeText={(value) => setForm((current) => ({ ...current, city: value }))} />
            <Text style={styles.fieldLabel}>State</Text>
            <TextInput style={styles.input} value={form.state} onChangeText={(value) => setForm((current) => ({ ...current, state: value }))} />
            <Text style={styles.fieldLabel}>Pincode</Text>
            <TextInput style={styles.input} value={form.pincode} onChangeText={(value) => setForm((current) => ({ ...current, pincode: value.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" />
            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput style={[styles.input, styles.notesInput]} value={form.notes} onChangeText={(value) => setForm((current) => ({ ...current, notes: value }))} multiline />
            <Text style={styles.fieldLabel}>Maintenance Charge</Text>
            <TextInput style={styles.input} value={form.maintenanceCharge} onChangeText={(value) => setForm((current) => ({ ...current, maintenanceCharge: value.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" />
            <Text style={styles.fieldLabel}>Electricity Rate</Text>
            <TextInput style={styles.input} value={form.electricityUnitRate} onChangeText={(value) => setForm((current) => ({ ...current, electricityUnitRate: value.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" />
            <Text style={styles.fieldLabel}>Common Electricity</Text>
            <TextInput style={styles.input} value={form.commonElectricityCharge} onChangeText={(value) => setForm((current) => ({ ...current, commonElectricityCharge: value.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" />
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
  value: { fontFamily: fonts.headingSemi, fontSize: 18, color: colors.text },
  meta: { fontFamily: fonts.body, color: colors.muted, marginTop: 4 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  statBox: { minWidth: '47%', borderRadius: 16, backgroundColor: colors.surface, padding: 12 },
  statLabel: { fontFamily: fonts.body, color: colors.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  statValue: { fontFamily: fonts.headingSemi, fontSize: 20, color: colors.text, marginTop: 6 },
  sectionTitle: { fontFamily: fonts.headingSemi, fontSize: 20, color: colors.text, marginBottom: 12 },
  list: { gap: 10 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
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
  notesInput: { minHeight: 82, textAlignVertical: 'top' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.28)', justifyContent: 'center', padding: 18 },
  modalCard: { gap: 12, maxHeight: '90%' }
});

export default PropertyDetailsScreen;

