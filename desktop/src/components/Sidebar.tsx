import { NavLink } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import {
  DashboardIcon,
  BuildingIcon,
  UnitsIcon,
  TenantsIcon,
  TransactionsIcon,
  UtilitiesIcon,
  ReportsIcon
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

const Sidebar = () => {
  const { t } = useI18n();

  return (
    <aside className="w-72 shrink-0 h-screen overflow-y-auto bg-white/90 backdrop-blur border-r border-black/5 px-6 py-8 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
      <div className="mb-10 flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-white flex items-center justify-center font-semibold shadow-[0_10px_20px_rgba(15,118,110,0.3)]">
          RD
        </div>
        <div>
          <div className="text-xl font-semibold">RentDesk</div>
          <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Portfolio OS</div>
        </div>
      </div>
      <div className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        {t('Menu')}
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-gradient-to-r from-[var(--accent)] to-[#0d9488] text-white shadow-[0_10px_22px_rgba(15,118,110,0.3)]'
                    : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-1)]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={isActive ? 'text-white' : 'text-[var(--muted)] group-hover:text-[var(--accent)]'} />
                  {t(item.label)}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
      <div className="mt-8 rounded-2xl bg-gradient-to-br from-[var(--accent-soft)] to-white p-4 text-xs text-[var(--muted)] border border-emerald-100">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)]">{t('Tip')}</div>
        {t('Use the dashboard to review rent gaps and pending payments every week.')}
      </div>
    </aside>
  );
};

export default Sidebar;
