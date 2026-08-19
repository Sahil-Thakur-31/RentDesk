import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNotificationsFeed } from '../lib/notificationCenter';
import { useRealtimeStatus, disconnectRealtime } from '../lib/realtimeSocket';
import { invalidateAll } from '../lib/queryCache';
import { appStorage } from '../lib/appStorage';
import { useI18n } from '../lib/i18n';
import { BellIcon, CalendarIcon, ChevronDownIcon, LogoutIcon, SettingsIcon, UserIcon, WifiOffIcon } from './icons';

const notificationToneStyles: Record<string, string> = {
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  info: 'text-sky-600'
};

const notificationDotStyles: Record<string, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  info: 'bg-sky-500'
};

const TopBar = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const realtimeStatus = useRealtimeStatus();
  const { notifications } = useNotificationsFeed();

  const recentNotifications = useMemo(() => notifications.slice(0, 4), [notifications]);

  const initials = useMemo(() => {
    try {
      const snapshot = JSON.parse(appStorage.getItem('rentdesk_session_snapshot_v1') || 'null');
      const name = snapshot?.user?.fullName as string | undefined;
      if (!name) return 'RD';
      return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');
    } catch {
      return 'RD';
    }
  }, []);

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
    disconnectRealtime();
    invalidateAll();
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

  const syncLabel =
    realtimeStatus === 'connected'
      ? t('Online')
      : realtimeStatus === 'connecting'
        ? t('Connecting')
        : realtimeStatus === 'reconnecting'
          ? t('Reconnecting')
          : t('Offline');

  const unreadCount = notifications.length;

  return (
    <div className="relative z-40 mb-6 flex items-center justify-between gap-4">
      <div>
        <div className="text-2xl font-semibold tracking-tight">{title}</div>
        <div className="text-xs text-[var(--muted)]">{t('Welcome back — here is what needs your attention.')}</div>
      </div>

      <div className="flex items-center gap-2.5">
        <div
          className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold border ${
            realtimeStatus === 'offline'
              ? 'border-amber-200 bg-amber-50 text-amber-700'
              : realtimeStatus === 'connecting' || realtimeStatus === 'reconnecting'
                ? 'border-sky-200 bg-sky-50 text-sky-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {realtimeStatus === 'offline' ? (
            <WifiOffIcon width={13} height={13} />
          ) : (
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                realtimeStatus === 'connecting' || realtimeStatus === 'reconnecting' ? 'bg-sky-500 animate-pulse' : 'bg-emerald-500'
              }`}
            />
          )}
          {syncLabel}
        </div>

        <button className="icon-btn" onClick={() => navigate('/calendar')} aria-label={t('Calendar')} title={t('Calendar')}>
          <CalendarIcon />
        </button>

        <div className="relative" ref={notificationsRef}>
          <button
            className="icon-btn relative"
            onClick={() => setShowNotifications((prev) => !prev)}
            aria-label={t('Notifications')}
            title={t('Notifications')}
          >
            <BellIcon />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <div className="card absolute right-0 z-50 mt-2 w-80 p-4 shadow-[var(--shadow-lg)]">
              <div className="text-sm font-semibold mb-3">{t('Recent updates')}</div>
              <div className="space-y-3">
                {recentNotifications.length ? (
                  recentNotifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="block w-full rounded-xl p-2 -mx-2 text-left text-sm hover:bg-[var(--surface-1)]"
                      onClick={() => {
                        setShowNotifications(false);
                        if (item.path) navigate(item.path);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${notificationDotStyles[item.tone]}`} />
                        <div className="flex-1 flex items-center justify-between gap-2">
                          <div className={`font-medium ${notificationToneStyles[item.tone]}`}>{item.title}</div>
                          <div className="shrink-0 text-xs text-[var(--muted)]">{item.time}</div>
                        </div>
                      </div>
                      <div className="ml-3.5 text-xs text-[var(--muted)]">{item.description}</div>
                    </button>
                  ))
                ) : (
                  <div className="text-sm text-[var(--muted)]">{t('Nothing new right now.')}</div>
                )}
              </div>
              <button
                className="mt-4 text-sm font-medium text-[var(--accent)]"
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
            className="flex items-center gap-2 rounded-full border border-black/10 bg-white py-1 pl-1 pr-2.5 hover:bg-[var(--surface-1)]"
            onClick={() => setShowProfile((prev) => !prev)}
            aria-label={t('Profile')}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-xs font-semibold text-white">
              {initials}
            </span>
            <ChevronDownIcon width={14} height={14} className="text-[var(--muted)]" />
          </button>
          {showProfile && (
            <div className="card absolute right-0 z-50 mt-2 w-56 p-2 shadow-[var(--shadow-lg)]">
              <button
                className="flex w-full items-center gap-2.5 text-left px-3 py-2.5 rounded-xl text-sm hover:bg-[var(--surface-1)]"
                onClick={() => {
                  setShowProfile(false);
                  navigate('/profile');
                }}
              >
                <UserIcon width={16} height={16} className="text-[var(--muted)]" />
                {t('Portfolio Profile')}
              </button>
              <button
                className="flex w-full items-center gap-2.5 text-left px-3 py-2.5 rounded-xl text-sm hover:bg-[var(--surface-1)]"
                onClick={() => {
                  setShowProfile(false);
                  navigate('/settings');
                }}
              >
                <SettingsIcon width={16} height={16} className="text-[var(--muted)]" />
                {t('Settings')}
              </button>
              <div className="my-1.5 h-px bg-black/5" />
              <button
                className="flex w-full items-center gap-2.5 text-left px-3 py-2.5 rounded-xl text-sm text-red-600 hover:bg-red-50"
                onClick={logout}
              >
                <LogoutIcon width={16} height={16} />
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
