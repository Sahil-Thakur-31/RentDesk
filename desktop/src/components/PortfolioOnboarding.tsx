import { useState } from 'react';
import api from '../lib/api';
import { useI18n } from '../lib/i18n';
import { toast } from '../lib/toast';

type OnboardingMode = 'create' | 'join';

const PortfolioOnboarding = ({
  user,
  onReady
}: {
  user: any;
  onReady: () => Promise<void>;
}) => {
  const { t } = useI18n();
  const [mode, setMode] = useState<OnboardingMode>('create');
  const [portfolioName, setPortfolioName] = useState(
    `${String(user?.fullName || 'My').split(' ')[0] || 'My'} Portfolio`
  );
  const [joinCode, setJoinCode] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/portfolio/create', { name: portfolioName.trim() });
      await onReady();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('Unable to create portfolio right now.'));
    } finally {
      setSaving(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/portfolio/join-requests', { code: joinCode.trim() });
      toast.success(t('Request sent. This screen will unlock once the owner approves it.'));
      setJoinCode('');
      await onReady();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('Unable to send join request right now.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl items-center justify-center">
        <div className="w-full max-w-2xl rounded-[32px] border border-black/5 bg-white/92 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.16)] backdrop-blur">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-white flex items-center justify-center font-semibold shadow-[0_10px_20px_rgba(15,118,110,0.3)]">
              RD
            </div>
            <div className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">{t('Portfolio Access')}</div>
            <div className="mt-3 text-3xl font-semibold">{t('Set up your workspace')}</div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {t('Create your own portfolio or request access to an existing one.')}
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-[var(--surface-1)] p-1">
            <button
              type="button"
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                mode === 'create' ? 'bg-white text-[var(--text)] shadow-sm' : 'text-[var(--muted)]'
              }`}
              onClick={() => setMode('create')}
            >
              {t('Create Portfolio')}
            </button>
            <button
              type="button"
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                mode === 'join' ? 'bg-white text-[var(--text)] shadow-sm' : 'text-[var(--muted)]'
              }`}
              onClick={() => setMode('join')}
            >
              {t('Join Existing')}
            </button>
          </div>

          {mode === 'create' ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t('Portfolio Name')}</label>
                <input
                  className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3 text-sm"
                  value={portfolioName}
                  onChange={(e) => setPortfolioName(e.target.value)}
                  placeholder={t('Portfolio Name')}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary w-full !py-3"
                disabled={saving}
              >
                {saving ? t('Creating...') : t('Create Portfolio')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t('7-Digit Portfolio Code')}</label>
                <input
                  className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3 text-center text-sm tracking-[0.35em]"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 7))}
                  placeholder="1234567"
                  inputMode="numeric"
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary w-full !py-3"
                disabled={saving}
              >
                {saving ? t('Sending...') : t('Send Request')}
              </button>
            </form>
          )}

          <button
            type="button"
            className="btn btn-secondary w-full !py-3 mt-4"
            onClick={() => void onReady()}
            disabled={saving}
          >
            {t('Refresh Access')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PortfolioOnboarding;
