import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { appStorage } from '../lib/appStorage';
import { useI18n } from '../lib/i18n';
import { CloseIcon } from '../components/icons';
import { toast } from '../lib/toast';
import LoginCharacter, { type CharacterMood } from '../components/LoginCharacter';
import LoginSceneDecor from '../components/LoginSceneDecor';
import FieldError from '../components/FieldError';
import { isBlank, isValidEmail, isValidPhone, requiredMsg, type FieldErrors } from '../lib/validation';

type FocusKind = 'text' | 'password' | null;

const AVOID_RADIUS = 170; // screen px — cursor distance that triggers dodging
const PANIC_RADIUS = 95; // screen px — cursor distance, while pinned against an edge, that triggers "cornered"
const CHAR_VISUAL_MARGIN = 60; // px — half the character's own visible footprint, kept inside the roaming bounds
const CURIOUS_DRIFT = 20; // px — small lean toward the cursor's general direction when it isn't close enough to flee from

const useCharacterMood = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [focusField, setFocusFieldState] = useState<FocusKind>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [statusMood, setStatusMood] = useState<CharacterMood>('idle');
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const [avoid, setAvoid] = useState({ x: 0, y: 0 });
  const [cornered, setCornered] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [pokeKey, setPokeKey] = useState(0);
  const interactedRef = useRef(false);
  const lockedRef = useRef<{ x: number; y: number } | null>(null);
  const avoidRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markInteracted = () => {
    if (!interactedRef.current) {
      interactedRef.current = true;
      setHasInteracted(true);
    }
  };

  const computeGazeToPoint = (px: number, py: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height * 0.4;
    const nx = Math.max(-1, Math.min(1, (px - cx) / 260));
    const ny = Math.max(-1, Math.min(1, (py - cy) / 260));
    setGaze({ x: nx, y: ny });
  };

  const computeAvoidance = (px: number, py: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const baseCx = rect.left + rect.width / 2;
    const baseCy = rect.top + rect.height / 2;
    const halfW = Math.max(0, rect.width / 2 - CHAR_VISUAL_MARGIN);
    const halfH = Math.max(0, rect.height / 2 - CHAR_VISUAL_MARGIN);
    const prev = avoidRef.current;
    const charCx = baseCx + prev.x;
    const charCy = baseCy + prev.y;
    const dx = charCx - px;
    const dy = charCy - py;
    const dist = Math.hypot(dx, dy) || 1;

    let next = prev;
    let isCornered = false;

    if (dist < AVOID_RADIUS) {
      const pushStrength = (AVOID_RADIUS - dist) / AVOID_RADIUS;
      const dirX = dx / dist;
      const dirY = dy / dist;
      const targetX = prev.x + dirX * pushStrength * 16;
      const targetY = prev.y + dirY * pushStrength * 16;
      const clampedX = Math.max(-halfW, Math.min(halfW, targetX));
      const clampedY = Math.max(-halfH, Math.min(halfH, targetY));
      next = { x: clampedX, y: clampedY };

      const pinnedX = halfW > 0 && Math.abs(clampedX) > halfW * 0.9;
      const pinnedY = halfH > 0 && Math.abs(clampedY) > halfH * 0.9;
      if (dist < PANIC_RADIUS && (pinnedX || pinnedY)) {
        isCornered = true;
      }
    } else {
      // not close enough to threaten — lean a little toward wherever the cursor generally is
      const dirX = -dx / dist;
      const dirY = -dy / dist;
      const targetX = Math.max(-halfW, Math.min(halfW, dirX * CURIOUS_DRIFT));
      const targetY = Math.max(-halfH, Math.min(halfH, dirY * CURIOUS_DRIFT));
      const nx = prev.x + (targetX - prev.x) * 0.08;
      const ny = prev.y + (targetY - prev.y) * 0.08;
      next = {
        x: Math.abs(nx) < 0.3 ? 0 : nx,
        y: Math.abs(ny) < 0.3 ? 0 : ny
      };
    }

    avoidRef.current = next;
    setAvoid(next);
    setCornered(isCornered);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      markInteracted();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        computeAvoidance(e.clientX, e.clientY);
        if (!lockedRef.current) computeGazeToPoint(e.clientX, e.clientY);
      });
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (resetRef.current) clearTimeout(resetRef.current);
    };
  }, []);

  const lookAtElement = (el: HTMLElement | null) => {
    if (!el) {
      lockedRef.current = null;
      return;
    }
    const r = el.getBoundingClientRect();
    const point = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    lockedRef.current = point;
    computeGazeToPoint(point.x, point.y);
  };

  const setFocusField = (kind: FocusKind, el?: HTMLElement | null, visible = false) => {
    markInteracted();
    setFocusFieldState(kind);
    if (kind === 'password') setPasswordVisible(visible);
    lookAtElement(kind ? el ?? null : null);
  };

  const flash = (mood: CharacterMood, duration = 2200) => {
    markInteracted();
    if (resetRef.current) clearTimeout(resetRef.current);
    setStatusMood(mood);
    resetRef.current = setTimeout(() => setStatusMood('idle'), duration);
  };

  const setBusy = (mood: CharacterMood) => {
    markInteracted();
    if (resetRef.current) clearTimeout(resetRef.current);
    setStatusMood(mood);
  };

  const poke = () => {
    setPokeKey((n) => n + 1);
    flash('poked', 650);
  };

  const mood: CharacterMood =
    statusMood !== 'idle'
      ? statusMood
      : cornered
        ? 'cornered'
        : focusField === 'password'
          ? passwordVisible
            ? 'peeking'
            : 'hiding'
          : focusField === 'text'
            ? 'watching'
            : hasInteracted
              ? 'watching'
              : 'idle';

  return { mood, gaze, avoid, pokeKey, containerRef, setFocusField, setPasswordVisible, flash, setBusy, poke };
};

type AuthMode = 'login' | 'register';
type ForgotStep = 'request' | 'reset';

const PasswordToggleButton = ({ visible, onClick }: { visible: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    onMouseDown={(e) => e.preventDefault()}
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

const Login = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
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
  const [errors, setErrors] = useState<FieldErrors>({});
  const [forgotErrors, setForgotErrors] = useState<FieldErrors>({});

  const char = useCharacterMood();
  const forgotChar = useCharacterMood();

  const clearError = (key: string) => setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  const clearForgotError = (key: string) => setForgotErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setErrors({});
  };

  const validateAuthForm = () => {
    const next: FieldErrors = {};
    if (mode === 'register' && isBlank(fullName)) next.fullName = requiredMsg('Full name');
    if (mode === 'register' && !isBlank(phone) && !isValidPhone(phone)) next.phone = t('Enter a valid phone number');
    if (isBlank(email)) next.email = requiredMsg('Email');
    else if (!isValidEmail(email)) next.email = t('Enter a valid email address');
    if (isBlank(password)) next.password = requiredMsg('Password');
    else if (password.length < 6) next.password = t('Password must be at least 6 characters');
    if (mode === 'register') {
      if (isBlank(confirmPassword)) next.confirmPassword = requiredMsg('Confirm password');
      else if (password !== confirmPassword) next.confirmPassword = t('Passwords do not match.');
    }
    setErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateAuthForm()) {
      char.flash('error');
      return;
    }

    try {
      setLoading(true);
      char.setBusy('thinking');
      const response =
        mode === 'login'
          ? await api.post('/auth/login', { email, password })
          : await api.post('/auth/register', {
              fullName,
              phone: phone.trim() || undefined,
              email,
              password,
              role: 'owner'
            });

      appStorage.setItem('rentdesk_token', response.data.token);
      char.setBusy('success');
      setTimeout(() => navigate('/', { replace: true }), 600);
    } catch (err: any) {
      const isNetworkError = !err?.response;
      char.flash(isNetworkError ? 'offline' : 'error');
      toast.error(
        isNetworkError
          ? t('Could not reach the server. Check your connection and try again.')
          : err?.response?.data?.message ||
              (mode === 'login' ? t('Login failed. Check credentials.') : t('Could not create account.'))
      );
      setLoading(false);
    }
  };

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: FieldErrors = {};
    if (isBlank(forgotEmail)) next.forgotEmail = requiredMsg('Email');
    else if (!isValidEmail(forgotEmail)) next.forgotEmail = t('Enter a valid email address');
    setForgotErrors(next);
    if (Object.values(next).some(Boolean)) {
      forgotChar.flash('error');
      return;
    }
    try {
      setForgotLoading(true);
      forgotChar.setBusy('thinking');
      await api.post('/auth/forgot-password', { email: forgotEmail });
      toast.success(t('OTP sent to your email.'));
      forgotChar.flash('success', 1400);
      setForgotStep('reset');
    } catch (err: any) {
      const isNetworkError = !err?.response;
      forgotChar.flash(isNetworkError ? 'offline' : 'error');
      toast.error(
        isNetworkError
          ? t('Could not reach the server. Check your connection and try again.')
          : err?.response?.data?.message || t('Could not send OTP.')
      );
    } finally {
      setForgotLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: FieldErrors = {};
    if (isBlank(forgotEmail)) next.forgotEmail = requiredMsg('Email');
    else if (!isValidEmail(forgotEmail)) next.forgotEmail = t('Enter a valid email address');
    if (isBlank(otp)) next.otp = requiredMsg('OTP');
    if (isBlank(newPassword)) next.newPassword = requiredMsg('New password');
    else if (newPassword.length < 6) next.newPassword = t('Password must be at least 6 characters');
    setForgotErrors(next);
    if (Object.values(next).some(Boolean)) {
      forgotChar.flash('error');
      return;
    }
    try {
      setForgotLoading(true);
      forgotChar.setBusy('thinking');
      await api.post('/auth/reset-password', {
        email: forgotEmail,
        otp,
        newPassword
      });
      toast.success(t('Password updated. You can sign in now.'));
      forgotChar.flash('success', 1400);
      setShowForgot(false);
      setForgotStep('request');
      setOtp('');
      setNewPassword('');
      setPassword('');
      setConfirmPassword('');
      setMode('login');
      setForgotErrors({});
    } catch (err: any) {
      const isNetworkError = !err?.response;
      forgotChar.flash(isNetworkError ? 'offline' : 'error');
      toast.error(
        isNetworkError
          ? t('Could not reach the server. Check your connection and try again.')
          : err?.response?.data?.message || t('Could not reset password.')
      );
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
            <p className="mt-3 text-sm text-white/80">
              {t('Properties, tenants, rent, and utilities — one calm dashboard instead of five spreadsheets.')}
            </p>
          </div>
          <div ref={char.containerRef} className="relative flex-1 min-h-[220px] my-2">
            <LoginSceneDecor />
            <div
              className="absolute w-64 h-64"
              style={{
                left: '50%',
                top: '50%',
                transform: `translate(calc(-50% + ${char.avoid.x}px), calc(-50% + ${char.avoid.y}px))`,
                transition: 'transform 0.45s cubic-bezier(0.37, 0, 0.63, 1)'
              }}
            >
              <LoginCharacter
                mood={char.mood}
                gazeX={char.gaze.x}
                gazeY={char.gaze.y}
                pokeKey={char.pokeKey}
                onClick={char.poke}
                decor={false}
              />
            </div>
          </div>
        </div>

        <form onSubmit={submit} noValidate className="p-8 sm:p-10">
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
            <div className="relative mb-4">
              <label className="block text-sm font-medium mb-1">{t('Full Name')}</label>
              <input
                className={`w-full border border-black/10 rounded-lg px-3 py-2 ${errors.fullName ? 'input-error' : ''}`}
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  clearError('fullName');
                }}
                onFocus={(e) => char.setFocusField('text', e.currentTarget)}
                onBlur={() => char.setFocusField(null)}
                type="text"
              />
              <FieldError message={errors.fullName} />
            </div>
          )}

          {mode === 'register' && (
            <div className="relative mb-4">
              <label className="block text-sm font-medium mb-1">{t('Phone Number')}</label>
              <input
                className={`w-full border border-black/10 rounded-lg px-3 py-2 ${errors.phone ? 'input-error' : ''}`}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  clearError('phone');
                }}
                onFocus={(e) => char.setFocusField('text', e.currentTarget)}
                onBlur={() => char.setFocusField(null)}
                type="tel"
              />
              <FieldError message={errors.phone} />
            </div>
          )}

          <div className="relative mb-4">
            <label className="block text-sm font-medium mb-1">{t('Email')}</label>
            <input
              className={`w-full border border-black/10 rounded-lg px-3 py-2 ${errors.email ? 'input-error' : ''}`}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearError('email');
              }}
              onFocus={(e) => char.setFocusField('text', e.currentTarget)}
              onBlur={() => char.setFocusField(null)}
              type="email"
            />
            <FieldError message={errors.email} />
          </div>

          <div className="relative mb-4">
            <label className="block text-sm font-medium mb-1">{t('Password')}</label>
            <input
              className={`w-full border border-black/10 rounded-lg px-3 py-2 pr-10 ${errors.password ? 'input-error' : ''}`}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError('password');
              }}
              onFocus={(e) => char.setFocusField('password', e.currentTarget, showPassword)}
              onBlur={() => char.setFocusField(null)}
              type={showPassword ? 'text' : 'password'}
              minLength={6}
            />
            <PasswordToggleButton
              visible={showPassword}
              onClick={() => {
                const next = !showPassword;
                setShowPassword(next);
                char.setPasswordVisible(next);
              }}
            />
            <FieldError message={errors.password} />
          </div>

          {mode === 'register' && (
            <div className="relative mb-4">
              <label className="block text-sm font-medium mb-1">{t('Confirm Password')}</label>
              <input
                className={`w-full border border-black/10 rounded-lg px-3 py-2 pr-10 ${errors.confirmPassword ? 'input-error' : ''}`}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  clearError('confirmPassword');
                }}
                onFocus={(e) => char.setFocusField('password', e.currentTarget, showConfirmPassword)}
                onBlur={() => char.setFocusField(null)}
                type={showConfirmPassword ? 'text' : 'password'}
                minLength={6}
              />
              <PasswordToggleButton
                visible={showConfirmPassword}
                onClick={() => {
                  const next = !showConfirmPassword;
                  setShowConfirmPassword(next);
                  char.setPasswordVisible(next);
                }}
              />
              <FieldError message={errors.confirmPassword} />
            </div>
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
                  setForgotErrors({});
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
            <div ref={forgotChar.containerRef} className="mx-auto mb-4 h-28 w-28 rounded-full bg-gradient-to-br from-[var(--accent)] via-[#0d9488] to-[var(--accent-2)] p-3 shadow-lg overflow-hidden">
              <LoginCharacter
                mood={forgotChar.mood}
                gazeX={forgotChar.gaze.x}
                gazeY={forgotChar.gaze.y}
                pokeKey={forgotChar.pokeKey}
                onClick={forgotChar.poke}
              />
            </div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xl font-semibold">{t('Reset password')}</div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => {
                  setShowForgot(false);
                  setForgotStep('request');
                  setForgotErrors({});
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
              <form onSubmit={requestOtp} noValidate>
                <label className="block text-sm font-medium mb-1">{t('Email')}</label>
                <div className="relative mb-4">
                  <input
                    className={`w-full border border-black/10 rounded-lg px-3 py-2 ${forgotErrors.forgotEmail ? 'input-error' : ''}`}
                    value={forgotEmail}
                    onChange={(e) => {
                      setForgotEmail(e.target.value);
                      clearForgotError('forgotEmail');
                    }}
                    onFocus={(e) => forgotChar.setFocusField('text', e.currentTarget)}
                    onBlur={() => forgotChar.setFocusField(null)}
                    type="email"
                  />
                  <FieldError message={forgotErrors.forgotEmail} />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={forgotLoading}
                >
                  {forgotLoading ? t('Sending OTP...') : t('Send OTP')}
                </button>
              </form>
            ) : (
              <form onSubmit={resetPassword} noValidate>
                <label className="block text-sm font-medium mb-1">{t('Email')}</label>
                <div className="relative mb-4">
                  <input
                    className={`w-full border border-black/10 rounded-lg px-3 py-2 ${forgotErrors.forgotEmail ? 'input-error' : ''}`}
                    value={forgotEmail}
                    onChange={(e) => {
                      setForgotEmail(e.target.value);
                      clearForgotError('forgotEmail');
                    }}
                    onFocus={(e) => forgotChar.setFocusField('text', e.currentTarget)}
                    onBlur={() => forgotChar.setFocusField(null)}
                    type="email"
                  />
                  <FieldError message={forgotErrors.forgotEmail} />
                </div>
                <label className="block text-sm font-medium mb-1">{t('OTP')}</label>
                <div className="relative mb-4">
                  <input
                    className={`w-full border border-black/10 rounded-lg px-3 py-2 tracking-[0.3em] ${forgotErrors.otp ? 'input-error' : ''}`}
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value);
                      clearForgotError('otp');
                    }}
                    onFocus={(e) => forgotChar.setFocusField('text', e.currentTarget)}
                    onBlur={() => forgotChar.setFocusField(null)}
                    inputMode="numeric"
                    maxLength={6}
                  />
                  <FieldError message={forgotErrors.otp} />
                </div>
                <label className="block text-sm font-medium mb-1">{t('New Password')}</label>
                <div className="relative mb-4">
                  <input
                    className={`w-full border border-black/10 rounded-lg px-3 py-2 pr-10 ${forgotErrors.newPassword ? 'input-error' : ''}`}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      clearForgotError('newPassword');
                    }}
                    onFocus={(e) => forgotChar.setFocusField('password', e.currentTarget, showNewPassword)}
                    onBlur={() => forgotChar.setFocusField(null)}
                    type={showNewPassword ? 'text' : 'password'}
                    minLength={6}
                  />
                  <PasswordToggleButton
                    visible={showNewPassword}
                    onClick={() => {
                      const next = !showNewPassword;
                      setShowNewPassword(next);
                      forgotChar.setPasswordVisible(next);
                    }}
                  />
                  <FieldError message={forgotErrors.newPassword} />
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
                    onClick={() => {
                      setForgotStep('request');
                      setForgotErrors({});
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
