import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useI18n } from '../context/I18nContext';
import { colors, fonts, radius } from '../lib/theme';

const Button = ({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  small
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
}) => {
  const { t } = useI18n();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        small && styles.small,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.text} size="small" />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' && styles.primaryLabel,
            variant === 'secondary' && styles.secondaryLabel,
            variant === 'danger' && styles.dangerLabel
          ]}
        >
          {t(label)}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1
  },
  small: {
    minHeight: 38,
    paddingHorizontal: 12
  },
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  secondary: {
    backgroundColor: colors.card,
    borderColor: colors.border
  },
  danger: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca'
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 15
  },
  primaryLabel: {
    color: '#fff'
  },
  secondaryLabel: {
    color: colors.text
  },
  dangerLabel: {
    color: colors.danger
  },
  disabled: { opacity: 0.6 },
  pressed: { transform: [{ translateY: 1 }] }
});

export default Button;
