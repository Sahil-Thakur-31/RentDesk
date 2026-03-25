import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNotificationsFeed } from '../lib/notificationCenter';
import { useSyncStatus } from '../lib/offlineSync';
import { appStorage } from '../lib/appStorage';
import { useI18n } from '../lib/i18n';

const notificationToneStyles: Record<string, string> = {
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  info: 'text-sky-600'
};

const TopBar = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const syncStatus = useSyncStatus();
  const { notifications } = useNotificationsFeed();

  const recentNotifications = useMemo(() => notifications.slice(0, 4), [notifications]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setShowProfile(false);
      }
    };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  const logout = () => {
    appStorage.removeItem('rentdesk_token');
    appStorage.removeItem('rentdesk_active_portfolio_id');
    navigate('/login');
  };

  const titleMap: Record<string, string> = {
    '/': 'Dashboard',
    '/properties': 'Properties',
    '/units': 'Units',
    '/tenants': 'Tenants',
    '/rent-records': 'Rent Records',
    '/utility-bills': 'Utility Bills',
    '/maintenance': 'Maintenance',
    '/reports': 'Reports',
    '/transactions': 'Transactions',
    '/utilities': 'Utilities',
    '/utilities/electricity-readings': 'Electricity Readings',
    '/notifications': 'Notifications',
    '/settings': 'Settings',
    '/profile': 'Profile',
    '/calendar': 'Calendar'
  };

  const title = location.pathname.includes('/tenants/') && location.pathname.startsWith('/properties/')
    ? t('Tenant Details')
    : location.pathname.includes('/units/') && location.pathname.startsWith('/properties/')
      ? t('Unit Details')
      : location.pathname.startsWith('/properties/')
        ? t('Property Details')
        : t(titleMap[location.pathname] || 'RentDesk');

  const syncLabel = !syncStatus.isOnline
    ? `${t('Offline')}${syncStatus.pendingCount ? ` - ${syncStatus.pendingCount} ${t('queued')}` : ''}`
    : syncStatus.isSyncing
      ? `${t('Syncing')}${syncStatus.pendingCount ? ` - ${syncStatus.pendingCount} ${t('queued')}` : ''}`
      : syncStatus.pendingCount > 0
        ? `${syncStatus.pendingCount} ${t('queued')}`
        : t('Online');

  return (
    <div className="relative z-40 mb-6 flex items-center justify-between gap-4">
      <div className="text-2xl font-semibold">{title}</div>

      <div className="flex items-center gap-3">
        <div
          className={`rounded-full px-3 py-2 text-xs font-medium border ${
            !syncStatus.isOnline
              ? 'border-amber-200 bg-amber-50 text-amber-700'
              : syncStatus.isSyncing
                ? 'border-sky-200 bg-sky-50 text-sky-700'
                : syncStatus.pendingCount > 0
                  ? 'border-violet-200 bg-violet-50 text-violet-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {syncLabel}
        </div>

        <button
          className="px-3 py-2 rounded-xl border border-black/10 bg-white text-sm hover:bg-black/5"
          onClick={() => navigate('/calendar')}
        >
          {t('Calendar')}
        </button>

        <div className="relative" ref={notificationsRef}>
          <button
            className="px-3 py-2 rounded-xl border border-black/10 bg-white text-sm hover:bg-black/5"
            onClick={() => setShowNotifications((prev) => !prev)}
          >
            {t('Notifications')}
          </button>
          {showNotifications && (
            <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-black/10 bg-white shadow-[0_24px_50px_rgba(15,23,42,0.18)] p-4">
              <div className="text-sm font-semibold mb-3">{t('Recent updates')}</div>
              <div className="space-y-3">
                {recentNotifications.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="block w-full text-left text-sm"
                    onClick={() => {
                      setShowNotifications(false);
                      if (item.path) navigate(item.path);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`font-medium ${notificationToneStyles[item.tone]}`}>{item.title}</div>
                      <div className="text-xs text-[var(--muted)]">{item.time}</div>
                    </div>
                    <div className="text-xs text-[var(--muted)]">{item.description}</div>
                  </button>
                ))}
              </div>
              <button
                className="mt-4 text-sm text-[var(--accent)]"
                onClick={() => {
                  setShowNotifications(false);
                  navigate('/notifications');
                }}
              >
                {t('View more')}
              </button>
            </div>
          )}
        </div>

        <div className="relative" ref={profileRef}>
          <button
            className="px-3 py-2 rounded-xl border border-black/10 bg-white text-sm hover:bg-black/5"
            onClick={() => setShowProfile((prev) => !prev)}
          >
            {t('Profile')}
          </button>
          {showProfile && (
            <div className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-black/10 bg-white shadow-[0_24px_50px_rgba(15,23,42,0.18)] p-3">
              <button
                className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-black/5"
                onClick={() => {
                  setShowProfile(false);
                  navigate('/profile');
                }}
              >
                {t('Portfolio Profile')}
              </button>
              <button
                className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-black/5"
                onClick={() => {
                  setShowProfile(false);
                  navigate('/settings');
                }}
              >
                {t('Settings')}
              </button>
              <button
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
                onClick={logout}
              >
                {t('Logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopBar;
