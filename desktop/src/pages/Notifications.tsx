import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationsFeed } from '../lib/notificationCenter';
import { SkeletonBlock } from '../components/Skeleton';

const toneMap = {
  warning: {
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    panel: 'border-amber-100 bg-amber-50/60',
    label: 'Needs attention'
  },
  success: {
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    panel: 'border-emerald-100 bg-emerald-50/60',
    label: 'Resolved'
  },
  info: {
    badge: 'border-sky-200 bg-sky-50 text-sky-700',
    panel: 'border-sky-100 bg-sky-50/60',
    label: 'Update'
  }
} as const;

const Filters = ['all', 'warning', 'success', 'info'] as const;

const Notifications = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<(typeof Filters)[number]>('all');
  const { notifications, loading, markRead } = useNotificationsFeed();

  const filteredNotifications = useMemo(() => {
    return filter === 'all' ? notifications : notifications.filter((item) => item.tone === filter);
  }, [filter, notifications]);

  const counts = useMemo(() => {
    return {
      warning: notifications.filter((item) => item.tone === 'warning').length,
      success: notifications.filter((item) => item.tone === 'success').length,
      info: notifications.filter((item) => item.tone === 'info').length
    };
  }, [notifications]);

  const headline = useMemo(() => {
    if (filter === 'warning') return 'Items that need your attention first';
    if (filter === 'success') return 'Recently completed updates';
    if (filter === 'info') return 'General updates across the portfolio';
    return 'One place to review attention items and recent activity';
  }, [filter]);

  if (loading && !notifications.length) {
    return (
      <div className="space-y-6 pb-6">
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm space-y-3">
              <SkeletonBlock height={10} width="55%" />
              <SkeletonBlock height={28} width="30%" />
              <SkeletonBlock height={12} width="70%" />
            </div>
          ))}
        </div>
        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <SkeletonBlock height={10} width={160} />
              <SkeletonBlock height={22} width={280} />
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBlock key={i} height={36} width={i === 0 ? 60 : 100} rounded="rounded-full" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-3xl border border-black/5 p-5 space-y-3">
                <SkeletonBlock height={20} width={100} rounded="rounded-full" />
                <SkeletonBlock height={18} width="50%" />
                <SkeletonBlock height={12} width="80%" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
          <div className="text-xs uppercase tracking-[0.22em] text-amber-700">Needs Attention</div>
          <div className="mt-3 text-3xl font-semibold text-amber-950">{counts.warning}</div>
          <div className="mt-1 text-sm text-amber-700">rent, utility, and follow-up reminders</div>
        </div>
        <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
          <div className="text-xs uppercase tracking-[0.22em] text-emerald-700">Resolved</div>
          <div className="mt-3 text-3xl font-semibold text-emerald-950">{counts.success}</div>
          <div className="mt-1 text-sm text-emerald-700">payments and updates already handled</div>
        </div>
        <div className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
          <div className="text-xs uppercase tracking-[0.22em] text-sky-700">General Updates</div>
          <div className="mt-3 text-3xl font-semibold text-sky-950">{counts.info}</div>
          <div className="mt-1 text-sm text-sky-700">recent activity worth noting</div>
        </div>
      </div>

      <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">Notification Center</div>
            <div className="mt-2 text-2xl font-semibold">{headline}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {Filters.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  filter === item
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'border border-black/10 bg-white text-[var(--muted)] hover:bg-black/5'
                }`}
              >
                {item === 'all' ? 'All' : toneMap[item].label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {filteredNotifications.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                markRead(item.id);
                if (item.path) navigate(item.path);
              }}
              className={`block w-full rounded-3xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 ${item.read ? 'border-black/5 bg-white' : toneMap[item.tone].panel}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${toneMap[item.tone].badge}`}>
                    {toneMap[item.tone].label}
                    {!item.read && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle" />}
                  </div>
                  <div className="text-xl font-semibold">{item.title}</div>
                  <div className="max-w-2xl text-sm text-[var(--muted)]">{item.description}</div>
                </div>
                <div className="rounded-2xl border border-black/5 bg-white px-4 py-3 text-right">
                  <div className="text-xs uppercase tracking-wide text-[var(--muted)]">When</div>
                  <div className="mt-1 text-sm font-medium">{item.time}</div>
                </div>
              </div>
            </button>
          ))}

          {!filteredNotifications.length && (
            <div className="rounded-3xl border border-dashed border-black/10 bg-[var(--surface-1)] px-4 py-10 text-center text-sm text-[var(--muted)]">
              No notifications in this section right now.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;
