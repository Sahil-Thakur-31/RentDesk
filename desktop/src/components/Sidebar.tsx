import { NavLink } from 'react-router-dom';
import { useI18n } from '../lib/i18n';

const navItems = [
  { label: 'Dashboard', path: '/' },
  { label: 'Properties', path: '/properties' },
  { label: 'Units', path: '/units' },
  { label: 'Tenants', path: '/tenants' },
  { label: 'Transactions', path: '/transactions' },
  { label: 'Utilities', path: '/utilities' },
  { label: 'Reports', path: '/reports' }
];

const Sidebar = () => {
  const { t } = useI18n();

  return (
    <aside className="w-72 shrink-0 h-screen overflow-y-auto bg-white/90 backdrop-blur border-r border-black/5 px-6 py-8 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
      <div className="mb-10 flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-white flex items-center justify-center font-semibold">
          RD
        </div>
        <div>
          <div className="text-xl font-semibold">RentDesk</div>
          <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Portfolio OS</div>
        </div>
      </div>
      <nav className="space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `block px-3 py-2 rounded-xl text-sm font-medium transition ${
                isActive
                  ? 'bg-[var(--surface-2)] text-[var(--accent)] shadow-[inset_0_0_0_1px_rgba(15,118,110,0.15)]'
                  : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
              }`
            }
          >
            {t(item.label)}
          </NavLink>
        ))}
      </nav>
      <div className="mt-10 rounded-2xl bg-[var(--surface-2)] p-4 text-xs text-[var(--muted)]">
        {t('Tip: Use the dashboard to review rent gaps and pending payments every week.')}
      </div>
    </aside>
  );
};

export default Sidebar;
