import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../context/I18nContext';
import { colors, fonts } from '../lib/theme';

const Pill = ({ label, tone = 'default' }: { label: string; tone?: 'default' | 'success' | 'warning' | 'danger' }) => {
  const { t } = useI18n();

  return (
    <View
      style={[
        styles.base,
        tone === 'success' && styles.success,
        tone === 'warning' && styles.warning,
        tone === 'danger' && styles.danger
      ]}
    >
      <Text
        style={[
          styles.text,
          tone === 'success' && styles.successText,
          tone === 'warning' && styles.warningText,
          tone === 'danger' && styles.dangerText
        ]}
      >
        {t(label)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  success: { backgroundColor: '#ecfdf5', borderColor: '#bbf7d0' },
  warning: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  danger: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  text: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.text },
  successText: { color: colors.success },
  warningText: { color: colors.warning },
  dangerText: { color: colors.danger }
});

export default Pill;
