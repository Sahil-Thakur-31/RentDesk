import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useI18n } from '../context/I18nContext';
import { colors, fonts } from '../lib/theme';

const PropertyFilter = ({
  properties,
  value,
  onChange
}: {
  properties: any[];
  value: string;
  onChange: (value: string) => void;
}) => {
  const { t } = useI18n();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Pressable onPress={() => onChange('')} style={[styles.chip, value === '' && styles.active]}>
        <Text style={[styles.label, value === '' && styles.activeLabel]}>{t('All Properties')}</Text>
      </Pressable>
      {properties.map((property) => {
        const active = value === property._id;
        return (
          <Pressable key={property._id} onPress={() => onChange(property._id)} style={[styles.chip, active && styles.active]}>
            <Text style={[styles.label, active && styles.activeLabel]}>{property.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row: { gap: 8 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border
  },
  active: {
    backgroundColor: colors.accentSoft,
    borderColor: '#9ee9dc'
  },
  label: { fontFamily: fonts.bodyBold, color: colors.text },
  activeLabel: { color: colors.accent }
});

export default PropertyFilter;
