import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../lib/theme';

interface StatCardProps {
  label: string;
  value: string | number;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}

const toneMap = {
  default: colors.accent,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger
};

const StatCard = ({ label, value, tone = 'default' }: StatCardProps) => {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: toneMap[tone] }]}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted
  },
  value: {
    fontFamily: fonts.heading,
    fontSize: 20,
    marginTop: 6
  }
});

export default StatCard;
