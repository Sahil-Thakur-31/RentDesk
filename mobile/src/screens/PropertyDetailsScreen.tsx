import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import api from '../lib/api';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Pill from '../components/Pill';
import { colors, fonts } from '../lib/theme';
import { formatCurrency } from '../lib/format';
import { getCurrentMonthValue, getMonthParts } from '../lib/date';

const PropertyDetailsScreen = ({ route, navigation }: any) => {
  const { propertyId } = route.params;
  const [property, setProperty] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const { month, year } = getMonthParts(getCurrentMonthValue());

  useEffect(() => {
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
    void load();
  }, [month, propertyId, year]);

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
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }
});

export default PropertyDetailsScreen;

