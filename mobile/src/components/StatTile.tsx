import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Card from './Card';
import { useI18n } from '../context/I18nContext';
import { colors, fonts } from '../lib/theme';

const StatTile = ({
  label,
  value,
  note,
  tone = 'default'
}: {
  label: string;
  value: string | number;
  note?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) => {
  const { t } = useI18n();

  return (
    <Card style={[styles.card, tone === 'success' && styles.success, tone === 'warning' && styles.warning, tone === 'danger' && styles.danger]}>
      <Text style={styles.label}>{t(label)}</Text>
      <Text style={[styles.value, tone === 'success' && styles.successText, tone === 'warning' && styles.warningText, tone === 'danger' && styles.dangerText]}>
        {value}
      </Text>
      {note ? <Text style={styles.note}>{t(note)}</Text> : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 140, gap: 8 },
  label: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 },
  value: { fontFamily: fonts.heading, fontSize: 22, color: colors.text },
  note: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  success: { borderTopWidth: 3, borderTopColor: '#22c55e' },
  warning: { borderTopWidth: 3, borderTopColor: '#f59e0b' },
  danger: { borderTopWidth: 3, borderTopColor: '#ef4444' },
  successText: { color: colors.success },
  warningText: { color: colors.warning },
  dangerText: { color: colors.danger }
});

export default StatTile;

