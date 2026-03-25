import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { appStorage } from '../lib/appStorage';
import { useI18n } from '../lib/i18n';

type AuthMode = 'login' | 'register';
type ForgotStep = 'request' | 'reset';

const Login = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>('request');
  const [forgotEmail, setForgotEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'register') {
      if (!fullName.trim()) {
        setError(t('Full name is required.'));
        return;
      }

      if (password !== confirmPassword) {
        setError(t('Passwords do not match.'));
        return;
      }
    }

    try {
      setLoading(true);
      const response =
        mode === 'login'
          ? await api.post('/auth/login', { email, password })
          : await api.post('/auth/register', {
              fullName,
              email,
              password,
              role: 'owner'
            });

      appStorage.setItem('rentdesk_token', response.data.token);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          (mode === 'login' ? t('Login failed. Check credentials.') : t('Could not create account.'))
      );
    } finally {
      setLoading(false);
    }
  };

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotMessage('');
    try {
      setForgotLoading(true);
      await api.post('/auth/forgot-password', { email: forgotEmail });
      setForgotMessage(t('OTP sent to your email.'));
      setForgotStep('reset');
    } catch (err: any) {
      setForgotError(err?.response?.data?.message || t('Could not send OTP.'));
    } finally {
      setForgotLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotMessage('');
    try {
      setForgotLoading(true);
      await api.post('/auth/reset-password', {
        email: forgotEmail,
        otp,
        newPassword
      });
      setForgotMessage(t('Password updated. You can sign in now.'));
      setShowForgot(false);
      setForgotStep('request');
      setOtp('');
      setNewPassword('');
      setPassword('');
      setConfirmPassword('');
      setMode('login');
    } catch (err: any) {
      setForgotError(err?.response?.data?.message || t('Could not reset password.'));
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="bg-white/90 backdrop-blur rounded-3xl border border-black/5 shadow-[0_25px_60px_rgba(15,23,42,0.12)] p-8 w-full max-w-md"
      >
        <div className="mb-6">
          <div className="text-2xl font-semibold mb-2">{t('Welcome to RentDesk')}</div>
          <p className="text-sm text-[var(--muted)]">
            {mode === 'login' ? t('Sign in to manage your properties.') : t('Create your owner account to get started.')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 mb-6">
          <button
            type="button"
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              mode === 'login' ? 'bg-white text-[var(--text)] shadow-sm' : 'text-[var(--muted)]'
            }`}
            onClick={() => switchMode('login')}
          >
            {t('Sign In')}
          </button>
          <button
            type="button"
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              mode === 'register' ? 'bg-white text-[var(--text)] shadow-sm' : 'text-[var(--muted)]'
            }`}
            onClick={() => switchMode('register')}
          >
            {t('Register')}
          </button>
        </div>

        {mode === 'register' && (
          <>
            <label className="block text-sm font-medium mb-1">{t('Full Name')}</label>
            <input
              className="w-full border border-black/10 rounded-lg px-3 py-2 mb-4"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              type="text"
              required
            />
          </>
        )}

        <label className="block text-sm font-medium mb-1">{t('Email')}</label>
        <input
          className="w-full border border-black/10 rounded-lg px-3 py-2 mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
        />

        <label className="block text-sm font-medium mb-1">{t('Password')}</label>
        <input
          className="w-full border border-black/10 rounded-lg px-3 py-2 mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          minLength={6}
          required
        />

        {mode === 'register' && (
          <>
            <label className="block text-sm font-medium mb-1">{t('Confirm Password')}</label>
            <input
              className="w-full border border-black/10 rounded-lg px-3 py-2 mb-4"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              minLength={6}
              required
            />
          </>
        )}

        {error && <div className="text-sm text-[var(--danger)] mb-3">{error}</div>}

        <button
          type="submit"
          className="w-full bg-[var(--accent)] text-white rounded-lg py-2 font-medium"
          disabled={loading}
        >
          {loading
            ? mode === 'login'
              ? t('Signing in...')
              : t('Creating account...')
            : mode === 'login'
              ? t('Sign In')
              : t('Create Account')}
        </button>

        <div className="mt-4 text-center">
          {mode === 'login' ? (
            <button
              type="button"
              className="text-sm font-medium text-[var(--accent)]"
              onClick={() => {
                setShowForgot(true);
                setForgotEmail(email);
                setForgotError('');
                setForgotMessage('');
              }}
            >
              {t('Forgot password?')}
            </button>
          ) : (
            <button
              type="button"
              className="text-sm font-medium text-[var(--accent)]"
              onClick={() => switchMode('login')}
            >
              {t('Already have an account? Sign In')}
            </button>
          )}
        </div>
      </form>

      {showForgot && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl border border-black/5 shadow-[0_25px_60px_rgba(15,23,42,0.12)] p-8 w-full max-w-md">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xl font-semibold">{t('Reset password')}</div>
              <button
                type="button"
                className="text-sm text-[var(--muted)]"
                onClick={() => {
                  setShowForgot(false);
                  setForgotStep('request');
                  setForgotError('');
                  setForgotMessage('');
                }}
              >
                {t('Close')}
              </button>
            </div>
            <p className="text-sm text-[var(--muted)] mb-6">
              {forgotStep === 'request'
                ? t('Enter your email and we will send a 6-digit OTP.')
                : t('Enter the OTP from your email and choose a new password.')}
            </p>

            {forgotStep === 'request' ? (
              <form onSubmit={requestOtp}>
                <label className="block text-sm font-medium mb-1">{t('Email')}</label>
                <input
                  className="w-full border border-black/10 rounded-lg px-3 py-2 mb-4"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  type="email"
                  required
                />
                {forgotError && <div className="text-sm text-[var(--danger)] mb-3">{forgotError}</div>}
                {forgotMessage && <div className="text-sm text-[var(--accent)] mb-3">{forgotMessage}</div>}
                <button
                  type="submit"
                  className="w-full bg-[var(--accent)] text-white rounded-lg py-2 font-medium"
                  disabled={forgotLoading}
                >
                  {forgotLoading ? t('Sending OTP...') : t('Send OTP')}
                </button>
              </form>
            ) : (
              <form onSubmit={resetPassword}>
                <label className="block text-sm font-medium mb-1">{t('Email')}</label>
                <input
                  className="w-full border border-black/10 rounded-lg px-3 py-2 mb-4"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  type="email"
                  required
                />
                <label className="block text-sm font-medium mb-1">{t('OTP')}</label>
                <input
                  className="w-full border border-black/10 rounded-lg px-3 py-2 mb-4 tracking-[0.3em]"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  required
                />
                <label className="block text-sm font-medium mb-1">{t('New Password')}</label>
                <input
                  className="w-full border border-black/10 rounded-lg px-3 py-2 mb-4"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="password"
                  minLength={6}
                  required
                />
                {forgotError && <div className="text-sm text-[var(--danger)] mb-3">{forgotError}</div>}
                {forgotMessage && <div className="text-sm text-[var(--accent)] mb-3">{forgotMessage}</div>}
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 bg-[var(--accent)] text-white rounded-lg py-2 font-medium"
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? t('Updating') : t('Reset Password')}
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg border border-black/10"
                    onClick={() => {
                      setForgotStep('request');
                      setForgotError('');
                      setForgotMessage('');
                    }}
                  >
                    {t('Back')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
