import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { appStorage } from '../lib/appStorage';
import { invalidateAll } from '../lib/queryCache';
import { LANGUAGE_OPTIONS, useI18n } from '../lib/i18n';
import { disconnectRealtime, useRealtimeStatus } from '../lib/realtimeSocket';
import { toast } from '../lib/toast';

const Settings = () => {
  const { t, language, setLanguage } = useI18n();
  const navigate = useNavigate();
  const realtimeStatus = useRealtimeStatus();
  const [me, setMe] = useState<any>(null);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [meRes, portfolioRes] = await Promise.all([api.get('/auth/me'), api.get('/portfolio')]);
        setMe(meRes.data?.user || null);
        setPortfolio(portfolioRes.data?.portfolio || null);
      } catch (err: any) {
        toast.error(err?.response?.data?.message || t('Unable to load settings right now.'));
      }
    };

    void load();
  }, [t]);

  const clearLocalSnapshot = () => {
    invalidateAll();
    toast.success(t('Local data cleared. RentDesk will rebuild it automatically.'));
  };

  const clearSessionStorage = () => {
    disconnectRealtime();
    invalidateAll();
    appStorage.removeItem('rentdesk_token');
    appStorage.removeItem('rentdesk_active_portfolio_id');
  };

  const logout = () => {
    clearSessionStorage();
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
    setSaving(true);
    try {
      await api.delete('/auth/me');
      clearSessionStorage();
      navigate('/login');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('Unable to delete account right now.'));
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-6">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">{t('Account')}</div>
          <div className="mt-3 text-3xl font-semibold">{me?.fullName || 'RentDesk User'}</div>
          <div className="mt-2 text-sm text-[var(--muted)]">{me?.email || '-'}</div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-black/5 bg-[var(--surface-1)] px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{t('Role')}</div>
              <div className="mt-2 text-xl font-semibold capitalize">{me?.role || '-'}</div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-[var(--surface-1)] px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{t('Portfolio')}</div>
              <div className="mt-2 text-xl font-semibold">{portfolio?.name || t('Not joined yet')}</div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">{t('Sync')}</div>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-black/5 bg-[var(--surface-1)] px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{t('Connection')}</div>
              <div className="mt-2 flex items-center gap-2 text-xl font-semibold">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    realtimeStatus === 'connected'
                      ? 'bg-emerald-500'
                      : realtimeStatus === 'connecting' || realtimeStatus === 'reconnecting'
                        ? 'bg-sky-500 animate-pulse'
                        : 'bg-amber-500'
                  }`}
                />
                {realtimeStatus === 'connected'
                  ? t('Online')
                  : realtimeStatus === 'connecting'
                    ? t('Connecting')
                    : realtimeStatus === 'reconnecting'
                      ? t('Reconnecting')
                      : t('Offline')}
              </div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-[var(--surface-1)] px-4 py-3 text-sm text-[var(--muted)]">
              {t('Changes made anywhere on this portfolio sync to this device automatically while connected.')}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">{t('Language')}</div>
          <select
            className="mt-4 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[var(--text)]"
            value={language}
            onChange={(event) => setLanguage(event.target.value as any)}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="mt-3 text-sm text-[var(--muted)]">
            UI text, dates, and month labels use this language. Cached translations update automatically as screens load.
          </div>
        </div>

        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">{t('Device')}</div>
              <div className="mt-2 text-2xl font-semibold">{t('Local data')}</div>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={clearLocalSnapshot}
            >
              {t('Clear Local Data')}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
        <div className="text-xs uppercase tracking-[0.24em] text-red-500">{t('Session')}</div>
        <div className="mt-2 text-2xl font-semibold">{t('Sign out')}</div>
        <button
          type="button"
          className="btn btn-danger !py-3 mt-5"
          onClick={logout}
        >
          {t('Sign Out From This Device')}
        </button>
      </div>

      <div className="rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
        <div className="text-xs uppercase tracking-[0.24em] text-red-500">{t('Account')}</div>
        <div className="mt-2 text-2xl font-semibold">{t('Delete account')}</div>
        <div className="mt-2 text-sm text-[var(--muted)]">{t('Owners delete all portfolios they own. Other users are removed from every joined portfolio.')}</div>
        <button
          type="button"
          className="btn btn-danger !py-3 mt-5"
          disabled={saving}
          onClick={() => setConfirmDeleteAccount((current) => !current)}
        >
          {t('Delete My Account')}
        </button>

        {confirmDeleteAccount ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="text-sm font-medium text-red-800">{t('Delete this account permanently?')}</div>
            <div className="mt-1 text-sm text-red-700">
              {t('This cannot be undone. Your access will be removed from every portfolio immediately.')}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="btn btn-danger-solid"
                disabled={saving}
                onClick={() => void handleDeleteAccount()}
              >
                {saving ? t('Deleting...') : t('Confirm Delete')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={saving}
                onClick={() => setConfirmDeleteAccount(false)}
              >
                {t('Cancel')}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Settings;
