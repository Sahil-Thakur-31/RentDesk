import React from 'react';
import { ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../context/I18nContext';
import { colors, fonts } from '../lib/theme';

const Screen = ({
  title,
  subtitle,
  right,
  children,
  contentStyle
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  contentStyle?: ViewStyle;
}) => {
  const { t } = useI18n();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, contentStyle]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{t(title)}</Text>
          </View>
          {right}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12
  },
  headerText: { flex: 1 },
  title: { fontFamily: fonts.heading, fontSize: 30, color: colors.text }
});

export default Screen;
