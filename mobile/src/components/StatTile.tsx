import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import { useI18n } from '../context/I18nContext';
import { colors, fonts } from '../lib/theme';

type Tone = 'default' | 'success' | 'warning' | 'danger';

const toneColor: Record<Tone, string> = {
  default: colors.accent,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger
};

const toneSoftBg: Record<Tone, string> = {
  default: colors.accentSoft,
  success: '#ecfdf5',
  warning: '#fffbeb',
  danger: '#fef2f2'
};

const StatTile = ({
  label,
  value,
  note,
  tone = 'default',
  icon,
  fullWidth
}: {
  label: string;
  value: string | number;
  note?: string;
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
}) => {
  const { t } = useI18n();
  const barColor = toneColor[tone];

  return (
    <Card style={[styles.card, fullWidth && styles.cardFullWidth]}>
      <View style={[styles.bar, { backgroundColor: barColor }]} />
      <View style={styles.row}>
        <Text style={styles.label} numberOfLines={1}>{t(label)}</Text>
        {icon ? (
          <View style={[styles.iconBadge, { backgroundColor: toneSoftBg[tone] }]}>
            <Ionicons name={icon} size={15} color={barColor} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.value, { color: barColor }]} numberOfLines={1}>{value}</Text>
      {note ? <Text style={styles.note} numberOfLines={1}>{t(note)}</Text> : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 150, gap: 6, paddingTop: 14, overflow: 'hidden' },
  cardFullWidth: { flexBasis: '100%', flexGrow: 0 },
  bar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  iconBadge: { height: 26, width: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.muted }
});

export default StatTile;
