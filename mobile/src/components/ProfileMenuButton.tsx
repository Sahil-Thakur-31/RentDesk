import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { usePortfolio } from '../context/PortfolioContext';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { colors, fonts } from '../lib/theme';

const ProfileMenuButton = () => {
  const navigation = useNavigation<any>();
  const { me } = usePortfolio();
  const { signOut } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const initials = useMemo(() => {
    const name = me?.fullName as string | undefined;
    if (!name) return 'RD';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [me]);

  const goTo = (screen: string) => {
    setOpen(false);
    navigation.navigate(screen);
  };

  return (
    <>
      <Pressable style={styles.avatar} onPress={() => setOpen(true)}>
        <Text style={styles.avatarText}>{initials}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menuWrap}>
            <View style={styles.menu}>
              <View style={styles.menuHeader}>
                <View style={styles.avatarLarge}>
                  <Text style={styles.avatarLargeText}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuName} numberOfLines={1}>{me?.fullName || 'RentDesk User'}</Text>
                  <Text style={styles.menuEmail} numberOfLines={1}>{me?.email || '-'}</Text>
                </View>
              </View>

              <Pressable style={styles.menuItem} onPress={() => goTo('Profile')}>
                <Ionicons name="person-circle-outline" size={20} color={colors.text} />
                <Text style={styles.menuItemLabel}>{t('Profile')}</Text>
              </Pressable>
              <Pressable style={styles.menuItem} onPress={() => goTo('Settings')}>
                <Ionicons name="settings-outline" size={20} color={colors.text} />
                <Text style={styles.menuItemLabel}>{t('Settings')}</Text>
              </Pressable>
              <View style={styles.menuDivider} />
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setOpen(false);
                  void signOut();
                }}
              >
                <Ionicons name="log-out-outline" size={20} color={colors.danger} />
                <Text style={[styles.menuItemLabel, { color: colors.danger }]}>{t('Sign Out')}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  avatar: {
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: { fontFamily: fonts.bodyBold, color: '#fff', fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.28)' },
  menuWrap: { position: 'absolute', top: 64, right: 20 },
  menu: {
    width: 240,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8
  },
  menuHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  avatarLarge: {
    height: 38,
    width: 38,
    borderRadius: 19,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarLargeText: { fontFamily: fonts.bodyBold, color: '#fff', fontSize: 14 },
  menuName: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  menuEmail: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 1 },
  menuDivider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  menuItemLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text }
});

export default ProfileMenuButton;
