import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { appStorage } from '../lib/appStorage';
import { useI18n } from '../lib/i18n';
import { BuildingIcon, CloseIcon, ReportsIcon, TenantsIcon, TransactionsIcon } from '../components/icons';
import { toast } from '../lib/toast';

type AuthMode = 'login' | 'register';
type ForgotStep = 'request' | 'reset';

const PasswordToggleButton = ({ visible, onClick }: { visible: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    tabIndex={-1}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)]"
    aria-label={visible ? 'Hide password' : 'Show password'}
  >
    {visible ? (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.06 21.06 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.05 21.05 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )}
  </button>
);

const highlights = [
  { icon: BuildingIcon, label: 'Track every property, unit, and lease in one place.' },
  { icon: TenantsIcon, label: 'Keep tenant records, deposits, and documents organized.' },
  { icon: TransactionsIcon, label: 'Collect rent, utilities, and maintenance without spreadsheets.' },
  { icon: ReportsIcon, label: 'See cash flow and pending dues at a glance.' }
];

const Login = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>('request');
  const [forgotEmail, setForgotEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'register') {
      if (!fullName.trim()) {
        toast.error(t('Full name is required.'));
        return;
      }

      if (password !== confirmPassword) {
        toast.error(t('Passwords do not match.'));
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
      toast.error(
        err?.response?.data?.message ||
          (mode === 'login' ? t('Login failed. Check credentials.') : t('Could not create account.'))
      );
    } finally {
      setLoading(false);
    }
  };

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setForgotLoading(true);
      await api.post('/auth/forgot-password', { email: forgotEmail });
      toast.success(t('OTP sent to your email.'));
      setForgotStep('reset');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('Could not send OTP.'));
    } finally {
      setForgotLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setForgotLoading(true);
      await api.post('/auth/reset-password', {
        email: forgotEmail,
        otp,
        newPassword
      });
      toast.success(t('Password updated. You can sign in now.'));
      setShowForgot(false);
      setForgotStep('request');
      setOtp('');
      setNewPassword('');
      setPassword('');
      setConfirmPassword('');
      setMode('login');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('Could not reset password.'));
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-black/5 bg-white/90 shadow-[0_40px_90px_rgba(15,23,42,0.18)] backdrop-blur grid grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
        <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[var(--accent)] via-[#0d9488] to-[var(--accent-2)] p-10 text-white">
          <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)', backgroundSize: '22px 22px' }} />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center font-semibold">RD</div>
              <div className="text-xl font-semibold">RentDesk</div>
            </div>
            <h1 className="mt-10 text-3xl font-semibold leading-tight" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
              {t('Run your rental portfolio like a business.')}
            </h1>
            <p className="mt-3 max-w-sm text-sm text-white/80">
              {t('Properties, tenants, rent, and utilities — one calm dashboard instead of five spreadsheets.')}
            </p>
          </div>
          <div className="relative space-y-4">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-3 text-sm text-white/90">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                    <Icon width={16} height={16} />
                  </span>
                  {t(item.label)}
                </div>
              );
            })}
          </div>
        </div>

        <form onSubmit={submit} className="p-8 sm:p-10">
          <div className="mb-6 lg:hidden flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-white flex items-center justify-center font-semibold">RD</div>
            <div className="text-lg font-semibold">RentDesk</div>
          </div>

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
          <div className="relative mb-4">
            <input
              className="w-full border border-black/10 rounded-lg px-3 py-2 pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? 'text' : 'password'}
              minLength={6}
              required
            />
            <PasswordToggleButton visible={showPassword} onClick={() => setShowPassword((v) => !v)} />
          </div>

          {mode === 'register' && (
            <>
              <label className="block text-sm font-medium mb-1">{t('Confirm Password')}</label>
              <div className="relative mb-4">
                <input
                  className="w-full border border-black/10 rounded-lg px-3 py-2 pr-10"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type={showConfirmPassword ? 'text' : 'password'}
                  minLength={6}
                  required
                />
                <PasswordToggleButton visible={showConfirmPassword} onClick={() => setShowConfirmPassword((v) => !v)} />
              </div>
            </>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
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
      </div>

      {showForgot && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl border border-black/5 shadow-[0_25px_60px_rgba(15,23,42,0.12)] p-8 w-full max-w-md">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xl font-semibold">{t('Reset password')}</div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => {
                  setShowForgot(false);
                  setForgotStep('request');
                }}
                aria-label={t('Close')}
              >
                <CloseIcon width={18} height={18} />
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
                <button
                  type="submit"
                  className="btn btn-primary w-full"
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
                <div className="relative mb-4">
                  <input
                    className="w-full border border-black/10 rounded-lg px-3 py-2 pr-10"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    type={showNewPassword ? 'text' : 'password'}
                    minLength={6}
                    required
                  />
                  <PasswordToggleButton visible={showNewPassword} onClick={() => setShowNewPassword((v) => !v)} />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="btn btn-primary flex-1"
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? t('Updating') : t('Reset Password')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setForgotStep('request')}
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
