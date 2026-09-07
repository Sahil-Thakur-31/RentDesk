import { Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Button from '../components/Button';
import { usePortfolio } from '../context/PortfolioContext';
import { useNotificationsFeed } from '../lib/notificationCenter';
import { colors, fonts } from '../lib/theme';

const TONE_DOT: Record<string, string> = {
  success: colors.success,
  warning: colors.warning,
  info: colors.accent
};

const NotificationsScreen = () => {
  const { properties, portfolio } = usePortfolio();
  const { notifications, loading, unreadCount, markRead, markAllRead } = useNotificationsFeed(properties, portfolio);

  return (
    <Screen
      title="Notifications"
      subtitle={unreadCount ? `${unreadCount} unread` : 'You are all caught up.'}
      right={unreadCount ? <Button label="Mark all read" variant="secondary" small onPress={markAllRead} /> : undefined}
    >
      <View style={styles.stack}>
        {notifications.length ? (
          notifications.map((item) => (
            <Pressable key={item.id} onPress={() => markRead(item.id)}>
              <Card style={item.read ? styles.readCard : undefined}>
                <View style={styles.row}>
                  {!item.read ? <View style={[styles.dot, { backgroundColor: TONE_DOT[item.tone] || colors.accent }]} /> : null}
                  <View style={{ flex: 1 }}>
                    <Text style={item.read ? styles.readTitle : [styles.title, { color: TONE_DOT[item.tone] || colors.text }]}>{item.title}</Text>
                    <Text style={styles.body}>{item.description}</Text>
                    <Text style={styles.time}>{item.time}</Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          ))
        ) : (
          <Card><Text style={styles.body}>{loading ? 'Loading notifications...' : 'No notifications yet.'}</Text></Card>
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  stack: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  title: { fontFamily: fonts.headingSemi, fontSize: 16 },
  readTitle: { fontFamily: fonts.body, fontSize: 16, color: colors.muted },
  readCard: { backgroundColor: colors.background, borderColor: colors.border },
  body: { fontFamily: fonts.body, color: colors.muted, marginTop: 4 },
  time: { fontFamily: fonts.body, color: colors.muted, marginTop: 4, fontSize: 12 }
});

export default NotificationsScreen;
