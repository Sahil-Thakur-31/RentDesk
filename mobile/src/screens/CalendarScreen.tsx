import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import api from '../lib/api';
import Screen from '../components/Screen';
import Card from '../components/Card';
import PropertyFilter from '../components/PropertyFilter';
import MonthSwitcher from '../components/MonthSwitcher';
import { usePortfolio } from '../context/PortfolioContext';
import { colors, fonts } from '../lib/theme';
import { formatMonthKey, getCurrentMonthValue, getMonthParts } from '../lib/date';

const buildCalendarCells = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = (first.getDay() + 6) % 7;
  const cells = [] as Array<number | null>;
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

const CalendarScreen = () => {
  const { properties } = usePortfolio();
  const [propertyId, setPropertyId] = useState('');
  const [monthKey, setMonthKey] = useState(getCurrentMonthValue());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [events, setEvents] = useState<Record<number, string[]>>({});
  const { month, year } = getMonthParts(monthKey);

  useEffect(() => {
    const load = async () => {
      const monthStart = new Date(year, month - 1, 1).toISOString();
      const monthEnd = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
      const sourceProperties = propertyId ? properties.filter((property) => property._id === propertyId) : properties;
      const entries = await Promise.all(
        sourceProperties.map(async (property) => {
          const [paymentRes, rentRes, utilityRes] = await Promise.all([
            api.get(`/properties/${property._id}/payments`, { params: { startDate: monthStart, endDate: monthEnd } }),
            api.get(`/properties/${property._id}/rent-records`, { params: { month, year, status: 'unpaid,partial' } }),
            api.get(`/properties/${property._id}/utility-bills`, { params: { month: monthKey, status: 'unpaid' } })
          ]);
          return { property, payments: paymentRes.data || [], rents: rentRes.data || [], bills: utilityRes.data || [] };
        })
      );

      const nextEvents: Record<number, string[]> = {};
      entries.forEach(({ property, payments, rents, bills }) => {
        payments.forEach((payment: any) => {
          const day = new Date(payment.date).getDate();
          nextEvents[day] = [...(nextEvents[day] || []), `${property.name}: ${payment.type} payment`];
        });
        rents.forEach((rent: any) => {
          nextEvents[5] = [...(nextEvents[5] || []), `${property.name}: pending rent for ${rent.tenantId?.fullName || 'tenant'}`];
        });
        bills.forEach((bill: any) => {
          nextEvents[1] = [...(nextEvents[1] || []), `${property.name}: unpaid ${bill.billType} bill for ${bill.unitId?.unitNumber || 'unit'}`];
        });
      });
      setEvents(nextEvents);
    };

    void load();
  }, [month, monthKey, properties, propertyId, year]);

  const cells = useMemo(() => buildCalendarCells(monthKey), [monthKey]);

  return (
    <Screen title="Calendar" subtitle={formatMonthKey(monthKey)}>
      <PropertyFilter properties={properties} value={propertyId} onChange={setPropertyId} />
      <MonthSwitcher value={monthKey} onChange={setMonthKey} />

      <Card>
        <View style={styles.weekdays}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <Text key={day} style={styles.weekday}>{day}</Text>
          ))}
        </View>
        <View style={styles.grid}>
          {cells.map((day, index) => {
            const active = day === selectedDay;
            const hasEvents = day != null && (events[day] || []).length > 0;
            return (
              <Pressable key={`${day}-${index}`} style={[styles.cell, active && styles.cellActive]} onPress={() => day && setSelectedDay(day)}>
                <Text style={[styles.cellText, active && styles.cellTextActive, day == null && { opacity: 0 }]}>{day || 0}</Text>
                {hasEvents ? <View style={styles.dot} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Agenda for {selectedDay} {formatMonthKey(monthKey)}</Text>
        {(events[selectedDay] || []).length ? (
          <View style={styles.agendaList}>
            {events[selectedDay].map((event, index) => (
              <View key={`${event}-${index}`} style={styles.agendaItem}>
                <Text style={styles.agendaText}>{event}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.agendaText}>No events on this day.</Text>
        )}
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  weekdays: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  weekday: { width: '14.28%', textAlign: 'center', fontFamily: fonts.bodyBold, color: colors.muted, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    marginBottom: 6,
    position: 'relative'
  },
  cellActive: { backgroundColor: colors.accentSoft },
  cellText: { fontFamily: fonts.bodyBold, color: colors.text },
  cellTextActive: { color: colors.accent },
  dot: {
    position: 'absolute',
    bottom: 12,
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.accent
  },
  sectionTitle: { fontFamily: fonts.headingSemi, fontSize: 20, color: colors.text, marginBottom: 12 },
  agendaList: { gap: 10 },
  agendaItem: { borderRadius: 16, backgroundColor: colors.surface, padding: 12 },
  agendaText: { fontFamily: fonts.body, color: colors.muted }
});

export default CalendarScreen;

