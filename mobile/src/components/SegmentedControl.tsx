import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useI18n } from '../context/I18nContext';
import { colors, fonts, radius } from '../lib/theme';

const SegmentedControl = <T extends string>({
  options,
  value,
  onChange
}: {
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
}) => {
  const { t } = useI18n();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wrap}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.item, active && styles.active]}
          >
            <Text style={[styles.label, active && styles.activeLabel]}>{t(option.label)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  item: {
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border
  },
  active: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  label: {
    fontFamily: fonts.bodyBold,
    color: colors.muted
  },
  activeLabel: {
    color: '#fff'
  }
});

export default SegmentedControl;
