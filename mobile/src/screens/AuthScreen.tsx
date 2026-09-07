import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Screen from '../components/Screen';
import Button from '../components/Button';
import Card from '../components/Card';
import SegmentedControl from '../components/SegmentedControl';
import LoginCharacter, { type CharacterMood } from '../components/LoginCharacter';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import api from '../lib/api';
import { colors, fonts } from '../lib/theme';

type AuthMode = 'login' | 'register';
type ForgotStep = 'request' | 'reset';

const AuthScreen = () => {
  const { t } = useI18n();
  const { signIn } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotVisible, setForgotVisible] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>('request');
  const [forgotEmail, setForgotEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [focusField, setFocusField] = useState<'text' | 'password' | null>(null);
  const [focusVisible, setFocusVisible] = useState(false);
  const [flashMood, setFlashMood] = useState<CharacterMood | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const [pokeKey, setPokeKey] = useState(0);
  const heroSize = { width: 150, height: 120 };

  const heroRef = useRef<View>(null);
  const fullNameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const flash = (nextMood: CharacterMood, duration = 1400) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashMood(nextMood);
    flashTimerRef.current = setTimeout(() => setFlashMood(null), duration);
  };

  const resetGaze = () => setGaze({ x: 0, y: 0 });

  const lookAtRef = (targetRef: React.RefObject<TextInput | null>) => {
    const heroNode = heroRef.current as any;
    const targetNode = targetRef.current as any;
    if (!heroNode || !targetNode) return;
    heroNode.measureInWindow((hx: number, hy: number, hw: number, hh: number) => {
      targetNode.measureInWindow((tx: number, ty: number, tw: number, th: number) => {
        const heroCx = hx + hw / 2;
        const heroCy = hy + hh * 0.55;
        const targetCx = tx + tw / 2;
        const targetCy = ty + th / 2;
        const nx = Math.max(-1, Math.min(1, (targetCx - heroCx) / 130));
        const ny = Math.max(-1, Math.min(1, (targetCy - heroCy) / 130));
        setGaze({ x: nx, y: ny });
      });
    });
  };

  const focusTextField = (ref: React.RefObject<TextInput | null>) => {
    setFocusField('text');
    lookAtRef(ref);
  };

  const focusPasswordField = (ref: React.RefObject<TextInput | null>, visible: boolean) => {
    setFocusField('password');
    setFocusVisible(visible);
    lookAtRef(ref);
  };

  const blurField = () => {
    setFocusField(null);
    resetGaze();
  };

  const poke = () => {
    setPokeKey((n) => n + 1);
    flash('poked', 650);
  };

  const updateGazeFromTouch = (e: any) => {
    const { locationX, locationY } = e.nativeEvent;
    const x = (locationX / heroSize.width) * 2 - 1;
    const y = (locationY / heroSize.height) * 2 - 1;
    setGaze({ x, y });
  };

  const onHeroTouchStart = (e: any) => {
    const { pageX, pageY } = e.nativeEvent;
    touchStartRef.current = { x: pageX, y: pageY, time: Date.now() };
    updateGazeFromTouch(e);
  };

  const onHeroTouchEnd = (e: any) => {
    const start = touchStartRef.current;
    if (start) {
      const { pageX, pageY } = e.nativeEvent;
      const dist = Math.hypot((pageX ?? start.x) - start.x, (pageY ?? start.y) - start.y);
      const elapsed = Date.now() - start.time;
      if (dist < 12 && elapsed < 400) poke();
    }
    touchStartRef.current = null;
    if (focusField) lookAtRef(focusField === 'password' ? passwordRef : emailRef);
    else resetGaze();
  };

  const mood: CharacterMood = loading
    ? 'thinking'
    : flashMood
      ? flashMood
      : isOffline
        ? 'offline'
        : focusField === 'password'
          ? focusVisible
            ? 'peeking'
            : 'hiding'
          : focusField === 'text'
            ? 'watching'
            : 'idle';

  const submit = async () => {
    try {
      setError('');
      setIsOffline(false);
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

      setLoading(true);
      const response =
        mode === 'login'
          ? await api.post('/auth/login', { email, password })
          : await api.post('/auth/register', { fullName, phone: phone.trim() || undefined, email, password, role: 'owner' });
      flash('success');
      await signIn(response.data.token);
    } catch (err: any) {
      if (!err?.response) {
        setIsOffline(true);
        setError(t('Could not reach the server. Check your connection and try again.'));
      } else {
        flash('error');
        setError(err?.response?.data?.message || t(mode === 'login' ? 'Login failed.' : 'Could not create account.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    try {
      setForgotLoading(true);
      setForgotError('');
      setForgotMessage('');
      await api.post('/auth/forgot-password', { email: forgotEmail });
      setForgotMessage(t('OTP sent to your email.'));
      setForgotStep('reset');
    } catch (err: any) {
      setForgotError(err?.response?.data?.message || t('Could not send OTP.'));
    } finally {
      setForgotLoading(false);
    }
  };

  const resetPassword = async () => {
    try {
      setForgotLoading(true);
      setForgotError('');
      setForgotMessage('');
      await api.post('/auth/reset-password', { email: forgotEmail, otp, newPassword });
      setForgotMessage(t('Password updated. You can sign in now.'));
      setForgotVisible(false);
      setMode('login');
      setPassword('');
      setConfirmPassword('');
      setOtp('');
      setNewPassword('');
      setForgotStep('request');
    } catch (err: any) {
      setForgotError(err?.response?.data?.message || t('Could not reset password.'));
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <Screen
      title="RentDesk"
      subtitle={mode === 'login' ? t('Sign in to continue.') : t('Create your owner account.')}
      contentStyle={styles.screenContent}
      showProfileMenu={false}
    >
      <Card>
        <View
          ref={heroRef}
          style={[styles.characterWrap, heroSize]}
          onTouchStart={onHeroTouchStart}
          onTouchMove={updateGazeFromTouch}
          onTouchEnd={onHeroTouchEnd}
        >
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id="heroBg" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#0f766e" />
                <Stop offset="100%" stopColor="#2563eb" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" rx={22} fill="url(#heroBg)" />
          </Svg>
          <LoginCharacter mood={mood} size={102} gazeX={gaze.x} gazeY={gaze.y} pokeKey={pokeKey} />
        </View>

        <SegmentedControl
          options={[
            { label: 'Sign In', value: 'login' as const },
            { label: 'Register', value: 'register' as const }
          ]}
          value={mode}
          onChange={setMode}
        />

        <View style={styles.form}>
          {mode === 'register' ? (
            <TextInput
              ref={fullNameRef}
              style={styles.input}
              placeholder={t('Full name')}
              value={fullName}
              onChangeText={setFullName}
              onFocus={() => focusTextField(fullNameRef)}
              onBlur={blurField}
            />
          ) : null}
          {mode === 'register' ? (
            <TextInput
              ref={phoneRef}
              style={styles.input}
              placeholder={t('Phone number')}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              onFocus={() => focusTextField(phoneRef)}
              onBlur={blurField}
            />
          ) : null}
          <TextInput
            ref={emailRef}
            style={styles.input}
            placeholder={t('Email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            onFocus={() => focusTextField(emailRef)}
            onBlur={blurField}
          />
          <View style={styles.passwordField}>
            <TextInput
              ref={passwordRef}
              style={[styles.input, styles.passwordInput]}
              placeholder={t('Password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              onFocus={() => focusPasswordField(passwordRef, showPassword)}
              onBlur={blurField}
            />
            <Pressable
              style={styles.passwordToggle}
              onPress={() =>
                setShowPassword((current) => {
                  const next = !current;
                  if (focusField === 'password') setFocusVisible(next);
                  return next;
                })
              }
              hitSlop={10}
            >
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
            </Pressable>
          </View>
          {mode === 'register' ? (
            <View style={styles.passwordField}>
              <TextInput
                ref={confirmPasswordRef}
                style={[styles.input, styles.passwordInput]}
                placeholder={t('Confirm password')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                onFocus={() => focusPasswordField(confirmPasswordRef, showConfirmPassword)}
                onBlur={blurField}
              />
              <Pressable
                style={styles.passwordToggle}
                onPress={() =>
                  setShowConfirmPassword((current) => {
                    const next = !current;
                    if (focusField === 'password') setFocusVisible(next);
                    return next;
                  })
                }
                hitSlop={10}
              >
                <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
              </Pressable>
            </View>
          ) : null}

          {mode === 'login' ? (
            <Pressable
              onPress={() => {
                setForgotVisible(true);
                setForgotEmail(email);
                setForgotError('');
                setForgotMessage('');
              }}
            >
              <Text style={styles.link}>{t('Forgot password?')}</Text>
            </Pressable>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            label={loading ? (mode === 'login' ? 'Signing In...' : 'Creating Account...') : mode === 'login' ? 'Sign In' : 'Create Account'}
            onPress={submit}
            loading={loading}
          />
        </View>
      </Card>

      <Modal visible={forgotVisible} transparent animationType="fade" onRequestClose={() => setForgotVisible(false)}>
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('Reset Password')}</Text>
              <Pressable
                onPress={() => {
                  setForgotVisible(false);
                  setForgotStep('request');
                }}
              >
                <Text style={styles.link}>{t('Close')}</Text>
              </Pressable>
            </View>
            <Text style={styles.modalSubtitle}>
              {forgotStep === 'request'
                ? t('Enter your email to receive a 6-digit OTP.')
                : t('Enter the OTP and choose your new password.')}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t('Email')}
              value={forgotEmail}
              onChangeText={setForgotEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {forgotStep === 'reset' ? (
              <>
                <TextInput style={styles.input} placeholder={t('OTP')} value={otp} onChangeText={setOtp} keyboardType="number-pad" />
                <View style={styles.passwordField}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder={t('New password')}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNewPassword}
                  />
                  <Pressable style={styles.passwordToggle} onPress={() => setShowNewPassword((current) => !current)} hitSlop={10}>
                    <Ionicons name={showNewPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
                  </Pressable>
                </View>
              </>
            ) : null}
            {forgotError ? <Text style={styles.error}>{forgotError}</Text> : null}
            {forgotMessage ? <Text style={styles.success}>{forgotMessage}</Text> : null}
            {forgotStep === 'request' ? (
              <Button label="Send OTP" onPress={sendOtp} loading={forgotLoading} />
            ) : (
              <View style={styles.modalActions}>
                <Button label="Reset Password" onPress={resetPassword} loading={forgotLoading} />
                <Button label="Back" variant="secondary" onPress={() => setForgotStep('request')} />
              </View>
            )}
          </Card>
        </View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screenContent: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  characterWrap: {
    alignSelf: 'center',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden'
  },
  form: { marginTop: 18, gap: 12 },
  passwordField: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 44 },
  passwordToggle: { position: 'absolute', right: 12, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: fonts.body,
    color: colors.text
  },
  link: { fontFamily: fonts.bodyBold, color: colors.accent },
  error: { fontFamily: fonts.body, color: colors.danger },
  success: { fontFamily: fonts.body, color: colors.success },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    padding: 24,
    justifyContent: 'center'
  },
  modalCard: { gap: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontFamily: fonts.headingSemi, fontSize: 22, color: colors.text },
  modalSubtitle: { fontFamily: fonts.body, color: colors.muted },
  modalActions: { gap: 10 }
});

export default AuthScreen;
