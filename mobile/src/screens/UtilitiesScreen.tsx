import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Button from '../components/Button';
import PropertyFilter from '../components/PropertyFilter';
import MonthSwitcher from '../components/MonthSwitcher';
import { usePortfolio } from '../context/PortfolioContext';
import { colors, fonts } from '../lib/theme';
import { getCurrentMonthValue } from '../lib/date';

const UtilitiesScreen = ({ navigation }: any) => {
  const { properties } = usePortfolio();
  const [propertyId, setPropertyId] = useState('');
  const [monthKey, setMonthKey] = useState(getCurrentMonthValue());

  return (
    <Screen title="Utilities" subtitle="Open electricity readings for one property or the full portfolio.">
      <PropertyFilter properties={properties} value={propertyId} onChange={setPropertyId} />
      <MonthSwitcher value={monthKey} onChange={setMonthKey} />

      <Card>
        <Text style={styles.sectionTitle}>Electricity Readings</Text>
        <Text style={styles.meta}>
          {propertyId ? 'Working on the selected property.' : 'All Properties selected. You can enter readings across the whole portfolio.'}
        </Text>
        <View style={styles.buttonWrap}>
          <Button label="Open Electricity Reading" onPress={() => navigation.navigate('ElectricityReadings', { propertyId, monthKey })} />
        </View>
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  sectionTitle: { fontFamily: fonts.headingSemi, fontSize: 20, color: colors.text },
  meta: { fontFamily: fonts.body, color: colors.muted, marginTop: 4 },
  buttonWrap: { marginTop: 14 }
});

export default UtilitiesScreen;
