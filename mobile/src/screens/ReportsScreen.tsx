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
import { downloadAndShareReport } from '../lib/exportFile';

type ReportType = 'rent' | 'income' | 'utility' | 'maintenance' | 'tenant';

const ReportsScreen = () => {
  const { properties } = usePortfolio();
  const [propertyId, setPropertyId] = useState('');
  const [type, setType] = useState<ReportType>('rent');
  const [monthKey, setMonthKey] = useState(getCurrentMonthValue());
  const [start, setStart] = useState(getCurrentDateValue());
  const [end, setEnd] = useState(getCurrentDateValue());
  const [tenants, setTenants] = useState<any[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<'excel' | 'pdf' | null>(null);

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

  useEffect(() => {
    if (type === 'tenant' && !propertyId) setType('rent');
  }, [propertyId, type]);

  const basePath = () => (propertyId ? `/properties/${propertyId}/reports` : '/reports');

  const reportRequest = (): { path: string; params: Record<string, string>; fileName: string } => {
    const { month, year } = getMonthParts(monthKey);
    if (type === 'rent') return { path: `${basePath()}/monthly-rent`, params: { month: String(month), year: String(year) }, fileName: `monthly-rent-${monthKey}` };
    if (type === 'income') return { path: `${basePath()}/property-income`, params: { start, end }, fileName: `property-income-${start}-${end}` };
    if (type === 'utility') return { path: `${basePath()}/utility-bills`, params: { month: monthKey }, fileName: `utility-bills-${monthKey}` };
    if (type === 'maintenance') return { path: `${basePath()}/maintenance-expenses`, params: { start, end }, fileName: `maintenance-${start}-${end}` };
    return { path: `/properties/${propertyId}/reports/tenant/${tenantId}`, params: {}, fileName: `tenant-payments-${tenantId}` };
  };

  const run = async () => {
    if (type === 'tenant' && (!propertyId || !tenantId)) return;
    setLoading(true);
    try {
      const { path, params } = reportRequest();
      const response = await api.get(path, { params });
      setRows(response.data?.rows || []);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format: 'excel' | 'pdf') => {
    if (type === 'tenant' && (!propertyId || !tenantId)) return;
    setExportingFormat(format);
    try {
      const { path, params, fileName } = reportRequest();
      await downloadAndShareReport(path, params, `${fileName}.${format === 'excel' ? 'xlsx' : 'pdf'}`, format);
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <Screen title="Reports" subtitle={propertyId ? 'Preview, download, or share this report.' : 'No property selected — reports cover all properties.'}>
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
        onChange={(value) => setType(value as ReportType)}
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
          {!propertyId ? (
            <Text style={styles.meta}>Choose a property to pick a tenant.</Text>
          ) : (
            <View style={styles.stack}>
              {tenants.map((tenant) => (
                <Button key={tenant._id} label={tenant.fullName} variant={tenantId === tenant._id ? 'primary' : 'secondary'} onPress={() => setTenantId(tenant._id)} />
              ))}
            </View>
          )}
        </Card>
      ) : null}
      <View style={styles.actionRow}>
        <Button label={loading ? 'Loading...' : 'Preview'} variant="secondary" onPress={run} loading={loading} disabled={type === 'tenant' && (!propertyId || !tenantId)} />
        <Button label="Excel" onPress={() => exportReport('excel')} loading={exportingFormat === 'excel'} disabled={type === 'tenant' && (!propertyId || !tenantId)} />
        <Button label="PDF" onPress={() => exportReport('pdf')} loading={exportingFormat === 'pdf'} disabled={type === 'tenant' && (!propertyId || !tenantId)} />
      </View>
      <Card>
        <Text style={styles.sectionTitle}>Rows</Text>
        <View style={styles.stack}>
          {rows.length ? rows.slice(0, 20).map((row, index) => (
            <View key={index} style={styles.rowCard}>
              {Object.entries(row).map(([key, value]) => (
                <Text key={key} style={styles.meta}>{key}: {String(value)}</Text>
              ))}
            </View>
          )) : <Text style={styles.meta}>Run a preview to see rows here.</Text>}
        </View>
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  sectionTitle: { fontFamily: fonts.headingSemi, fontSize: 20, color: colors.text },
  stack: { gap: 10 },
  actionRow: { flexDirection: 'row', gap: 10 },
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
