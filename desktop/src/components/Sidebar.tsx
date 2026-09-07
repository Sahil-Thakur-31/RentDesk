import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import { appStorage } from '../lib/appStorage';
import {
  DashboardIcon,
  BuildingIcon,
  UnitsIcon,
  TenantsIcon,
  TransactionsIcon,
  UtilitiesIcon,
  ReportsIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from './icons';

const navItems = [
  { label: 'Dashboard', path: '/', icon: DashboardIcon },
  { label: 'Properties', path: '/properties', icon: BuildingIcon },
  { label: 'Units', path: '/units', icon: UnitsIcon },
  { label: 'Tenants', path: '/tenants', icon: TenantsIcon },
  { label: 'Transactions', path: '/transactions', icon: TransactionsIcon },
  { label: 'Utilities', path: '/utilities', icon: UtilitiesIcon },
  { label: 'Reports', path: '/reports', icon: ReportsIcon }
];

const SIDEBAR_COLLAPSED_KEY = 'rentdesk_sidebar_collapsed';

const Sidebar = () => {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(() => appStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      appStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      return next;
    });
  };

  return (
    <aside
      className={`relative shrink-0 h-screen overflow-y-auto overflow-x-hidden bg-white/90 backdrop-blur border-r border-black/5 py-8 shadow-[0_20px_50px_rgba(15,23,42,0.08)] transition-[width] duration-200 ${
        collapsed ? 'w-24 px-3' : 'w-72 px-6'
      }`}
    >
      <button
        type="button"
        onClick={toggleCollapsed}
        title={collapsed ? t('Expand sidebar') : t('Collapse sidebar')}
        aria-label={collapsed ? t('Expand sidebar') : t('Collapse sidebar')}
        className="absolute -right-3 top-9 flex h-6 w-6 items-center justify-center rounded-full border border-black/10 bg-white text-[var(--muted)] shadow-sm hover:text-[var(--accent)] hover:shadow-md"
      >
        {collapsed ? <ChevronRightIcon width={13} height={13} /> : <ChevronLeftIcon width={13} height={13} />}
      </button>

      <div className={`mb-10 flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
        <img
          src="/logo-mark.png"
          alt="RentDesk"
          className="h-11 w-11 shrink-0 rounded-2xl object-cover shadow-[0_10px_20px_rgba(15,118,110,0.3)]"
        />
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-xl font-semibold">RentDesk</div>
            <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Portfolio OS</div>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          {t('Menu')}
        </div>
      )}

      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              title={collapsed ? t(item.label) : undefined}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl text-sm font-medium transition ${
                  collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-gradient-to-r from-[var(--accent)] to-[#0d9488] text-white shadow-[0_10px_22px_rgba(15,118,110,0.3)]'
                    : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-1)]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`shrink-0 ${isActive ? 'text-white' : 'text-[var(--muted)] group-hover:text-[var(--accent)]'}`} />
                  {!collapsed && t(item.label)}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="mt-8 rounded-2xl bg-gradient-to-br from-[var(--accent-soft)] to-white p-4 text-xs text-[var(--muted)] border border-emerald-100">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)]">{t('Tip')}</div>
          {t('Use the dashboard to review rent gaps and pending payments every week.')}
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
