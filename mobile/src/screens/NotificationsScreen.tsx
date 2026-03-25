import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import api from '../lib/api';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Pill from '../components/Pill';
import { usePortfolio } from '../context/PortfolioContext';
import { colors, fonts } from '../lib/theme';
import { getCurrentMonthValue, getMonthParts } from '../lib/date';

const NotificationsScreen = () => {
  const { properties, portfolio, membership } = usePortfolio();
  const [items, setItems] = useState<Array<{ title: string; body: string; tone: 'default' | 'success' | 'warning' | 'danger' }>>([]);
  const [loading, setLoading] = useState(true);
  const monthKey = getCurrentMonthValue();
  const { month, year } = getMonthParts(monthKey);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const dashboardRes = await api.get('/dashboard', { params: { month, year } });
        const next: Array<{ title: string; body: string; tone: 'default' | 'success' | 'warning' | 'danger' }> = [];
        (dashboardRes.data?.lists?.pendingRentTenants || []).slice(0, 5).forEach((item: any) => {
          next.push({
            title: 'Pending rent',
            body: `${item.tenantId?.fullName || 'Tenant'} still has rent pending for ${monthKey}.`,
            tone: 'warning'
          });
        });

        if ((portfolio?.joinRequests || []).length && (membership?.role === 'owner' || membership?.role === 'warden')) {
          next.push({
            title: 'Join requests',
            body: `${portfolio.joinRequests.length} request(s) need approval.`,
            tone: 'default'
          });
        }

        if (!next.length && properties.length) {
          next.push({
            title: 'All caught up',
            body: 'No urgent notifications right now.',
            tone: 'success'
          });
        }

        setItems(next);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [membership?.role, month, monthKey, portfolio?.joinRequests, properties.length, year]);

  return (
    <Screen title="Notifications" subtitle="Recent items that need attention.">
      <View style={styles.stack}>
        {items.length ? items.map((item, index) => (
          <Card key={`${item.title}-${index}`}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
              </View>
              <Pill label={item.tone === 'success' ? 'Done' : item.tone === 'warning' ? 'Pending' : 'Info'} tone={item.tone} />
            </View>
          </Card>
        )) : <Card><Text style={styles.body}>{loading ? 'Loading notifications...' : 'No notifications yet.'}</Text></Card>}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  stack: { gap: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  title: { fontFamily: fonts.headingSemi, fontSize: 18, color: colors.text },
  body: { fontFamily: fonts.body, color: colors.muted, marginTop: 6 }
});

export default NotificationsScreen;

