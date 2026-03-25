import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import api from '../lib/api';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Button from '../components/Button';
import MonthSwitcher from '../components/MonthSwitcher';
import PropertyFilter from '../components/PropertyFilter';
import { colors, fonts } from '../lib/theme';
import { formatCurrency } from '../lib/format';
import { usePortfolio } from '../context/PortfolioContext';

const ElectricityReadingsScreen = ({ route }: any) => {
  const { properties } = usePortfolio();
  const [propertyId, setPropertyId] = useState(route.params?.propertyId || '');
  const [monthKey, setMonthKey] = useState(route.params?.monthKey || '');
  const [rows, setRows] = useState<any[]>([]);
  const [ratesByProperty, setRatesByProperty] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const sourceProperties = useMemo(
    () => (propertyId ? properties.filter((property) => property._id === propertyId) : properties),
    [properties, propertyId]
  );

  const load = async () => {
    setError('');
    try {
      const responses = await Promise.all(
        sourceProperties.map(async (property) => {
          const response = await api.get(`/properties/${property._id}/utility-bills/electricity-readings`, {
            params: { month: monthKey }
          });
          return {
            property,
            rates: response.data?.rates || null,
            rows: (response.data?.rows || []).map((row: any) => ({
              ...row,
              propertyId: property._id,
              propertyName: property.name,
              inputReading: row.currentReading != null ? String(row.currentReading) : ''
            }))
          };
        })
      );

      const nextRates: Record<string, any> = {};
      responses.forEach(({ property, rates }) => {
        nextRates[property._id] = rates;
      });

      setRatesByProperty(nextRates);
      setRows(responses.flatMap((entry) => entry.rows));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to load electricity readings.');
      setRows([]);
      setRatesByProperty({});
    }
  };

  useEffect(() => {
    if (!monthKey || !sourceProperties.length) {
      setRows([]);
      return;
    }
    void load();
  }, [monthKey, sourceProperties]);

  const preparedRows = useMemo(
    () =>
      rows.map((row) => {
        const propertyRates = ratesByProperty[row.propertyId] || {};
        const currentReading = Number(row.inputReading || 0);
        const unitsUsed = row.inputReading ? Math.max(0, currentReading - Number(row.lastReading || 0)) : row.calculatedUnits || 0;
        const amount = row.inputReading
          ? Math.floor(unitsUsed * Number(propertyRates.electricityUnitRate || 0) + Number(propertyRates.commonElectricityCharge || 0))
          : row.calculatedAmount || 0;
        return { ...row, unitsUsed, amount };
      }),
    [ratesByProperty, rows]
  );

  const save = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const payloadByProperty = preparedRows.reduce<Record<string, Array<{ unitId: string; currentReading: number }>>>(
        (acc, row) => {
          if (!row.inputReading) return acc;
          if (!acc[row.propertyId]) acc[row.propertyId] = [];
          acc[row.propertyId].push({ unitId: row.unitId, currentReading: Number(row.inputReading) });
          return acc;
        },
        {}
      );

      await Promise.all(
        Object.entries(payloadByProperty).map(([entryPropertyId, readings]) =>
          api.post(`/properties/${entryPropertyId}/utility-bills/electricity-readings`, {
            month: monthKey,
            readings
          })
        )
      );

      setMessage('Readings saved.');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to save readings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="Electricity" subtitle="Enter meter readings month by month.">
      <PropertyFilter properties={properties} value={propertyId} onChange={setPropertyId} />
      <MonthSwitcher value={monthKey} onChange={setMonthKey} />

      {sourceProperties.map((property) => {
        const rates = ratesByProperty[property._id];
        if (!rates) return null;
        return (
          <Card key={property._id}>
            <Text style={styles.propertyTitle}>{property.name}</Text>
            <Text style={styles.meta}>Rate {formatCurrency(rates.electricityUnitRate)} per unit</Text>
            <Text style={styles.meta}>Common charge {formatCurrency(rates.commonElectricityCharge)}</Text>
          </Card>
        );
      })}

      {(message || error) ? (
        <Card style={error ? styles.errorCard : styles.successCard}>
          <Text style={error ? styles.errorText : styles.successText}>{error || message}</Text>
        </Card>
      ) : null}

      {preparedRows.map((row) => (
        <Card key={`${row.propertyId}-${row.unitId}`}>
          {!propertyId ? <Text style={styles.propertyTag}>{row.propertyName}</Text> : null}
          <Text style={styles.unitTitle}>{row.unitNumber}</Text>
          <Text style={styles.meta}>Last reading {row.lastReading}</Text>
          <TextInput
            style={styles.input}
            value={row.inputReading}
            onChangeText={(value) =>
              setRows((current) =>
                current.map((entry) =>
                  entry.unitId === row.unitId && entry.propertyId === row.propertyId
                    ? { ...entry, inputReading: value.replace(/[^0-9]/g, '') }
                    : entry
                )
              )
            }
            keyboardType="number-pad"
            placeholder="Current reading"
          />
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.label}>Units used</Text>
              <Text style={styles.summaryValue}>{row.unitsUsed}</Text>
            </View>
            <View>
              <Text style={styles.label}>Amount</Text>
              <Text style={styles.summaryValue}>{formatCurrency(row.amount)}</Text>
            </View>
          </View>
        </Card>
      ))}

      <Button label="Save Readings" onPress={save} loading={saving} disabled={!preparedRows.length} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  propertyTitle: { fontFamily: fonts.headingSemi, fontSize: 18, color: colors.text },
  propertyTag: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accent, marginBottom: 6 },
  meta: { fontFamily: fonts.body, color: colors.muted },
  unitTitle: { fontFamily: fonts.headingSemi, fontSize: 20, color: colors.text },
  input: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.body,
    color: colors.text,
    backgroundColor: '#fff'
  },
  summaryRow: { flexDirection: 'row', gap: 20, marginTop: 12 },
  label: { fontFamily: fonts.body, color: colors.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  summaryValue: { fontFamily: fonts.headingSemi, fontSize: 18, color: colors.text, marginTop: 4 },
  successCard: { borderColor: '#bbf7d0', backgroundColor: '#ecfdf5' },
  errorCard: { borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  successText: { fontFamily: fonts.bodyBold, color: colors.success },
  errorText: { fontFamily: fonts.bodyBold, color: colors.danger }
});

export default ElectricityReadingsScreen;
