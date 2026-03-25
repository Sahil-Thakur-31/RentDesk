import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import api from '../lib/api';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Button from '../components/Button';
import PropertyFilter from '../components/PropertyFilter';
import SegmentedControl from '../components/SegmentedControl';
import MonthSwitcher from '../components/MonthSwitcher';
import { usePortfolio } from '../context/PortfolioContext';
import { colors, fonts } from '../lib/theme';
import { getCurrentDateValue, getCurrentMonthValue, getMonthParts } from '../lib/date';

const ReportsScreen = () => {
  const { properties } = usePortfolio();
  const [propertyId, setPropertyId] = useState('');
  const [type, setType] = useState<'rent' | 'income' | 'utility' | 'maintenance' | 'tenant'>('rent');
  const [monthKey, setMonthKey] = useState(getCurrentMonthValue());
  const [start, setStart] = useState(getCurrentDateValue());
  const [end, setEnd] = useState(getCurrentDateValue());
  const [tenants, setTenants] = useState<any[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!propertyId) {
      setTenants([]);
      setTenantId('');
      return;
    }
    const loadTenants = async () => {
      const response = await api.get(`/properties/${propertyId}/tenants`);
      setTenants(response.data || []);
    };
    void loadTenants();
  }, [propertyId]);

  const run = async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const { month, year } = getMonthParts(monthKey);
      let response;
      if (type === 'rent') {
        response = await api.get(`/properties/${propertyId}/reports/monthly-rent`, { params: { month, year } });
      } else if (type === 'income') {
        response = await api.get(`/properties/${propertyId}/reports/property-income`, { params: { start, end } });
      } else if (type === 'utility') {
        response = await api.get(`/properties/${propertyId}/reports/utility-bills`, { params: { month: monthKey } });
      } else if (type === 'maintenance') {
        response = await api.get(`/properties/${propertyId}/reports/maintenance-expenses`, { params: { start, end } });
      } else {
        response = await api.get(`/properties/${propertyId}/reports/tenant/${tenantId}`);
      }
      setRows(response.data?.rows || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Reports" subtitle="Preview report data on mobile.">
      <PropertyFilter properties={properties} value={propertyId} onChange={setPropertyId} />
      <SegmentedControl
        options={[
          { label: 'Rent', value: 'rent' },
          { label: 'Income', value: 'income' },
          { label: 'Utility', value: 'utility' },
          { label: 'Maintenance', value: 'maintenance' },
          { label: 'Tenant', value: 'tenant' }
        ]}
        value={type}
        onChange={(value) => setType(value as any)}
      />
      {(type === 'rent' || type === 'utility') ? <MonthSwitcher value={monthKey} onChange={setMonthKey} /> : null}
      {(type === 'income' || type === 'maintenance') ? (
        <Card>
          <TextInput style={styles.input} value={start} onChangeText={setStart} placeholder="YYYY-MM-DD" />
          <TextInput style={[styles.input, { marginTop: 10 }]} value={end} onChangeText={setEnd} placeholder="YYYY-MM-DD" />
        </Card>
      ) : null}
      {type === 'tenant' ? (
        <Card>
          <Text style={styles.sectionTitle}>Tenant</Text>
          <View style={styles.stack}>
            {tenants.map((tenant) => (
              <Button key={tenant._id} label={tenant.fullName} variant={tenantId === tenant._id ? 'primary' : 'secondary'} onPress={() => setTenantId(tenant._id)} />
            ))}
          </View>
        </Card>
      ) : null}
      <Button label={loading ? 'Loading...' : 'Load Report'} onPress={run} loading={loading} disabled={!propertyId || (type === 'tenant' && !tenantId)} />
      <Card>
        <Text style={styles.sectionTitle}>Rows</Text>
        <View style={styles.stack}>
          {rows.length ? rows.slice(0, 20).map((row, index) => (
            <View key={index} style={styles.rowCard}>
              {Object.entries(row).map(([key, value]) => (
                <Text key={key} style={styles.meta}>{key}: {String(value)}</Text>
              ))}
            </View>
          )) : <Text style={styles.meta}>Run a report to see rows here.</Text>}
        </View>
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  sectionTitle: { fontFamily: fonts.headingSemi, fontSize: 20, color: colors.text },
  stack: { gap: 10 },
  rowCard: { borderRadius: 16, backgroundColor: colors.surface, padding: 12, gap: 4 },
  meta: { fontFamily: fonts.body, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.body,
    color: colors.text,
    backgroundColor: '#fff'
  }
});

export default ReportsScreen;

