import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Screen from '../components/Screen';
import Button from '../components/Button';
import Card from '../components/Card';
import SegmentedControl from '../components/SegmentedControl';
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotVisible, setForgotVisible] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>('request');
  const [forgotEmail, setForgotEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const submit = async () => {
    try {
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

      setLoading(true);
      const response =
        mode === 'login'
          ? await api.post('/auth/login', { email, password })
          : await api.post('/auth/register', { fullName, email, password, role: 'owner' });
      await signIn(response.data.token);
    } catch (err: any) {
      setError(err?.response?.data?.message || t(mode === 'login' ? 'Login failed.' : 'Could not create account.'));
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
    >
      <Card>
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
            <TextInput style={styles.input} placeholder={t('Full name')} value={fullName} onChangeText={setFullName} />
          ) : null}
          <TextInput
            style={styles.input}
            placeholder={t('Email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput style={styles.input} placeholder={t('Password')} value={password} onChangeText={setPassword} secureTextEntry />
          {mode === 'register' ? (
            <TextInput
              style={styles.input}
              placeholder={t('Confirm password')}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
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
                <TextInput
                  style={styles.input}
                  placeholder={t('New password')}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />
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
  form: { marginTop: 18, gap: 12 },
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
