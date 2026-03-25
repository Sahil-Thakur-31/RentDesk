import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Button from '../components/Button';
import { usePortfolio } from '../context/PortfolioContext';
import { useAuth } from '../context/AuthContext';
import { LANGUAGE_OPTIONS, useI18n } from '../context/I18nContext';
import { colors, fonts } from '../lib/theme';
import { useState } from 'react';

const SettingsScreen = () => {
  const { t, language, setLanguage } = useI18n();
  const { me, portfolio, membership } = usePortfolio();
  const { signOut } = useAuth();
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const selectedLanguage = LANGUAGE_OPTIONS.find((option) => option.value === language);

  return (
    <Screen title="Settings">
      <Card>
        <Text style={styles.sectionTitle}>{t('Account')}</Text>
        <Text style={styles.value}>{me?.fullName || 'RentDesk User'}</Text>
        <Text style={styles.meta}>{me?.email || '-'}</Text>
        <Text style={styles.meta}>{portfolio?.name || t('No portfolio yet')}</Text>
        <Text style={styles.meta}>{`${t('Access')}: ${membership?.role || me?.role || '-'}`}</Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t('Language')}</Text>
        <Pressable style={styles.selector} onPress={() => setShowLanguagePicker(true)}>
          <Text style={styles.selectorValue}>{selectedLanguage?.label || 'English'}</Text>
          <Text style={styles.selectorHint}>Change</Text>
        </Pressable>
        <Text style={styles.meta}>UI text, dates, and month labels use this language. Cached translations update automatically as screens load.</Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t('Device')}</Text>
        <Text style={styles.meta}>API: {process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api'}</Text>
      </Card>

      <Button label="Sign Out" variant="danger" onPress={() => signOut()} />

      <Modal visible={showLanguagePicker} transparent animationType="fade" onRequestClose={() => setShowLanguagePicker(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>{t('Language')}</Text>
            <View style={styles.optionList}>
              {LANGUAGE_OPTIONS.map((option) => {
                const active = option.value === language;
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    onPress={() => {
                      void setLanguage(option.value);
                      setShowLanguagePicker(false);
                    }}
                  >
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Button label="Close" variant="secondary" onPress={() => setShowLanguagePicker(false)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  sectionTitle: { fontFamily: fonts.headingSemi, fontSize: 20, color: colors.text, marginBottom: 12 },
  value: { fontFamily: fonts.headingSemi, fontSize: 20, color: colors.text },
  meta: { fontFamily: fonts.body, color: colors.muted, marginTop: 6 },
  selector: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  selectorValue: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text, flex: 1 },
  selectorHint: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accent },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    backgroundColor: colors.card,
    padding: 20,
    gap: 14
  },
  optionList: { maxHeight: 360, gap: 8 },
  optionRow: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surface
  },
  optionRowActive: {
    borderColor: '#9ee9dc',
    backgroundColor: colors.accentSoft
  },
  optionLabel: { fontFamily: fonts.bodyBold, color: colors.text },
  optionLabelActive: { color: colors.accent }
});

export default SettingsScreen;
