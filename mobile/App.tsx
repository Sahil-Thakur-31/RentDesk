import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Manrope_400Regular, Manrope_600SemiBold } from '@expo-google-fonts/manrope';
import { Ionicons } from '@expo/vector-icons';
import DashboardScreen from './src/screens/DashboardScreen';
import PortfolioScreen from './src/screens/PortfolioScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import UtilitiesScreen from './src/screens/UtilitiesScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PropertyDetailsScreen from './src/screens/PropertyDetailsScreen';
import UnitDetailsScreen from './src/screens/UnitDetailsScreen';
import TenantDetailsScreen from './src/screens/TenantDetailsScreen';
import ElectricityReadingsScreen from './src/screens/ElectricityReadingsScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AuthScreen from './src/screens/AuthScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PortfolioProvider } from './src/context/PortfolioContext';
import { colors, fonts } from './src/lib/theme';
import { I18nProvider, useI18n } from './src/context/I18nContext';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const MainTabs = () => {
  const { t } = useI18n();

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, height: 72, paddingBottom: 10, paddingTop: 10 },
      tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 12 },
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.muted,
      tabBarIcon: ({ color, size }) => {
        const iconName =
          route.name === 'DashboardTab'
            ? 'home-outline'
            : route.name === 'PortfolioTab'
              ? 'business-outline'
              : route.name === 'TransactionsTab'
                ? 'swap-horizontal-outline'
                : route.name === 'UtilitiesTab'
                  ? 'flash-outline'
                  : 'person-circle-outline';
        return <Ionicons name={iconName as any} size={size} color={color} />;
      }
      })}
    >
      <Tabs.Screen name="DashboardTab" component={DashboardScreen} options={{ title: t('Dashboard') }} />
      <Tabs.Screen name="PortfolioTab" component={PortfolioScreen} options={{ title: t('Portfolio') }} />
      <Tabs.Screen name="TransactionsTab" component={TransactionsScreen} options={{ title: t('Transactions') }} />
      <Tabs.Screen name="UtilitiesTab" component={UtilitiesScreen} options={{ title: t('Utilities') }} />
      <Tabs.Screen name="ProfileTab" component={ProfileScreen} options={{ title: t('Profile') }} />
    </Tabs.Navigator>
  );
};

const RootNavigator = () => {
  const { token, ready } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <PortfolioProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {token ? (
            <>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen name="PropertyDetails" component={PropertyDetailsScreen} />
              <Stack.Screen name="UnitDetails" component={UnitDetailsScreen} />
              <Stack.Screen name="TenantDetails" component={TenantDetailsScreen} />
              <Stack.Screen name="ElectricityReadings" component={ElectricityReadingsScreen} />
              <Stack.Screen name="Reports" component={ReportsScreen} />
              <Stack.Screen name="Calendar" component={CalendarScreen} />
              <Stack.Screen name="Notifications" component={NotificationsScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
            </>
          ) : (
            <Stack.Screen name="Auth" component={AuthScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </PortfolioProvider>
  );
};

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Manrope_400Regular,
    Manrope_600SemiBold
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

