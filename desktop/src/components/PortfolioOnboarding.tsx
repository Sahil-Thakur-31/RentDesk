import { useState } from 'react';
import api from '../lib/api';
import { useI18n } from '../lib/i18n';

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
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const resetFeedback = () => {
    setMessage('');
    setError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();
    setSaving(true);
    try {
      await api.post('/portfolio/create', { name: portfolioName.trim() });
      await onReady();
    } catch (err: any) {
      setError(err?.response?.data?.message || t('Unable to create portfolio right now.'));
    } finally {
      setSaving(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();
    setSaving(true);
    try {
      await api.post('/portfolio/join-requests', { code: joinCode.trim() });
      setMessage(t('Request sent. This screen will unlock once the owner approves it.'));
      setJoinCode('');
      await onReady();
    } catch (err: any) {
      setError(err?.response?.data?.message || t('Unable to send join request right now.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl items-center justify-center">
        <div className="w-full max-w-2xl rounded-[32px] border border-black/5 bg-white/92 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.16)] backdrop-blur">
          <div className="mb-8 text-center">
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
              onClick={() => {
                resetFeedback();
                setMode('create');
              }}
            >
              {t('Create Portfolio')}
            </button>
            <button
              type="button"
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                mode === 'join' ? 'bg-white text-[var(--text)] shadow-sm' : 'text-[var(--muted)]'
              }`}
              onClick={() => {
                resetFeedback();
                setMode('join');
              }}
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
                className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
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
                className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                disabled={saving}
              >
                {saving ? t('Sending...') : t('Send Request')}
              </button>
            </form>
          )}

          {(message || error) && (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {error || message}
            </div>
          )}

          <button
            type="button"
            className="mt-4 w-full rounded-2xl border border-black/10 px-4 py-3 text-sm hover:bg-black/5"
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
