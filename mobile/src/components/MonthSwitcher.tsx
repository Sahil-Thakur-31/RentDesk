import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Button from './Button';
import { colors, fonts } from '../lib/theme';
import { formatMonthKey } from '../lib/date';

const MonthSwitcher = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
  const shift = (offset: number) => {
    const [year, month] = value.split('-').map(Number);
    const next = new Date(year, (month || 1) - 1 + offset, 1);
    onChange(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <View style={styles.row}>
      <Button label="<" onPress={() => shift(-1)} variant="secondary" small />
      <View style={styles.labelWrap}>
        <Text style={styles.label}>{formatMonthKey(value)}</Text>
      </View>
      <Button label=">" onPress={() => shift(1)} variant="secondary" small />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  labelWrap: {
    flex: 1,
    minHeight: 38,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 14
  },
  label: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    textAlign: 'center'
  }
});

export default MonthSwitcher;

