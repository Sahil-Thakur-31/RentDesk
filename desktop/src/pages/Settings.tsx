import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { appStorage } from '../lib/appStorage';
import { invalidateAll } from '../lib/queryCache';
import { LANGUAGE_OPTIONS, useI18n } from '../lib/i18n';
import { disconnectRealtime, useRealtimeStatus } from '../lib/realtimeSocket';
import { toast } from '../lib/toast';
import SettingsRow from '../components/SettingsRow';
import { DatabaseIcon, GlobeIcon, LogoutIcon, TrashIcon } from '../components/icons';

const Settings = () => {
  const { t, language, setLanguage } = useI18n();
  const navigate = useNavigate();
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [saving, setSaving] = useState(false);

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
    <div className="w-full pb-6">
      <div className="divide-y divide-black/5 rounded-3xl border border-black/5 bg-white shadow-sm">
        <SettingsRow
          icon={<GlobeIcon width={18} height={18} />}
          label={t('Language')}
          control={
            <select
              className="w-40 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
              value={language}
              onChange={(event) => setLanguage(event.target.value as any)}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          }
        />
        <SettingsRow
          icon={<DatabaseIcon width={18} height={18} />}
          label={t('Local data')}
          control={
            <button type="button" className="btn btn-sm btn-secondary" onClick={clearLocalSnapshot}>
              {t('Clear Local Data')}
            </button>
          }
        />
        <SettingsRow
          danger
          icon={<LogoutIcon width={18} height={18} />}
          label={t('Sign out')}
          control={
            <button type="button" className="btn btn-sm btn-danger" onClick={logout}>
              {t('Sign Out From This Device')}
            </button>
          }
        />
        <SettingsRow
          danger
          icon={<TrashIcon width={18} height={18} />}
          label={t('Delete account')}
          control={
            !confirmDeleteAccount ? (
              <button type="button" className="btn btn-sm btn-danger" disabled={saving} onClick={() => setConfirmDeleteAccount(true)}>
                {t('Delete My Account')}
              </button>
            ) : undefined
          }
        />
        {confirmDeleteAccount && (
          <div className="px-5 pb-5">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="text-sm font-medium text-red-800">{t('Delete this account permanently?')}</div>
              <div className="mt-1 text-sm text-red-700">
                {t('This cannot be undone. Your access will be removed from every portfolio immediately.')}
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" className="btn btn-sm btn-danger-solid" disabled={saving} onClick={() => void handleDeleteAccount()}>
                  {saving ? t('Deleting...') : t('Confirm Delete')}
                </button>
                <button type="button" className="btn btn-sm btn-danger" disabled={saving} onClick={() => setConfirmDeleteAccount(false)}>
                  {t('Cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
